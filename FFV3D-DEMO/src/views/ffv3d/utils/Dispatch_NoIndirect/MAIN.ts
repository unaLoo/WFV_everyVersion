import axios from "axios";
import { makeShaderDataDefinitions,makeStructuredView,type StructuredView } from "webgpu-utils";

///some info needed from json file
let maxParticleNum:number = 65535;//1024,4096,16384,65536,262144
let textrureResourceArray:Array<string> = [
    "/demo/images2/fake1.png",
    "/demo/images2/fake2.png",
    "/demo/images2/fake3.png",
    "/demo/images2/fake4.png",
    "/demo/images2/fake5.png",
    "/demo/images2/fake6.png",
    "/demo/images2/fake7.png",
    "/demo/images2/fake8.png",
    "/demo/images2/fake9.png",
    "/demo/images2/fake10.png",
]
let deltaHeight:number = 0.003;
let totalLayers:number = textrureResourceArray.length-1;//这里的layer指的是两张纹理的中间层
let speedBoundary:Array<number> = [0.1,0.9];

//basic params
let canvas:HTMLCanvasElement;
let adapter:GPUAdapter;
let device:GPUDevice;
let context:GPUCanvasContext;
let format:GPUTextureFormat;

let C1_module:GPUShaderModule;
let C2_module:GPUShaderModule;
let R_module:GPUShaderModule;
let C_defs:any; //ShaderDataDefinitions
let C_uniformValues:StructuredView;

// params about workgroup and invocation 
let maxInvocationsPerWorkgroup:number;
let maxWorkgroupsPerDemension:number;
let totalgroupNum:number;
let groupWidth:number;
let maxTotalgroupNum:number;
let needWorkgroup:Array<number>;


let mapbox_Matrix:Float32Array;
let uniformbuffer:GPUBuffer;

/////////sampler and textures
let sampler:GPUSampler;
let transfromTex:GPUTexture;
let fakeTextureArray:Array<GPUTexture>;
let highTex:GPUTexture;
let lowTex:GPUTexture;

////////storage buffers
let ParticleInfoBuffer:GPUBuffer;
let ParticleInfoBufferData:Float32Array;

let IndirectAlivenumBuffer:GPUBuffer;
let IndirectAlivenumBufferData:Uint32Array;

let LayoutBaseBuffer:GPUBuffer;
let LayoutBaseBufferData:Uint32Array;

let LAST_LayeredAlivenumBuffer:GPUBuffer;
let LAST_LayeredAlivenumBufferData:Uint32Array;

let IndirectDispatchBuffer:GPUBuffer;
let IndirectDispatchBufferData:Uint32Array;

let IndexArrayBuffer:GPUBuffer;
let IndexArrayBufferData:Uint32Array;

let justOffsetBuffer:GPUBuffer;
let justOffsetBufferData:Uint32Array;

let particleLayerBuffer:GPUBuffer;
let particleLayerBufferData:Uint32Array;


let justIndexingBuffer:GPUBuffer;
let justIndexingBufferData:Uint32Array;

let nowLayerBuffer:GPUBuffer;
let nowLayerBufferS:Array<GPUBuffer> = new Array(10);


let copybuffer:GPUBuffer;

//////bindgroup
let uniformBGLayout:GPUBindGroupLayout;
let textureBGLayout:GPUBindGroupLayout;
let storageBGLayout:GPUBindGroupLayout;
let layerBGlayout:GPUBindGroupLayout;

let uniformBindGroup:GPUBindGroup;
// let textureBindGroup:GPUBindGroup;
let storageBindGroup:GPUBindGroup;
let textureBindGroups:Array<GPUBindGroup> = new Array(10);
let layerBindGroups:Array<GPUBindGroup> = new Array(10);

let C_pipelineLayout:GPUPipelineLayout;
let C1_pipeline:GPUComputePipeline;
let C2_pipeline:GPUComputePipeline;

let R_bindGroupLayout:GPUBindGroupLayout;
let R_bindgroup:GPUBindGroup;
let R_pipelineLayout:GPUPipelineLayout;
let R_pipeline:GPURenderPipeline;

let passDescriptor:GPURenderPassDescriptor;


//assistant buffer
let testBuffer_float : GPUBuffer;
let testBufferData_float:Float32Array;

let testBuffer_uint : GPUBuffer;
let testBufferData_uint:Uint32Array;

let ReadBuffer_LayeredAliveNum:GPUBuffer


