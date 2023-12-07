import axios from "axios";
import { makeShaderDataDefinitions, makeStructuredView, type StructuredView } from "webgpu-utils";
import HeightTexBuilder from "./HeightTexBuilder.ts"

///////// some info needed from json file and parser
let maxParticleNum: number = 262144;//65536,262144,1048576,4194304
let textrureResourceArray: Array<string> = [
    "/images/fakeSpeed/fake1.png",
    "/images/fakeSpeed/fake2.png",
    "/images/fakeSpeed/fake3.png",
    "/images/fakeSpeed/fake4.png",
    "/images/fakeSpeed/fake5.png",
    "/images/fakeSpeed/fake6.png",
    "/images/fakeSpeed/fake7.png",
    "/images/fakeSpeed/fake8.png",
    "/images/fakeSpeed/fake9.png",
    "/images/fakeSpeed/fake10.png",
]
let layeredHeightArray = [2, 0.5, 3, 1, 4.5, 3, 1, 4, 3];
let heightBufferData = [];
let heightArrUnit: number = 0;
let unitHeight: number = 0.003;
let speedFactor: number = 0.1;
let heightArrayLength = 0;
let layerNum: number = textrureResourceArray.length - 1;
let totalHeight: number = 0;
let speedBoundary: Array<number> = [0.1, 0.9];

///////// env params
let canvas: HTMLCanvasElement;
let adapter: GPUAdapter;
let device: GPUDevice;
let context: GPUCanvasContext;
let format: GPUTextureFormat;

///////// shader modules
let C_module1: GPUShaderModule;
let C_module1_5: GPUShaderModule;
let C_module2: GPUShaderModule;
let R_module: GPUShaderModule;
let C_defs: any; //ShaderDataDefinitions
let C_uniformValues: StructuredView;

///////// params about workgroup and invocation 
let groupNum_x: number;
let groupNum_y: number;

let mapbox_Matrix: Float32Array;

///////// uniform buffer
let uniformbuffer: GPUBuffer;

///////// sampler and textures
let sampler: GPUSampler;
let transformTex: GPUTexture;
let fakeTextureArray: Array<GPUTexture>;
let highTex: GPUTexture;
let lowTex: GPUTexture;

//////// storage buffers
let ParticleInfoBuffer: GPUBuffer;
let ParticleInfoBufferData: Float32Array;

let baseArray: GPUBuffer;
let baseArrayData: Uint32Array;

let LayeredParticleCountBuffer: GPUBuffer;
let LayeredParticleCountBufferData: Uint32Array;

let IndirectDispatchBuffer: GPUBuffer;
let IndirectDispatchBufferData: Uint32Array;

let IndexArray: GPUBuffer;
let IndexArrayData: Uint32Array;

let justOffsetBuffer: GPUBuffer;
let justOffsetBufferData: Uint32Array;

let heightBuffer: GPUBuffer;

let newBaseArrayBuffer: GPUBuffer;

let nowLayerBuffers: Array<GPUBuffer>;

///////// Layout and Bindgroup
let uniformBindGroupLayout: GPUBindGroupLayout;
let uniformBindGroup: GPUBindGroup;

let textureBindGroupLayout: GPUBindGroupLayout;
let textureBindGroups: Array<GPUBindGroup> = new Array(10);

let storageBindGroupLayout1: GPUBindGroupLayout;
let storageBindGroupLayout1_5: GPUBindGroupLayout;
let storageBindGroupLayout2: GPUBindGroupLayout;

let storageBindGroup1: GPUBindGroup;
let storageBindGroup1_5: GPUBindGroup;
let storageBindGroup2: GPUBindGroup;

let R_bindGroupLayout: GPUBindGroupLayout;
let R_bindgroup: GPUBindGroup;

///////// Layout and pipeline
let C_pipelineLayout1: GPUPipelineLayout;
let C_pipelineLayout1_5: GPUPipelineLayout;
let C_pipelineLayout2: GPUPipelineLayout;

let C_pipeline1: GPUComputePipeline;
let C_pipeline1_5: GPUComputePipeline;
let C_pipeline2: GPUComputePipeline;

let R_pipelineLayout: GPUPipelineLayout;
let R_pipeline: GPURenderPipeline;