const main =async (canvasElement:HTMLCanvasElement,matrix:Array<number>) => {

    setCanvas(canvasElement);
    await Myprepare();

    Myrender(matrix);
}

const setCanvas = (cnavasElement:HTMLCanvasElement) =>{
    canvas = cnavasElement;
}


const Myprepare = async()=>{

    ///////////////////////////basically configure///////////////////////////
    adapter = (await navigator.gpu.requestAdapter()!)!;
    device = await adapter?.requestDevice()!;
    console.log(device.limits);
    
    context = canvas.getContext("webgpu")!;
    format = navigator.gpu.getPreferredCanvasFormat()!;

    context.configure({
        format,
        device,
        alphaMode: "premultiplied"
    });

    const C1_shadersrc = (await axios.get("/demo/shaders/no_indirect/compute1.wgsl")).data;
    const C2_shadersrc = (await axios.get("/demo/shaders/no_indirect/compute2.wgsl")).data;
    const R_shadersrc = (await axios.get("/demo/shaders/no_indirect/render.wgsl")).data;

    // const C_shadersrc = (await axios.get("/demo/shaders/simulation.wgsl")).data;

    C_defs = makeShaderDataDefinitions(C1_shadersrc); 
    C_uniformValues = makeStructuredView(C_defs.uniforms.ublock);
    C1_module = device.createShaderModule({
        label:"first compute shader module",
        code:C1_shadersrc,
    });
    C2_module = device.createShaderModule({
        label:"second compute shader module",
        code:C2_shadersrc,
    })
    R_module = device.createShaderModule({
        label:"R_module",
        code:R_shadersrc,
    })
    ////renderShaderModule..........


    //////////////////////configure data,buffer,bindgroup,pipeline/////////

    ///////for uniform buffer  需注意，尤其是groupnum等数值的计算

    maxInvocationsPerWorkgroup = device.limits.maxComputeInvocationsPerWorkgroup;//单工作组线程数，单维度blocksize
    maxWorkgroupsPerDemension  = device.limits.maxComputeWorkgroupsPerDimension;//单维度最大工作组数
    totalgroupNum = Math.ceil(maxParticleNum / maxInvocationsPerWorkgroup);//所需的总工作组数，单维度
    groupWidth = maxInvocationsPerWorkgroup;
    maxTotalgroupNum = totalgroupNum*2 -1 ;//极端情况,前几层都是width+1个，最后一层width-(n-1)个

    console.log("totalgroupNum:",totalgroupNum);
    console.log("blockSize:",groupWidth);
    
    
    if(maxWorkgroupsPerDemension<maxTotalgroupNum){
        console.log("trash computer"); 
        return;
    }

    // needWorkgroup = new Array(totalLayers);
    // needWorkgroup[0] = totalgroupNum;//第一次模拟之前，所有粒子均在第一层，所有工作组都交给该层，其他层0
    // for(let i = 1 ; i < 10 ; i++ )
    //     needWorkgroup[i] = totalgroupNum ;


    
    ///////uniform 的值应当在render时设定，现在先瞎填一些

    uniformbuffer = device.createBuffer({
        label:"uBUffer1",
        size:C_uniformValues.arrayBuffer.byteLength,
        usage:GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    
    ///////for texture
    fakeTextureArray = new Array(10);
    for(let i=0;i<textrureResourceArray.length;i++){
        fakeTextureArray[i] = (await getTexture(textrureResourceArray[i],`fake tex ${i}`));
    }

    transfromTex = await getReparsedTexture("/FlowField/images/projection.png","transform tex");
    sampler = device.createSampler({
        addressModeU:"clamp-to-edge",
        addressModeV:"clamp-to-edge",
        magFilter:"nearest",
        minFilter:"nearest",
    });

    //////for storage buffer 

    // PositionStBufferData = new Float32Array(maxParticleNum*3);//x,y,z
    // for(let i=0;i<PositionStBufferData.length/3;i++){
    //     PositionStBufferData[i*3+0] = Math.random();
    //     PositionStBufferData[i*3+1] = Math.random();
    //     PositionStBufferData[i*3+2] = 0.0;
    // }
    // PositionStBuffer = device.createBuffer({
    //     label:"position storage buffer ",
    //     size:PositionStBufferData.byteLength,
    //     usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    // })
    // device.queue.writeBuffer(PositionStBuffer,0,PositionStBufferData);

    // AttribStBufferData = new Float32Array(maxParticleNum);
    // AttribStBufferData.fill(0.0);
    // AttribStBuffer = device.createBuffer({
    //     label:"attribute storage buffer ",
    //     size:AttribStBufferData.byteLength,
    //     usage:GPUBufferUsage.STORAGE |GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC
    // })
    // device.queue.writeBuffer(AttribStBuffer,0,AttribStBufferData);

    ParticleInfoBuffer = device.createBuffer({
        label:"Particle info buffer",
        size:4*maxParticleNum*4,
        usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    ParticleInfoBufferData = new Float32Array(maxParticleNum*4);
    for(let i = 0 ; i<maxParticleNum; i++){
        // x,y,z,attrib
        ParticleInfoBufferData[i*4+0] = Math.random();
        ParticleInfoBufferData[i*4+1] = Math.random();
        ParticleInfoBufferData[i*4+2] = 0.0;
        ParticleInfoBufferData[i*4+3] = 0.0;

    }
    device.queue.writeBuffer(ParticleInfoBuffer,0,ParticleInfoBufferData);
    
    

    IndirectAlivenumBufferData = new Uint32Array([
        4,//顶点数，
        0,//实例数 --- aliveNum
        0,//first vertex
        0,//first instance
    ]);
    
    IndirectAlivenumBuffer = device.createBuffer({
        label:"Indirect alivenum buffer",
        size:IndirectAlivenumBufferData.byteLength,
        usage:GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT| GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    device.queue.writeBuffer(IndirectAlivenumBuffer,0,IndirectAlivenumBufferData);

    LayoutBaseBufferData = new Uint32Array(totalLayers).fill(0);
    LayoutBaseBuffer = device.createBuffer({
        label:"Layered alivenum buffer",
        size:LayoutBaseBufferData.byteLength,
        usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(LayoutBaseBuffer,0,LayoutBaseBufferData);

    LAST_LayeredAlivenumBufferData = new Uint32Array(totalLayers).fill(maxParticleNum-1);
    LAST_LayeredAlivenumBufferData[0] = 0;
    LAST_LayeredAlivenumBuffer = device.createBuffer({
        label:"old layered alivenum buffer",
        size:LAST_LayeredAlivenumBufferData.byteLength,
        usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(LAST_LayeredAlivenumBuffer,0,LAST_LayeredAlivenumBufferData);

    /////////note!!!
    IndirectDispatchBufferData = new Uint32Array(totalLayers*3);
    for(let i=0;i<totalLayers;i++)
    {
        IndirectDispatchBufferData[i*3+0] = maxParticleNum-1;
        IndirectDispatchBufferData[i*3+1] = 1;
        IndirectDispatchBufferData[i*3+2] = 1;
    }

    IndirectDispatchBuffer = device.createBuffer({
        label:"IndirectDispatchBuffer",
        size:IndirectDispatchBufferData.byteLength,
        usage:GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(IndirectDispatchBuffer,0,IndirectDispatchBufferData);

    IndexArrayBufferData = new Uint32Array(maxParticleNum);
    for(let i = 0 ; i<maxParticleNum; i++){
        IndexArrayBufferData[i] = i;
    }
    IndexArrayBuffer = device.createBuffer({
        label:"IndexArrayBuffer",
        size:IndexArrayBufferData.byteLength,
        usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    })
    device.queue.writeBuffer(IndexArrayBuffer,0,IndexArrayBufferData);

    
    particleLayerBufferData = new Uint32Array(maxParticleNum).fill(0);
    
    particleLayerBuffer = device.createBuffer({
        label:"particle layer buffer",
        size:particleLayerBufferData.byteLength,
        usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    device.queue.writeBuffer(particleLayerBuffer,0,particleLayerBufferData);

    
    
    ///note  每次compute都应置零
    justOffsetBufferData = new Uint32Array(totalLayers).fill(0);
    justOffsetBuffer = device.createBuffer({
        label:"just offset buffer",
        size:4*totalLayers,
        usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    device.queue.writeBuffer(justOffsetBuffer,0,justOffsetBufferData);
    

    // justIndexingBufferData = new Uint32Array([0]);
    // justIndexingBuffer = device.createBuffer({
    //     label:"just indexing buffer",
    //     size:4,
    //     usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    // })
    // device.queue.writeBuffer(justIndexingBuffer,0,justIndexingBufferData);
    
    // nowLayerBuffer = device.createBuffer({
    //     label:"just now Layer buffer",
    //     size:4,
    //     usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    // })

    for(let i = 0;i<totalLayers;i++){

        let nlayerBuffer = device.createBuffer({
            label:`now buffer ${i}`,
            size:4,
            usage:GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });
        device.queue.writeBuffer(nlayerBuffer,0,new Uint32Array([i]));
        nowLayerBufferS[i] = nlayerBuffer;
    }



    ////////for bind group(0)
    uniformBGLayout = device.createBindGroupLayout({
        label:"uniformBGLayout",
        entries:[
            {
                binding:0,
                visibility:GPUShaderStage.COMPUTE,
                buffer:{type:"uniform"}
            },
        ]
    });

    uniformBindGroup = device.createBindGroup({
        label:"uniform Bind Group",
        layout:uniformBGLayout,
        entries:[
            {binding:0,resource:{buffer:uniformbuffer}}
        ]
    });

    textureBGLayout = device.createBindGroupLayout({
        label:"textureBGLayout",
        entries:[
            {
                binding:0,
                visibility:GPUShaderStage.COMPUTE,
                sampler:{type:"non-filtering"}
            },
            {
                binding:1,
                visibility:GPUShaderStage.COMPUTE,
                texture:{sampleType:"unfilterable-float",viewDimension:"2d"}
            },
            {
                binding:2,
                visibility:GPUShaderStage.COMPUTE,
                texture:{sampleType:"unfilterable-float",viewDimension:"2d"}
            },
            {
                binding:3,
                visibility:GPUShaderStage.COMPUTE,
                buffer:{type:"read-only-storage"}
            }
        ]
    });

    for(let i = 0;i<textrureResourceArray.length-1;i++){
        lowTex  = fakeTextureArray[i];
        highTex = fakeTextureArray[i+1];
        let nowLayerBuf = nowLayerBufferS[i];

        let texBG = device.createBindGroup({
            label:"textureBindGroup",
            layout:textureBGLayout,
            entries:[
                {binding:0,resource:sampler},
                {binding:1,resource:highTex.createView()},
                {binding:2,resource:lowTex.createView()},
                {binding:3,resource:{buffer:nowLayerBuf}}
                /////note!! 这会，hightex,lowtex还是空的
            ]
        });

        textureBindGroups[i] = texBG;
    }



    storageBGLayout = device.createBindGroupLayout({
        label:"storageBGLayout",
        entries:[
            {
                binding:0,
                visibility:GPUShaderStage.COMPUTE,
                buffer:{type:"storage"}
            },
            {
                binding:1,
                visibility:GPUShaderStage.COMPUTE,
                buffer:{type:"storage"}
            },
            {
                binding:2,
                visibility:GPUShaderStage.COMPUTE,
                buffer:{type:"storage"}
            },
            {
                binding:3,
                visibility:GPUShaderStage.COMPUTE,
                buffer:{type:"storage"}
            },
            {
                binding:4,
                visibility:GPUShaderStage.COMPUTE,
                buffer:{type:"storage"}
            },
            {
                binding:5,
                visibility:GPUShaderStage.COMPUTE,
                buffer:{type:"storage"}
            },
            {
                binding:6,
                visibility:GPUShaderStage.COMPUTE,
                buffer:{type:"storage"}
            }
        ]
    });

    storageBindGroup = device.createBindGroup({
        label:"storageBindGroup",
        layout:storageBGLayout,
        entries:[
            {binding:0,resource:{buffer:ParticleInfoBuffer}},
            {binding:1,resource:{buffer:LayoutBaseBuffer}},
            {binding:2,resource:{buffer:LAST_LayeredAlivenumBuffer}},
            {binding:3,resource:{buffer:IndirectAlivenumBuffer}},
            {binding:4,resource:{buffer:IndexArrayBuffer}},
            {binding:5,resource:{buffer:particleLayerBuffer}},
            {binding:6,resource:{buffer:justOffsetBuffer}},
        ]
    });

    


    C_pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts:[
            uniformBGLayout,
            textureBGLayout,
            storageBGLayout,
        ]
    });

    C1_pipeline = device.createComputePipeline({
        label:"C1_pipeline",
        layout:C_pipelineLayout,
        compute:{
            module:C1_module,
            entryPoint:"cMain",
            // constants:{
            //     blockSize:groupWidth,/////note!!!!
            // }
        }
    });

    C2_pipeline = device.createComputePipeline({
        label:"C2_pipeline",
        layout:C_pipelineLayout,
        compute:{
            module:C2_module,
            entryPoint:"cMain",
            // constants:{
            //     blockSize:groupWidth,/////note!!!
            // }
        }
    });

    R_bindGroupLayout = device.createBindGroupLayout({
        label:"Render_bindgroupLayout",
        entries:[
            {
                binding:0,
                visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,
                buffer:{type:"uniform"}
            },
            {
                binding:1,
                visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,
                sampler:{type:"non-filtering"}
            },
            {
                binding:2,
                visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,
                texture:{sampleType:"unfilterable-float",viewDimension:"2d"}
            },
            {
                binding:3,
                visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,
                buffer:{type:"read-only-storage"}
            },
            {
                binding:4,
                visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,
                buffer:{type:"read-only-storage"}
            }
        ]
    });

    R_bindgroup = device.createBindGroup({
        label:"R_bindGroup",
        layout:R_bindGroupLayout,
        entries:[
            {binding:0,resource:{buffer:uniformbuffer}},
            {binding:1,resource:sampler},
            {binding:2,resource:transfromTex.createView()},
            {binding:3,resource:{buffer:IndexArrayBuffer}},
            {binding:4,resource:{buffer:ParticleInfoBuffer}},
        ],
    });

    R_pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts:[
            R_bindGroupLayout
        ]
    });

    R_pipeline = device.createRenderPipeline({
        label:"R_pipeline",
        layout:R_pipelineLayout,
        vertex:{
            module:R_module,
            entryPoint:"vMain",
        },
        fragment:{
            module:R_module,
            entryPoint:"fMain",
            targets:[
                {
                    format:format,
                }
            ]
        },
        primitive:{
            topology:"triangle-strip"
        }
    })

    passDescriptor = {
        label:"passDescriptor",
        colorAttachments:[
            {
                view:context.getCurrentTexture().createView(),
                resolveTarget:undefined,
                clearValue:[0.0,0.0,0.0,0.0],
                loadOp:"clear",
                storeOp:"store",
            }
        ]
    }

    testBufferData_float = new Float32Array(maxParticleNum);
    testBuffer_float = device.createBuffer({
        label:"simulation test buffer_float",
        size:testBufferData_float.byteLength,
        usage:GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    testBufferData_uint = new Uint32Array(maxParticleNum);
    testBuffer_uint = device.createBuffer({
        label:"test buffer u int ",
        size:testBufferData_uint.byteLength,
        usage:GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })

    ReadBuffer_LayeredAliveNum = device.createBuffer({
        label:"ReadBuffer_LayeredAliveNum",
        size:totalLayers*4,
        usage:GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })

    return true;

}

let count = 0;

const Myrender = async (matrix:Array<number>)=>{

    //////uniform 主要就是更新这个matrix
    mapbox_Matrix = new Float32Array(matrix);
    C_uniformValues.set({
        canvasSize:[canvas.width,canvas.height],
        particleNum:maxParticleNum,
        deltaHeight:deltaHeight,
        totalLayers:totalLayers,//9
        speedBoundary:[0.1,0.9],
        matrix:mapbox_Matrix,
    })
    device.queue.writeBuffer(uniformbuffer,0,C_uniformValues.arrayBuffer);

    let encoder = device.createCommandEncoder({label:"compute and render encoder "});
    
    ///////compute pass 1 
    for(let i = 0 ; i < totalLayers; i++)
    {   //i   0,8
        let simu_pass_11 = encoder.beginComputePass();
        simu_pass_11.setPipeline(C1_pipeline);
        simu_pass_11.setBindGroup(0,uniformBindGroup);
        simu_pass_11.setBindGroup(1,textureBindGroups[i]);//note!!!
        simu_pass_11.setBindGroup(2,storageBindGroup);
        simu_pass_11.dispatchWorkgroupsIndirect(IndirectDispatchBuffer,i*3*4);
        
        simu_pass_11.end();

        // let ecd = device.createCommandEncoder({label:"copy encoder"});
        // ecd.copyBufferToBuffer(IndirectDispatchBuffer,0,LAST_LayeredAlivenumBuffer,i*4,4);
        // device.queue.submit([ecd.finish()]);

    }
    // encoder.copyBufferToBuffer(LayoutBaseBuffer,0,LAST_LayeredAlivenumBuffer,0,totalLayers*4);
    ///////compute pass 2
    let simu_pass_22 = encoder.beginComputePass();
    simu_pass_22.setPipeline(C2_pipeline);
    simu_pass_22.setBindGroup(0,uniformBindGroup);
    simu_pass_22.setBindGroup(1,textureBindGroups[0]);//好像不需要了，随便传一个先
    simu_pass_22.setBindGroup(2,storageBindGroup);
    simu_pass_22.dispatchWorkgroups(maxParticleNum);//遍历全部，自然要totalgroupNum

    simu_pass_22.end();
    


    //////render pass 
    context.canvas.width = (context.canvas as HTMLCanvasElement).clientWidth;
    context.canvas.height = (context.canvas as HTMLCanvasElement).clientHeight;

    (passDescriptor.colorAttachments as Array<GPURenderPassColorAttachment>)[0].view = context.getCurrentTexture().createView();


    let render_pass = encoder.beginRenderPass(passDescriptor);
    render_pass.setBlendConstant([0.0,0.0,0.0,0.0]);
    render_pass.setPipeline(R_pipeline);
    render_pass.setBindGroup(0,R_bindgroup);
    render_pass.drawIndirect(IndirectAlivenumBuffer,0);
    render_pass.end();

    let commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);


    // device.queue.writeBuffer(justOffsetBuffer,0,new Uint32Array([0]));

    // device.queue.writeBuffer(IndexArrayBuffer,0,new Uint32Array(maxParticleNum).fill(0));


    //////////////完成一次submit之后，下次pass开始之前，要做什么？
    /* 
    `    1.uniform--更新matrix，这在一开始就做了   
    `    2.texture--更新textureBindgroup,这在setbindgroup时完成
    `    3.position/attribute--无需变动
    `    4.indirectAliveNum--在renderpass之后就要置零，下一轮compute pass2 重新计数
    `    5.layeredAliveNum--其实是base，也是在renderpass之后就要置零，下一轮compute pass1 重新计数
    `    6.indexArray--是给render用的，下一轮compute pass2 重新计数
        7.justOffset--pass2 后 置零
    `    9.old_layered_aliveNum--存储着上一轮的layeredAliveNum，需要更新，copybuffertobuffer
    `    10.nowLayer，需要在开始之前写入LayerIndex
    */
        //q,encoder has  already finished
    // encoder.copyBufferToBuffer(LayoutBaseBuffer,0,LAST_LayeredAlivenumBuffer,0,totalLayers*4);

    // if(count%200===0 && count!==0)
    // {
    //     await Debug();
    // }
    
    await postProcess();
 
    count++;
}

// const checkLayerIsNoParticle =async (idx:number) => {
//     const tempEncoder = device.createCommandEncoder();
//     tempEncoder.copyBufferToBuffer(LayoutBaseBuffer,0,ReadBuffer_LayeredAliveNum,0,totalLayers*4);
//     let commandBuffer = tempEncoder.finish();
//     device.queue.submit([commandBuffer]);
    
//     await ReadBuffer_LayeredAliveNum.mapAsync(GPUMapMode.READ);
//     let Result = new Uint32Array(ReadBuffer_LayeredAliveNum.getMappedRange());
//     ReadBuffer_LayeredAliveNum.unmap();

//     return Result[idx] === 0;
// }


const Debug = async()=>{
    let DebugEncoder = device.createCommandEncoder();
    ////for float 
    // DebugEncoder.copyBufferToBuffer(PositionStBuffer,0,testBuffer_float,0,maxParticleNum*4);
    // let command = DebugEncoder.finish();
    // device.queue.submit([command]);
    // await testBuffer_float.mapAsync(GPUMapMode.READ);
    // let partResult = new Float32Array(testBuffer_float.getMappedRange());
    // let visualResult = [...partResult];
    // console.log("PositionStBuffer",visualResult);
    // testBuffer_float.unmap();

    //for uint
    // DebugEncoder.copyBufferToBuffer(IndexArrayBuffer ,0,testBuffer_uint,0,maxParticleNum*4);
    // DebugEncoder.copyBufferToBuffer(IndirectAlivenumBuffer,0,testBuffer_uint,0,4*4);
    DebugEncoder.copyBufferToBuffer(LAST_LayeredAlivenumBuffer,0,testBuffer_uint,0,totalLayers*4);
    // DebugEncoder.copyBufferToBuffer(LayoutBaseBuffer,0,testBuffer_uint,0,totalLayers*4);
    // DebugEncoder.copyBufferToBuffer(justOffsetBuffer,0,testBuffer_uint,0,1*4);
    // DebugEncoder.copyBufferToBuffer(particleLayerBuffer,0,testBuffer_uint,0,maxParticleNum);

    let command = DebugEncoder.finish();
    device.queue.submit([command]);
    await testBuffer_uint.mapAsync(GPUMapMode.READ);
    let partResult = new Uint32Array(testBuffer_uint.getMappedRange());
    let visualResult = [...partResult];
    console.log("LayoutBaseBuffer ",visualResult);
    testBuffer_uint.unmap();

}


const postProcess = async()=>{

    let TempEncoder = device.createCommandEncoder();
    TempEncoder.copyBufferToBuffer(LayoutBaseBuffer,0,LAST_LayeredAlivenumBuffer,0,totalLayers*4);
    let command = TempEncoder.finish();
    device.queue.submit([command]);
    //把新的base数据拷贝到OldDataAliveBuffer里，以供下一个for pass 1，作为基准使用
    //将新的newDataAliveBuffer的数据置空


    device.queue.writeBuffer(LayoutBaseBuffer,0,new Uint32Array(totalLayers).fill(0));
    device.queue.writeBuffer(IndirectAlivenumBuffer,0,new Uint32Array([4,0,0,0]));
    device.queue.writeBuffer(justOffsetBuffer,0,new Uint32Array(totalLayers).fill(0));  

}



const loadImgBitmap = async (url:string) => {
    const res = await axios.get(url,{responseType:"blob"});

    const bitmap = await createImageBitmap(res.data,{
        colorSpaceConversion:"none"
    });
    return bitmap;
}

const getTexture =async (url:string,label:string):Promise<GPUTexture> => {
    device = device!;
    const blob = await axios.get(url,{responseType:"blob"});
    const bitmap = await createImageBitmap(blob.data,{
        imageOrientation:"none",
        premultiplyAlpha:"none"
    });
    const texture = device.createTexture({
        label,
        size:[bitmap.width,bitmap.height],
        format:"rgba8unorm",
        usage:GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC |
                GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    device.queue.copyExternalImageToTexture(
        {source:bitmap,flipY:true},
        {texture},
        {width:bitmap.width , height:bitmap.height}
    );
    return texture;
}

const getReparsedTexture = async (url:string,label:string):Promise<GPUTexture> =>{
    //思路:
    //用rgba8unorm来加载纹理
    //用一个中转buffer,从该纹理中读出数据
    //创建一个rg32float纹理
    //用buffer作为数据源来填充该纹理,宽度/2
    device = device!;

    const RGBA_Tex = await getTexture(url,"rgba8unorm Texture");
    const RG_Tex = device.createTexture({
        label:label,
        size:[RGBA_Tex.width/2,RGBA_Tex.height],
        format:"rg32float",
        usage:GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST |
              GPUTextureUsage.RENDER_ATTACHMENT
    });

    const TransferBuffer = device.createBuffer({
        label:"transfer buffer",
        size:4*RGBA_Tex.width*RGBA_Tex.height,
        usage:GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    const tempEncoder = device.createCommandEncoder({
        label:"transfer  Encoder",
    });
    tempEncoder.copyTextureToBuffer(
        {texture:RGBA_Tex,mipLevel: 0, origin: [0, 0, 0], aspect: "all"},
        {buffer:TransferBuffer,offset: 0, bytesPerRow: RGBA_Tex.width * 4, rowsPerImage: RGBA_Tex.height},
        [RGBA_Tex.width,RGBA_Tex.height]
    );
    tempEncoder.copyBufferToTexture(
        {buffer:TransferBuffer, offset: 0, bytesPerRow: RGBA_Tex.width * 4, rowsPerImage: RGBA_Tex.height},
        {texture:RG_Tex, mipLevel: 0, origin: [0, 0, 0], aspect: "all"},
        [RGBA_Tex.width/2,RGBA_Tex.height]
    );
    const commandBuffer = tempEncoder.finish();
    device.queue.submit([commandBuffer]);

    return RG_Tex;
}

const rand = (min:number,max:number)=>{
    return Math.random()*(max-min)+min;
}

export {
    Myprepare,
    Myrender,
    setCanvas,
    Debug
    
}