let passDescriptor: GPURenderPassDescriptor;
let renderBundleEncoder: GPURenderBundleEncoder;
let renderBundle: GPURenderBundle;

///////// for debug
let count: number = 0;

let testBuffer_float: GPUBuffer;
let testBufferData_float: Float32Array;

let testBuffer_uint: GPUBuffer;
let testBufferData_uint: Uint32Array;


const main = async (canvasElement: HTMLCanvasElement, matrix: Array<number>) => {
    //example:
    setCanvas(canvasElement);
    await Myprepare();
    Myrender(matrix);
}

const setCanvas = (cnavasElement: HTMLCanvasElement) => {
    canvas = cnavasElement;
}


const Myprepare = async () => {

    ////////////////////////////env configure/////////////////////////////

    adapter = (await navigator.gpu.requestAdapter()!)!;
    device = await adapter?.requestDevice()!;

    context = canvas.getContext("webgpu")!;
    format = navigator.gpu.getPreferredCanvasFormat()!;

    context.configure({
        format,
        device,
        alphaMode: "premultiplied"
    });


    ///////////////////////////shaders configure///////////////////////////

    const C1_shadersrc = (await axios.get("/shaders/compute1.wgsl")).data;
    const C15_shadersrc = (await axios.get("/shaders/compute1_5.wgsl")).data;
    const C2_shadersrc = (await axios.get("/shaders/compute2.wgsl")).data;
    const R_shadersrc = (await axios.get("/shaders/render.wgsl")).data;

    C_defs = makeShaderDataDefinitions(C1_shadersrc);
    C_uniformValues = makeStructuredView(C_defs.uniforms.ublock);

    C_module1 = device.createShaderModule({
        label: "compute shader module 1.0",
        code: C1_shadersrc,
    });
    C_module1_5 = device.createShaderModule({
        label: "compute shader module 1.5",
        code: C15_shadersrc,
    })
    C_module2 = device.createShaderModule({
        label: "compute shader module 2.0",
        code: C2_shadersrc,
    })
    R_module = device.createShaderModule({
        label: "render shader module",
        code: R_shadersrc,
    })

    //generate height buffer data
    let heightTexBuilder = new HeightTexBuilder(layeredHeightArray);

    heightTexBuilder.getHeightBufferData2();
    heightBufferData = heightTexBuilder.TextureData2;
    totalHeight = heightTexBuilder.totalHeight;
    heightArrayLength = heightBufferData.length;
    heightArrUnit = heightTexBuilder.unit;



    ///////////////////////////buffer configure///////////////////////////

    ///////for uniform buffer  需注意，尤其是groupnum等数值的计算
    uniformbuffer = device.createBuffer({
        label: "uniformbuffer",
        size: C_uniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });


    ///////for texture
    fakeTextureArray = new Array(10);
    for (let i = 0; i < textrureResourceArray.length; i++) {
        fakeTextureArray[i] = (await getTexture(textrureResourceArray[i], `fake texture ${i}`));
    }

    transformTex = await getReparsedTexture("/images/project/projection.png", "transform texture");
    sampler = device.createSampler({
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
    });

    //////for storage buffer 
    ///
    ParticleInfoBufferData = new Float32Array(maxParticleNum * 4);
    for (let i = 0; i < maxParticleNum; i++) {
        ParticleInfoBufferData[i * 4 + 0] = Math.random();
        ParticleInfoBufferData[i * 4 + 1] = Math.random();
        ParticleInfoBufferData[i * 4 + 2] = 0.0;
        ParticleInfoBufferData[i * 4 + 3] = 0.0;
    }

    ParticleInfoBuffer = device.createBuffer({
        label: "ParticleInfoBuffer",
        size: 4 * maxParticleNum * 4,//vec4 (x,y,z,speedRate)
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    device.queue.writeBuffer(ParticleInfoBuffer, 0, ParticleInfoBufferData);

    ///
    baseArrayData = new Uint32Array(layerNum + 1).fill(maxParticleNum);
    baseArrayData[0] = 0;

    baseArray = device.createBuffer({
        label: "baseArray",
        size: baseArrayData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    })
    device.queue.writeBuffer(baseArray, 0, baseArrayData);

    ///
    LayeredParticleCountBufferData = new Uint32Array((layerNum + 1)).fill(0);

    LayeredParticleCountBuffer = device.createBuffer({
        label: "LayeredParticleCountBuffer",
        size: LayeredParticleCountBufferData.byteLength,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    })
    device.queue.writeBuffer(LayeredParticleCountBuffer, 0, LayeredParticleCountBufferData);

    ///
    IndirectDispatchBufferData = new Uint32Array((layerNum) * 3);
    for (let i = 0; i < layerNum; i++) {
        IndirectDispatchBufferData[i * 3 + 0] = 0;
        IndirectDispatchBufferData[i * 3 + 1] = 0;
        IndirectDispatchBufferData[i * 3 + 2] = 1;
    }

    let MAX_WORK_GROUP_BLOCK_SIZE = Math.sqrt(device.limits.maxComputeInvocationsPerWorkgroup);//16
    const unitNum_x = Math.ceil(Math.sqrt(maxParticleNum));
    const unitNum_y = Math.ceil(maxParticleNum / unitNum_x);

    groupNum_x = Math.ceil(unitNum_x / MAX_WORK_GROUP_BLOCK_SIZE);
    groupNum_y = Math.ceil(unitNum_y / MAX_WORK_GROUP_BLOCK_SIZE);

    IndirectDispatchBufferData[0] = groupNum_x;
    IndirectDispatchBufferData[1] = groupNum_y;

    IndirectDispatchBuffer = device.createBuffer({
        label: "IndirectDispatchBuffer",
        size: IndirectDispatchBufferData.byteLength,
        usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    })
    device.queue.writeBuffer(IndirectDispatchBuffer, 0, IndirectDispatchBufferData);

    ///
    IndexArrayData = new Uint32Array(maxParticleNum);
    for (let i = 0; i < maxParticleNum; i++) {
        IndexArrayData[i] = i;
    }
    IndexArray = device.createBuffer({
        label: "IndexArray",
        size: IndexArrayData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    })
    device.queue.writeBuffer(IndexArray, 0, IndexArrayData);


    ///
    justOffsetBufferData = new Uint32Array(layerNum + 1).fill(0);
    justOffsetBuffer = device.createBuffer({
        label: "justOffsetBuffer",
        size: justOffsetBufferData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    device.queue.writeBuffer(justOffsetBuffer, 0, justOffsetBufferData);


    ///
    newBaseArrayBuffer = device.createBuffer({
        label: "newBaseArrayBuffer",
        size: 4 * layerNum + 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    device.queue.writeBuffer(newBaseArrayBuffer, 0, new Uint32Array(layerNum + 1).fill(0));


    ///
    heightBuffer = device.createBuffer({
        label: "heightBuffer",
        size: heightBufferData.length * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })
    device.queue.writeBuffer(heightBuffer, 0, new Float32Array(heightBufferData));


    ///
    nowLayerBuffers = new Array(layerNum);
    for (let i = 0; i < layerNum; i++) {

        let nlayerBuffer = device.createBuffer({
            label: `now buffer ${i}`,
            size: 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });
        device.queue.writeBuffer(nlayerBuffer, 0, new Uint32Array([i]));
        nowLayerBuffers[i] = nlayerBuffer;
    }


    ///////////////////////////bindgroup configure///////////////////////////

    ////////for uniformBuffer BindGroup
    uniformBindGroupLayout = device.createBindGroupLayout({
        label: "uniformBindGroupLayout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" }
            }
        ]
    });

    uniformBindGroup = device.createBindGroup({
        label: "uniformBindGroup",
        layout: uniformBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: uniformbuffer } },
        ]
    });

    ////////for texture BindGroup
    textureBindGroupLayout = device.createBindGroupLayout({
        label: "textureBindGroupLayout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                sampler: { type: "non-filtering" }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                texture: { sampleType: "unfilterable-float", viewDimension: "2d" }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                texture: { sampleType: "unfilterable-float", viewDimension: "2d" }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }
        ]
    });

    for (let i = 0; i < textrureResourceArray.length - 1; i++) {
        lowTex = fakeTextureArray[i];
        highTex = fakeTextureArray[i + 1];
        let nowLayerBuf = nowLayerBuffers[i];

        let texBG = device.createBindGroup({
            label: "textureBindGroup",
            layout: textureBindGroupLayout,
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: highTex.createView() },
                { binding: 2, resource: lowTex.createView() },
                { binding: 3, resource: { buffer: nowLayerBuf } }
            ]
        });

        textureBindGroups[i] = texBG;
    }

    ////////for storageBuffer BindGroup
    storageBindGroupLayout1 = device.createBindGroupLayout({
        label: "storageBindGroupLayout1",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            },
            {
                binding: 4,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            },
            {
                binding: 5,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            },
        ]
    })
    storageBindGroup1 = device.createBindGroup({
        label: "storageBindGroup1",
        layout: storageBindGroupLayout1,
        entries: [
            { binding: 0, resource: { buffer: ParticleInfoBuffer } },
            { binding: 1, resource: { buffer: IndirectDispatchBuffer } },
            { binding: 2, resource: { buffer: baseArray } },
            { binding: 3, resource: { buffer: IndexArray } },
            { binding: 4, resource: { buffer: LayeredParticleCountBuffer } },
            { binding: 5, resource: { buffer: heightBuffer } }
        ]
    });


    storageBindGroupLayout1_5 = device.createBindGroupLayout({
        label: "storageBindGroupLayout1_5",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            },
        ]
    })
    storageBindGroup1_5 = device.createBindGroup({
        label: "storageBindGroup1_5",
        layout: storageBindGroupLayout1_5,
        entries: [
            { binding: 0, resource: { buffer: IndirectDispatchBuffer } },
            { binding: 1, resource: { buffer: LayeredParticleCountBuffer } },
            { binding: 2, resource: { buffer: newBaseArrayBuffer } }
        ]
    })


    storageBindGroupLayout2 = device.createBindGroupLayout({
        label: "storageBindGroupLayout2",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            },
            {
                binding: 4,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            }
        ]
    });

    storageBindGroup2 = device.createBindGroup({
        label: "storageBindGroup2",
        layout: storageBindGroupLayout2,
        entries: [
            { binding: 0, resource: { buffer: ParticleInfoBuffer } },
            { binding: 1, resource: { buffer: IndexArray } },
            { binding: 2, resource: { buffer: justOffsetBuffer } },
            { binding: 3, resource: { buffer: newBaseArrayBuffer } },
            { binding: 4, resource: { buffer: heightBuffer } }
        ]
    });


    ////////for renderPass BindGroup
    R_bindGroupLayout = device.createBindGroupLayout({
        label: "R_bindGroupLayout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: "uniform" }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                sampler: { type: "non-filtering" }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                texture: { sampleType: "unfilterable-float", viewDimension: "2d" }
            },
            {
                binding: 3,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: "read-only-storage" }
            },
            {
                binding: 4,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: "read-only-storage" }
            }
        ]
    });

    R_bindgroup = device.createBindGroup({
        label: "R_bindgroup",
        layout: R_bindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: uniformbuffer } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: transformTex.createView() },
            { binding: 3, resource: { buffer: IndexArray } },
            { binding: 4, resource: { buffer: ParticleInfoBuffer } },
        ],
    });


    ///////////////////////////pipeline configure///////////////////////////

    C_pipelineLayout1 = device.createPipelineLayout({
        label: "C_pipelineLayout1",
        bindGroupLayouts: [
            uniformBindGroupLayout,
            textureBindGroupLayout,
            storageBindGroupLayout1,
        ]
    });

    C_pipeline1 = device.createComputePipeline({
        label: "C_pipeline1",
        layout: C_pipelineLayout1,
        compute: {
            module: C_module1,
            entryPoint: "cMain",
            constants: {
                blockSize: MAX_WORK_GROUP_BLOCK_SIZE,/////note!!!!
            }
        }
    })

    C_pipelineLayout1_5 = device.createPipelineLayout({
        label: "C_pipelineLayout1_5",
        bindGroupLayouts: [
            uniformBindGroupLayout,
            storageBindGroupLayout1_5,
        ]
    })

    C_pipeline1_5 = device.createComputePipeline({
        label: "C_pipeline1_5",
        layout: C_pipelineLayout1_5,
        compute: {
            module: C_module1_5,
            entryPoint: "cMain",
            constants: {
                blockSize: MAX_WORK_GROUP_BLOCK_SIZE
            }
        }
    })

    C_pipelineLayout2 = device.createPipelineLayout({
        label: "C_pipelineLayout2",
        bindGroupLayouts: [
            uniformBindGroupLayout,
            storageBindGroupLayout2,
        ]
    })

    C_pipeline2 = device.createComputePipeline({
        label: "C_pipeline2",
        layout: C_pipelineLayout2,
        compute: {
            module: C_module2,
            entryPoint: "cMain",
            constants: {
                blockSize: MAX_WORK_GROUP_BLOCK_SIZE,/////note!!!!
                groupNum: groupNum_x,
            }
        },
    })



    R_pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            R_bindGroupLayout
        ]
    });

    R_pipeline = device.createRenderPipeline({
        label: "R_pipeline",
        layout: R_pipelineLayout,
        vertex: {
            module: R_module,
            entryPoint: "vMain",
        },
        fragment: {
            module: R_module,
            entryPoint: "fMain",
            targets: [
                {
                    format: format,
                }
            ]
        },
        primitive: {
            topology: "triangle-strip"
        }
    })


    passDescriptor = {
        label: "passDescriptor",
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                resolveTarget: undefined,
                clearValue: [0.0, 0.0, 0.0, 0.0],
                loadOp: "clear",
                storeOp: "store",
            }
        ]
    }

    renderBundleEncoder = device.createRenderBundleEncoder({
        label: "renderBundleEncoder",
        colorFormats: [format]
    })

    renderBundleEncoder.setPipeline(R_pipeline);
    renderBundleEncoder.setBindGroup(0, R_bindgroup);
    renderBundleEncoder.draw(4, maxParticleNum, 0, 0);
    renderBundle = renderBundleEncoder.finish(passDescriptor);


    ///////////////////////////debug configure///////////////////////////

    testBufferData_float = new Float32Array(maxParticleNum);
    testBuffer_float = device.createBuffer({
        label: "test buffer for float",
        size: testBufferData_float.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    testBufferData_uint = new Uint32Array(maxParticleNum);
    testBuffer_uint = device.createBuffer({
        label: "test buffer for int ",
        size: testBufferData_uint.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })

    return true;

}

const Myrender = async (matrix: Array<number>) => {

    ///////set uniform values
    mapbox_Matrix = new Float32Array(matrix);
    C_uniformValues.set({
        particleNum: maxParticleNum,
        canvasSize: [canvas.width, canvas.height],
        speedBoundary: speedBoundary,
        matrix: mapbox_Matrix,
        speedFactor: speedFactor,
        layerInfo: {
            layerNum: layerNum,
            totalHeight: totalHeight * unitHeight,
            heightArrayLength: heightArrayLength,
            unitHeight: unitHeight,
        }
    })
    device.queue.writeBuffer(uniformbuffer, 0, C_uniformValues.arrayBuffer);

    /////////////////////////// COMPUTE PHASE ///////////////////////////

    let encoder = device.createCommandEncoder({ label: "compute and render encoder " });
    //////////compute pass 1 
    for (let i = 0; i < layerNum; i++) {
        let computePass1 = encoder.beginComputePass();
        computePass1.setPipeline(C_pipeline1);
        computePass1.setBindGroup(0, uniformBindGroup);
        computePass1.setBindGroup(1, textureBindGroups[i]);//note!!!
        computePass1.setBindGroup(2, storageBindGroup1);
        computePass1.dispatchWorkgroupsIndirect(IndirectDispatchBuffer, i * 3 * 4);

        computePass1.end();
    }

    //////////compute pass 1_5
    let computePass1_5 = encoder.beginComputePass();
    computePass1_5.setPipeline(C_pipeline1_5);
    computePass1_5.setBindGroup(0, uniformBindGroup);
    computePass1_5.setBindGroup(1, storageBindGroup1_5);
    computePass1_5.dispatchWorkgroups(layerNum + 1, 1, 1);//layerNum + 1

    computePass1_5.end();


    //////////compute pass 2
    let computePass2 = encoder.beginComputePass();
    computePass2.setPipeline(C_pipeline2);
    computePass2.setBindGroup(0, uniformBindGroup);
    computePass2.setBindGroup(1, storageBindGroup2);
    computePass2.dispatchWorkgroups(groupNum_x, groupNum_y, 1);

    computePass2.end();
    

    /////////////////////////// RENDER PHASE ///////////////////////////
    context.canvas.width = (context.canvas as HTMLCanvasElement).clientWidth;
    context.canvas.height = (context.canvas as HTMLCanvasElement).clientHeight;

    (passDescriptor.colorAttachments as Array<GPURenderPassColorAttachment>)[0].view = context.getCurrentTexture().createView();

    let render_pass = encoder.beginRenderPass(passDescriptor);
    render_pass.executeBundles([renderBundle]);
    render_pass.end();


    /////////////////////////// Finish ///////////////////////////
    let commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);

    ////for debug
    // if(count%100===0 && count!==0)
    // {
    //     await Debug();
    // }
    // count++;

    /////////////////////////// POST-PROCESS PHASE ///////////////////////////    
    await postProcess();
}


const postProcess = async () => {

    let TempEncoder = device.createCommandEncoder();
    TempEncoder.copyBufferToBuffer(newBaseArrayBuffer, 0, baseArray, 0, (layerNum + 1) * 4);// update base Array
    let command = TempEncoder.finish();
    device.queue.submit([command]);

    for (let i = 0; i < layerNum + 1; i++) {
        LayeredParticleCountBufferData[i] = 0;
    }
    device.queue.writeBuffer(LayeredParticleCountBuffer, 0, LayeredParticleCountBufferData);

    device.queue.writeBuffer(justOffsetBuffer, 0, new Uint32Array(layerNum + 1).fill(0));
    device.queue.writeBuffer(newBaseArrayBuffer, 0, new Uint32Array(layerNum + 1).fill(0));
}

const Debug = async () => {
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
    DebugEncoder.copyBufferToBuffer(IndirectDispatchBuffer, 0, testBuffer_uint, 0, (layerNum) * 3 * 4);

    let command = DebugEncoder.finish();
    device.queue.submit([command]);

    await testBuffer_uint.mapAsync(GPUMapMode.READ);
    let partResult2 = new Uint32Array(testBuffer_uint.getMappedRange());
    let visualResult2 = [...partResult2];
    console.log("IndirectDispatchBuffer ", visualResult2);
    testBuffer_uint.unmap();

}


const getTexture = async (url: string, label: string): Promise<GPUTexture> => {
    device = device!;
    const blob = await axios.get(url, { responseType: "blob" });
    const bitmap = await createImageBitmap(blob.data, {
        imageOrientation: "none",
        premultiplyAlpha: "none"
    });
    const texture = device.createTexture({
        label,
        size: [bitmap.width, bitmap.height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC |
            GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    device.queue.copyExternalImageToTexture(
        { source: bitmap, flipY: true },
        { texture },
        { width: bitmap.width, height: bitmap.height }
    );
    return texture;
}

const getReparsedTexture = async (url: string, label: string): Promise<GPUTexture> => {
    device = device!;

    const RGBA_Tex = await getTexture(url, "rgba8unorm Texture");
    const RG_Tex = device.createTexture({
        label: label,
        size: [RGBA_Tex.width / 2, RGBA_Tex.height],
        format: "rg32float",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT
    });

    const TransferBuffer = device.createBuffer({
        label: "transfer buffer",
        size: 4 * RGBA_Tex.width * RGBA_Tex.height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    const tempEncoder = device.createCommandEncoder({
        label: "transfer  Encoder",
    });
    tempEncoder.copyTextureToBuffer(
        { texture: RGBA_Tex, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },
        { buffer: TransferBuffer, offset: 0, bytesPerRow: RGBA_Tex.width * 4, rowsPerImage: RGBA_Tex.height },
        [RGBA_Tex.width, RGBA_Tex.height]
    );
    tempEncoder.copyBufferToTexture(
        { buffer: TransferBuffer, offset: 0, bytesPerRow: RGBA_Tex.width * 4, rowsPerImage: RGBA_Tex.height },
        { texture: RG_Tex, mipLevel: 0, origin: [0, 0, 0], aspect: "all" },
        [RGBA_Tex.width / 2, RGBA_Tex.height]
    );
    const commandBuffer = tempEncoder.finish();
    device.queue.submit([commandBuffer]);

    return RG_Tex;
}

export {
    Myprepare,
    Myrender,
    setCanvas,
}