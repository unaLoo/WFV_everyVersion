import type Stats from "three/examples/jsm/libs/stats.module";
import { Device } from "./device";
import { DescriptionParser } from "../flowRenderElements/parser";
import { type IntrinsicDefinition, makeShaderDataDefinitions, makeStructuredView, type StructuredView } from "webgpu-utils";
import { Texture } from "./Texture";
import type { FlowFieldController } from "../flowRenderElements/flowfield";


// ---------- CPU-Related Configuration ---------- //

interface CanvasInfo {
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    presentationFormat: GPUTextureFormat,

    // - These are filled out in resizeToDisplaySize
    sampleCount: number,  // can be 1 or 4
    renderTarget: GPUTexture | undefined,
    depthTexture: GPUTexture | undefined,
    renderTargetView: GPUTextureView | undefined,
    depthTextureView: GPUTextureView | undefined,
  };

let canvasInfo: CanvasInfo;
let isOffScreenCanvas: boolean;
let offscreenCanvasWidth: number;
let offscreenCanvasHeight: number;

let parser: DescriptionParser;

let MAX_PARTICLE_NUM = 0;
let MAX_SEGMENT_NUM = 0;
let MAX_WORK_GROUP_BLOCK_SIZE = 0;
let FLOW_BOUNDARY: Array<Number> = [];

let groupNum_x = 0;
let groupNum_y = 0;

let isBusy = false;
let needStop = false;
let renderBundles = true;

let progress = 0.0;
let timeLast = 10.0;
let timeCount = 0.0;
let phaseCount = 0.0;
let progressRate = 0.0;
let startReadIndex = 0;        // 0 -> 1 -> 2 -> ... -> MAX_SEGMENT_NUM - 1 -> 0
let startStorageIndex = 1;     // 1 -> 2 -> ... -> MAX_SEGMENT_NUM - 1 -> 0 -> 1
let textureArraySize = 3.0;

let debugCount = 0;
let uniformView: StructuredView;

// ---------- GPU-Related Configuration --------- //

// WebGPU context
let device: GPUDevice;
let canvas: HTMLCanvasElement;
let context: GPUCanvasContext;

// Shader
let shader_c: GPUShaderModule;
let shader_r: GPUShaderModule;
let shader_dist:GPUShaderModule;
let shader_sort: GPUShaderModule;

// Vertex bindings
let vertexBuffer: GPUBuffer;

// Indirect buffer (no binding use)
let indirectBuffer: GPUBuffer;

// Uniform bindings
let uniformBuffer: GPUBuffer;

let uniformBindGroup: GPUBindGroup;
let uniformBindGroupLayout: GPUBindGroupLayout;

// Texture bindings
let nSampler: GPUSampler;
let depthTexture: GPUTexture;
let upSpeedTexture: Texture;
let seedingTexture: Texture;
let lowTransformTexture: Texture;
let highTransformTexture: Texture;
let flowFieldTextures: Array<Texture> = [];

let textureBindGroup: GPUBindGroup;
let textureBindGroups: Array<GPUBindGroup>;
let textureBindGroupLayout: GPUBindGroupLayout;

// Storage bindings
let mapBuffer: GPUBuffer; // use for debug
let mapBuffer2: GPUBuffer;
let mapBuffer3: GPUBuffer;

let ageBuffer: GPUBuffer;
let aliveNumBuffer: GPUBuffer;
let positionBuffer: GPUBuffer;

let attributeBuffer: GPUBuffer;
let aliveIndexBuffer: GPUBuffer;

let cameraDistBuffer: GPUBuffer;
let cameraDistBufferOG: GPUBuffer;

let renderIndexBuffer: GPUBuffer;
let renderIndexInitData: Uint32Array;

let storageBindGroup_c: GPUBindGroup;
let storageBindGroup_r: GPUBindGroup;
let storageBindGroup_dist: GPUBindGroup;
let storageBindGroup_sort: GPUBindGroup;
let storageBindGroupLayout_c: GPUBindGroupLayout;
let storageBindGroupLayout_r: GPUBindGroupLayout;
let storageBindGroupLayout_dist: GPUBindGroupLayout;
let storageBindGroupLayout_sort: GPUBindGroupLayout;


// Pipeline
let pipeline_c: GPUComputePipeline;
let pipeline_dist: GPUComputePipeline;
let pipeline_sort: GPUComputePipeline;
let pipeline_r: GPURenderPipeline;
let pipelineLayout_c: GPUPipelineLayout;
let pipelineLayout_dist: GPUPipelineLayout;
let pipelineLayout_sort: GPUPipelineLayout;
let pipelineLayout_r: GPUPipelineLayout;

// Render bundle
let renderBundle: GPURenderBundle;

// Render pass
let passDescriptor_r: GPURenderPassDescriptor;

////////////////////////

const rand = (min?: number, max?: number) => {
    if (!min) {
        min = 0;
        max = 1;
    } else if (!max) {
        max = min;
        min = 0;
    }
    return min + Math.random() * (max - min);
}

function encodeFloatToDouble(value: number): Float32Array {
    const result = new Float32Array(2);
    result[0] = value;
    
    const delta = value - result[0];
    result[1] = delta;
    return result;
}

function resizeToDisplaySize(device: GPUDevice, canvasInfo: CanvasInfo) {
    const {
      canvas,
      renderTarget,
      presentationFormat,
      depthTexture,
      sampleCount,
    } = canvasInfo;
    
    let width: number ,height: number;
    if (!isOffScreenCanvas) {
        width = Math.max(1, Math.min(device.limits.maxTextureDimension2D, (canvas as HTMLCanvasElement).clientWidth));
        height = Math.max(1, Math.min(device.limits.maxTextureDimension2D, (canvas as HTMLCanvasElement).clientHeight));
    }
    else {
        width = offscreenCanvasWidth;
        height = offscreenCanvasHeight;
    }
    
    const needResize = !canvasInfo.renderTarget ||
                       width !== canvas.width ||
                       height !== canvas.height;
    if (needResize) {
        if (renderTarget) {
            renderTarget.destroy();
        }
        // if (depthTexture) {
        //     depthTexture.destroy();
        // }

        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;

        if (sampleCount > 1) {
            const newRenderTarget = device.createTexture({
                size: [canvas.width, canvas.height],
                format: presentationFormat,
                sampleCount,
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
            canvasInfo.renderTarget = newRenderTarget;
            canvasInfo.renderTargetView = newRenderTarget.createView();
        }

        // const newDepthTexture = device.createTexture({
        //     size: [canvas.width, canvas.height],
        //     format: 'depth24plus',
        //     sampleCount,
        //     usage: GPUTextureUsage.RENDER_ATTACHMENT,
        // });
        // canvasInfo.depthTexture = newDepthTexture;
        // canvasInfo.depthTextureView = newDepthTexture.createView();
    }

    return needResize;
}

async function loadShader(device: GPUDevice, url: string, label = ""): Promise<{ shader: GPUShaderModule; shaderCode: string; }> {

    const shaderCodeResponse = await fetch(url);
    const shaderCode = await shaderCodeResponse.text();
    const shader = device.createShaderModule({
        label: label,
        code: shaderCode,
    });

    return {
        shader,
        shaderCode
    };
}

function RecordRenderPass(passEncoder: GPURenderBundleEncoder | GPURenderPassEncoder) {

    passEncoder.setPipeline(pipeline_r);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setBindGroup(1, textureBindGroup);
    passEncoder.setBindGroup(2, storageBindGroup_r);

    passEncoder.drawIndirect(indirectBuffer, 0);
}

async function Prepare(offscreenCanvas?: {canvas: OffscreenCanvas, width: number, height: number}) {
    
    // Create parser
    parser = new DescriptionParser("/json/flow_field_description.json");
    await parser.Parsing();

    MAX_PARTICLE_NUM = parser.maxTrajectoryNum;
    console.log("MAX_PARTICLE_NUM",MAX_PARTICLE_NUM);   
    MAX_SEGMENT_NUM = parser.maxSegmentNum;
    FLOW_BOUNDARY = parser.flowBoundary;
    
    // Create device for WebGPU
    device = await Device.Create()
    .then((deviceInstance) => {
        return deviceInstance!.device!;
    });

    console.log("Limits::",device.limits);
    
    // Create canvas context for WebGPU
    canvas = document.getElementById("WebGPUFrame")! as HTMLCanvasElement;
    context = canvas.getContext("webgpu")!;
    canvas.hidden = false;

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: presentationFormat,
        alphaMode: "premultiplied"
    });

    // Create depth texture
    depthTexture = device.createTexture({
        label: "depth texture",
        size: {
            width: canvas.width,
            height: canvas.height,
            depthOrArrayLayers: 1
        },
        mipLevelCount: 1,
        sampleCount: 1,
        dimension: "2d",
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });


    // Make canvas info
    canvasInfo = {
        canvas: canvas,
        context: context,
        presentationFormat: presentationFormat,
        renderTarget: undefined,
        renderTargetView: undefined,
        depthTexture: depthTexture,
        depthTextureView: depthTexture.createView(),
        sampleCount: 1
    }

    // Create shader
    shader_r = (await loadShader(device, "/shaders/trajectory_Point.wgsl", "shader for render pass")).shader;
    let shaderRsults = await loadShader(device, "/shaders/simulation.wgsl", "shader for compute pass");
    shader_c = shaderRsults.shader;
    let shaderCode = shaderRsults.shaderCode;

    shader_dist = (await loadShader(device, "/shaders/buildzArray.wgsl", "shader for data build")).shader;
    
    shader_sort = (await loadShader(device, "/shaders/paraSort.wgsl", "shaders for sort")).shader;

    // Create vertex buffer
    const vertices = new Float32Array([
        // x, y, u, v
        -1.0, -1.0, 0.0, 0.0,
        1.0, -1.0, 1.0, 0.0,
        -1.0, 1.0, 0.0, 1.0,

        1.0, 1.0, 1.0, 1.0
    ]);
    vertexBuffer = device.createBuffer({
        label: "vertex buffer",
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    //Create indirect buffer
    // const drawData = new Uint32Array([
    //     (MAX_SEGMENT_NUM - 1) * 2,  // vertex count
    //     262144,                     // instance count
    //     0,                          //first vertex
    //     0                           // first instance
    // ]);
    const drawData = new Uint32Array([
        4,  // vertex count
        262144,                     // instance count
        0,                          //first vertex
        0                           // first instance
    ]);
    indirectBuffer = device.createBuffer({
        label: "draw indirect buffer",
        size: drawData.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDIRECT
    });
    device.queue.writeBuffer(indirectBuffer, 0, drawData);

    // Create storage buffer
    const defaultPositions = new Float32Array(MAX_PARTICLE_NUM * MAX_SEGMENT_NUM * 3);
    for (let i = 0; i < MAX_PARTICLE_NUM * MAX_SEGMENT_NUM ; ++i) {
        defaultPositions[i*3+0] = rand(0, 1);
        defaultPositions[i*3+1] = rand(0, 1);
        defaultPositions[i*3+2] = rand(0, 1) / 10000;
    }
    positionBuffer = device.createBuffer({
        label: "particle position buffer",
        size: defaultPositions.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    device.queue.writeBuffer(positionBuffer, 0, defaultPositions);

    /////////test 
    //max storage buffer binding size = 134217728 === 262144 * 64 * 2


    const defaultAges = new Float32Array(MAX_PARTICLE_NUM);
    for (let i = 0; i < MAX_PARTICLE_NUM; ++i) {
        // defaultAges[i] = MAX_SEGMENT_NUM * 10.0;
        defaultAges[i] = 0.001;
    }
    ageBuffer = device.createBuffer({
        label: "particel age buffer",
        size: defaultAges.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(ageBuffer, 0, defaultAges);

    const defaultAttributes = new Float32Array(MAX_PARTICLE_NUM * MAX_SEGMENT_NUM);
    for (let i = 0; i < defaultAttributes.length; ++i) {
        defaultAttributes[i] = 0;
    }
    attributeBuffer = device.createBuffer({
        label: "particle attribute buffer",
        size: defaultAttributes.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(attributeBuffer, 0, defaultAttributes);

    const defaultIndices = new Uint32Array(MAX_PARTICLE_NUM);
    for (let i = 0; i < defaultIndices.length; ++i) {
        defaultIndices[i] = 0;
    }
    aliveIndexBuffer = device.createBuffer({
        label: "alive index buffer",
        size: defaultIndices.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    device.queue.writeBuffer(aliveIndexBuffer, 0, defaultIndices);

    aliveNumBuffer = device.createBuffer({
        label: "alive num buffer",
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    device.queue.writeBuffer(aliveNumBuffer, 0, new Uint32Array([0]));

    cameraDistBuffer = device.createBuffer({
        label: "cameraDistBuffer",
        size: MAX_PARTICLE_NUM * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    })
    device.queue.writeBuffer(cameraDistBuffer, 0, new Float32Array(MAX_PARTICLE_NUM).fill(0.1));
    cameraDistBufferOG = device.createBuffer({
        label:"cameraDistBufferOG",
        size: MAX_PARTICLE_NUM * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    })
    device.queue.writeBuffer(cameraDistBufferOG, 0, new Float32Array(MAX_PARTICLE_NUM).fill(0.1));

    renderIndexInitData = new Uint32Array(MAX_PARTICLE_NUM);
    for(let i=0 ;i<renderIndexInitData.length ;i++){
        renderIndexInitData[i] = i;
    }
    renderIndexBuffer = device.createBuffer({
        label: "renderIndexBuffer",
        size: MAX_PARTICLE_NUM * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    })
    device.queue.writeBuffer(renderIndexBuffer, 0, renderIndexInitData);



    // Create map buffer
    mapBuffer = device.createBuffer({
        label: "map buffer",
        size: MAX_PARTICLE_NUM * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    mapBuffer2 = device.createBuffer({
        label: "map buffer",
        size: MAX_PARTICLE_NUM * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    mapBuffer3 = device.createBuffer({
        label: "map buffer 3",
        size: MAX_PARTICLE_NUM * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    // Create sampler
    nSampler = device.createSampler({
        label: "nearest sampler",
        magFilter: "nearest",
        minFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
    });

    // Create texture
    phaseCount = parser.flowFieldResourceArray.length; // the last one is a phase from the end to the head
    timeLast = phaseCount * 150; // 150 frame per timePoint
    textureArraySize = 3;
    upSpeedTexture = await Texture.CreateByUrl(device, "/images/randUpSpeed2.png","up speed texture");//*10
    seedingTexture = await Texture.CreateByUrl(device, parser.seedingResourceArray[0], "seeding texture");
    lowTransformTexture = (await Texture.CreateByUrl(device, parser.transform2DLowResource, "transform low texture (rg32Float)")).Reparsing(device, 2, "rg32float")!;
    highTransformTexture = (await Texture.CreateByUrl(device, parser.transform2DHighResource, "transform high texture (rg32Float)")).Reparsing(device, 2, "rg32float")!;
    flowFieldTextures.push((await Texture.CreateByUrl(device, parser.flowFieldResourceArray[0], "flow field texture 0 (rg32Float)")).Reparsing(device, 2, "rg32float")!);
    flowFieldTextures.push((await Texture.CreateByUrl(device, parser.flowFieldResourceArray[1], "flow field texture 1 (rg32Float)")).Reparsing(device, 2, "rg32float")!);
    flowFieldTextures.push((await Texture.CreateByUrl(device, parser.flowFieldResourceArray[2], "flow field texture 2 (rg32Float)")).Reparsing(device, 2, "rg32float")!);

    // Create unifrom buffer
    MAX_WORK_GROUP_BLOCK_SIZE = Math.sqrt(device.limits.maxComputeInvocationsPerWorkgroup);
    const unitNum_x = Math.ceil(Math.sqrt(MAX_PARTICLE_NUM));
    const unitNum_y = Math.ceil(MAX_PARTICLE_NUM / unitNum_x);
    groupNum_x = Math.ceil(unitNum_x / MAX_WORK_GROUP_BLOCK_SIZE);
    groupNum_y = Math.ceil(unitNum_y / MAX_WORK_GROUP_BLOCK_SIZE);

    const defs = makeShaderDataDefinitions(shaderCode);
    const uniformStruct = defs.structs.UniformBlock;
    uniformView = makeStructuredView(uniformStruct);
    uniformView.set({
        groupSize: [groupNum_x, groupNum_y],
        canvasSize: [canvas.width, canvas.height],
        progress: progress,
        particleNum: MAX_PARTICLE_NUM,
        segmentNum: 0,
        fullLife: 0.002,
        n_fullLife: 0.001,
        dropRate: 0.003,
        dropRateBump: 0.001,
        speedFactor: 1.0,
        randomSeed: Math.random(),
        startStorageIndex: 0,
        startReadIndex: 0,
        fillWidth: 1.0,
        aaWidth: 2.0,
        maxParticleNum: MAX_PARTICLE_NUM,
        maxSegmentNum: 0,
        flowBoundary: FLOW_BOUNDARY,
        u_centerHigh: [0.0, 0.0],
        u_centerLow: [0.0, 0.0],
        u_matrix: new Float32Array(4)
    });
    uniformBuffer = device.createBuffer({
        label: "uniform buffer",
        size: uniformView.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformView.arrayBuffer);

    // Create binding group layout
    uniformBindGroupLayout = device.createBindGroupLayout({
        label: "binding group layout for uniforms",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {type: "uniform"}
            },
        ],
    });

    textureBindGroupLayout = device.createBindGroupLayout({
        label: "binding group layout for textures and samplers",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {type: "non-filtering"}
            },
            {
                binding: 1,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                texture: {sampleType: "unfilterable-float", viewDimension: "2d"}
            },
            {
                binding: 2,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                texture: {sampleType: "unfilterable-float", viewDimension: "2d"}
            },
            {
                binding: 3,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                texture: {sampleType: "float", viewDimension: "2d"}
            },
            {
                binding: 4,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                texture: {sampleType: "unfilterable-float", viewDimension: "2d"}
            },
            {
                binding: 5,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                texture: {sampleType: "unfilterable-float", viewDimension: "2d"}
            },
            {
                binding: 6,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                texture: {sampleType: "unfilterable-float", viewDimension: "2d"}
            },
        ],
    });


    storageBindGroupLayout_c = device.createBindGroupLayout({
        label: "binding group layout for storage in compute pass",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "storage"}
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "storage"}
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "storage"}
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "storage"}
            },
            {
                binding: 4,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "storage"}
            },
        ],
    });

    storageBindGroupLayout_r = device.createBindGroupLayout({
        label: "binding group layout for storage in render pass",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {type: "read-only-storage"}
            },
            {
                binding: 1,
                visibility: GPUShaderStage.VERTEX,
                buffer: {type: "read-only-storage"}
            },
            {
                binding: 2,
                visibility: GPUShaderStage.VERTEX,
                buffer: {type: "read-only-storage"}
            },
        ],
    });

    storageBindGroupLayout_dist = device.createBindGroupLayout({
        label: "binding group layout for storage in camaera dist compute pass",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "read-only-storage"}
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "storage"}
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "storage"}
            },
            {
                binding: 3,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "storage"}
            },
        ],
    });

    storageBindGroupLayout_sort = device.createBindGroupLayout({
        label:"binding group layout for sorting pass",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "storage"}
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {type: "storage"}
            }
        ]
    });

    // Create binding group
    uniformBindGroup = device.createBindGroup({
        label: "binding group for uniforms",
        layout: uniformBindGroupLayout,
        entries: [
            {binding: 0, resource: {buffer: uniformBuffer}},
        ]
    });

    textureBindGroups = [

        device.createBindGroup({
            label: "bind group 0 for textures and samplers",
            layout: textureBindGroupLayout,
            entries: [
                {binding: 0, resource: nSampler},
                {binding: 1, resource: flowFieldTextures[0].CreateView()!},
                {binding: 2, resource: flowFieldTextures[1].CreateView()!},
                {binding: 3, resource: seedingTexture.CreateView()!},
                {binding: 4, resource: highTransformTexture.CreateView()!},
                {binding: 5, resource: lowTransformTexture.CreateView()!},
                {binding: 6, resource: upSpeedTexture.CreateView()!},
            ]
        }),
    
        device.createBindGroup({
            label: "bind group 1 for textures and samplers",
            layout: textureBindGroupLayout,
            entries: [
                {binding: 0, resource: nSampler},
                {binding: 1, resource: flowFieldTextures[1].CreateView()!},
                {binding: 2, resource: flowFieldTextures[2].CreateView()!},
                {binding: 3, resource: seedingTexture.CreateView()!},
                {binding: 4, resource: highTransformTexture.CreateView()!},
                {binding: 5, resource: lowTransformTexture.CreateView()!},
                {binding: 6, resource: upSpeedTexture.CreateView()!},
            ]
        }),
    
        device.createBindGroup({
            label: "bind group 2 for textures and samplers",
            layout: textureBindGroupLayout,
            entries: [
                {binding: 0, resource: nSampler},
                {binding: 1, resource: flowFieldTextures[2].CreateView()!},
                {binding: 2, resource: flowFieldTextures[0].CreateView()!},
                {binding: 3, resource: seedingTexture.CreateView()!},
                {binding: 4, resource: highTransformTexture.CreateView()!},
                {binding: 5, resource: lowTransformTexture.CreateView()!},
                {binding: 6, resource: upSpeedTexture.CreateView()!},
            ]
        })
    ]

    textureBindGroup = textureBindGroups[0];

    storageBindGroup_c = device.createBindGroup({
        label: "binding group for storage in compute pass",
        layout: storageBindGroupLayout_c,
        entries: [
            {binding: 0, resource: {buffer: positionBuffer}},
            {binding: 1, resource: {buffer: aliveIndexBuffer}},
            {binding: 2, resource: {buffer: aliveNumBuffer}},
            {binding: 3, resource: {buffer: ageBuffer}},
            {binding: 4, resource: {buffer: attributeBuffer}},

        ]
    });

    storageBindGroup_r = device.createBindGroup({
        label: "binding group for storage in render pass",
        layout: storageBindGroupLayout_r,
        entries: [
            {binding: 0, resource: {buffer: positionBuffer}},
            // {binding: 1, resource: {buffer: renderIndexBuffer}},
            {binding: 1, resource: {buffer: aliveIndexBuffer}},
            {binding: 2, resource: {buffer: attributeBuffer}},
            
        ]
    });

    storageBindGroup_dist = device.createBindGroup({
        label:"binding group for camera dist compute pass",
        layout: storageBindGroupLayout_dist,
        entries: [
            {binding: 0, resource: {buffer: positionBuffer}},
            // {binding: 1, resource: {buffer: renderIndexBuffer}},
            {binding: 1, resource: {buffer: aliveIndexBuffer}},

            {binding: 2, resource: {buffer: cameraDistBuffer}},
            {binding: 3, resource: {buffer: cameraDistBufferOG}}
        ]
    })

    storageBindGroup_sort = device.createBindGroup({
        label:"binding group for sorting pass",
        layout: storageBindGroupLayout_sort,
        entries: [
            {binding: 0, resource: {buffer: cameraDistBuffer}},
            // {binding: 1, resource: {buffer: renderIndexBuffer}}
            {binding: 1, resource: {buffer: aliveIndexBuffer}}

        ]
    })

    // Create pipeline layout
    pipelineLayout_c = device.createPipelineLayout({
        label: "compute pipeline layout",
        bindGroupLayouts: [
            uniformBindGroupLayout,
            textureBindGroupLayout,
            storageBindGroupLayout_c, 
        ]
    });

    pipelineLayout_dist = device.createPipelineLayout({
        label:"pipelineLayout_dist",
        bindGroupLayouts:[
            uniformBindGroupLayout,
            textureBindGroupLayout,
            storageBindGroupLayout_dist, 
        ]
    })
    
    pipelineLayout_sort = device.createPipelineLayout({
        label:"piplineLayout_sort",
        bindGroupLayouts:[
            storageBindGroupLayout_sort
        ]
    })

    pipelineLayout_r = device.createPipelineLayout({
        label: "render pipeline layout",
        bindGroupLayouts: [
            uniformBindGroupLayout,
            textureBindGroupLayout,
            storageBindGroupLayout_r, 
        ]
    });

    // Create compute pipeline
    pipeline_c = device.createComputePipeline({
        label: "computing pipeline pipeline_c",
        layout: pipelineLayout_c,
        compute: {
            module: shader_c,
            entryPoint: "cMain",
            constants: {
                blockSize: MAX_WORK_GROUP_BLOCK_SIZE,
            }
        }
    });

    pipeline_dist = device.createComputePipeline({
        label: "computing pipeline pipeline_dist",
        layout: pipelineLayout_dist,
        compute: {
            module: shader_dist,
            entryPoint: "cMain",
            constants: {
                blockSize: MAX_WORK_GROUP_BLOCK_SIZE,
            }
        }
    });

    // let pipeline_dist2 = device.createComputePipeline({
    //     label: "computing pipeline pipeline_dist",
    //     layout: pipelineLayout_sort,
    //     compute: {
    //         module: shader_sort,
    //         entryPoint: "cMain",
    //         constants: {
    //             blockSize: MAX_WORK_GROUP_BLOCK_SIZE,
    //         }
    //     }
    // });

    pipeline_sort = device.createComputePipeline({
        label: "pipeline_sort",
        layout: pipelineLayout_sort,
        compute: {
            module: shader_sort,
            entryPoint: "cMain",
            constants: {
                blockSize: MAX_WORK_GROUP_BLOCK_SIZE,
                groupNum: groupNum_x,
                _arrLength: 0,
                _cmpOffset: 0,
                _subSize: 0
            }
        }
    })
    // let pip_sort = device.createComputePipeline({
    //     label:"123",
    //     layout:pipelineLayout_c,
    //     compute:{
    //         module: shader_sort,
    //         entryPoint: "cMain",
    //     }
    // })

    // Create rendering pipeline
    pipeline_r = device.createRenderPipeline({
        label: "rendering pipeline",
        layout: pipelineLayout_r,
        vertex: {
            module: shader_r,
            entryPoint: "vMain",
            buffers: [
                {
                    arrayStride: 4 * 4,
                    stepMode: "vertex",
                    attributes: [
                        {shaderLocation: 0, offset: 0, format: "float32x2"},
                        {shaderLocation: 1, offset: 2 * 4, format: "float32x2"},
                    ]
                }
            ],
        },
        fragment: {
            module: shader_r,
            entryPoint: "fMain",
            targets: [ 
                {
                    format: presentationFormat, 
                    // blend: {
                    //     color: {
                    //         operation: "add",
                    //         srcFactor: "one",
                    //         dstFactor: "zero",
                    //     },
                    //     alpha: {
                    //         operation: "add",
                    //         srcFactor: "src-alpha",
                    //         dstFactor: "one-minus-src-alpha"
                    //     }
                    // },
                    // writeMask: GPUColorWrite.ALL

                    // blend: {
                    //     color: {
                    //         operation: "add",
                    //         srcFactor: "src-alpha",
                    //         dstFactor: "one-minus-src-alpha"
                    //     },
                    //     alpha: {
                    //         operation: "add",
                    //         srcFactor:"src-alpha",
                    //         dstFactor: "one-minus-src-alpha"
                    //     }
                    // },
                    // writeMask:GPUColorWrite.ALL,

                    blend: {
                        color: {
                            operation: "add",
                            srcFactor: "one",
                            dstFactor: "one-minus-src-alpha"
                        },
                        alpha: {
                            operation: "add",
                            srcFactor: "one",
                            dstFactor: "one"
                        }
                    },
                    writeMask: GPUColorWrite.ALL
                },
            ],
        },
        depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: true,
            depthCompare: "less",
        },
        primitive: {
            topology: "triangle-strip"
        },

        ...(canvasInfo.sampleCount > 1 && {
            multisample: {
              count: canvasInfo.sampleCount,
            },
        }),
    });

    passDescriptor_r = {
        label: "render pass",
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                resolveTarget: undefined,
                clearValue: [0.0, 0.0, 0.0, 0.0],
                loadOp: "clear",
                storeOp: "store"
            }
        ],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1,
            depthLoadOp: "clear",//渲染前的深度值为clear value
            depthStoreOp: "store",//渲染后的深度值,存储
        }
    };
    
    // const renderBundleEncoder = device.createRenderBundleEncoder({
    //     colorFormats: [presentationFormat],
    // });
    // RecordRenderPass(renderBundleEncoder);
    // renderBundle = renderBundleEncoder.finish();

    console.log("blocksize ::", MAX_WORK_GROUP_BLOCK_SIZE);
    console.log("groupNUM",groupNum_x, groupNum_y);
    
    

    return true;
}

function getProgressBetweenTexture() {

    const progress = progressRate * phaseCount;
    return progress - Math.floor(progress);
}

function updateTimeCount(value: number) {
    timeCount = value % timeLast;
}

async function updateProgressRate(value: number) {

    const lastPhase = Math.floor(progressRate * phaseCount) % phaseCount;
    const currentPhase =  Math.floor(value * phaseCount) % phaseCount;
    const nextPhase = (currentPhase + 2) % phaseCount;

    progressRate = value;
    progress = getProgressBetweenTexture();
    
    // Update texture for next nextPhase
    if (currentPhase != lastPhase) {
        textureBindGroup = textureBindGroups[currentPhase % textureArraySize];
        isBusy = !await flowFieldTextures[nextPhase % textureArraySize].UpdateReparsing(device, parser.flowFieldResourceArray[nextPhase]);
    }
}

async function TickLogic(controller: FlowFieldController, matrix: Array<number>, center: Array<number>) {

    needStop = controller.stop;
    // device.queue.writeBuffer(cameraDistBuffer, 0, new Uint32Array(MAX_PARTICLE_NUM));
    // if (!needStop) {
    //     //one frame , one block ,so add 1
    //     startReadIndex = (startReadIndex + 1) % MAX_SEGMENT_NUM;
    //     startStorageIndex = (startStorageIndex + 1) % MAX_SEGMENT_NUM;
    // }

    // segment num no need , for particle
    // if(uniformView.views.segmentNum[0] !== controller.segmentNum) {
    //     //controller functions here
    //     device.queue.writeBuffer(indirectBuffer, 0, new Uint32Array([(controller.segmentNum - 1) * 2]));
    // }

    if (controller.isUnsteady && (!isBusy)) {
        //controller functions here
        updateProgressRate(timeCount / timeLast);
        updateTimeCount(timeCount + 1);
    }

    // Update uniform and storage data
    const relativeToEyeMatrix = matrix.slice();
    const centerX = encodeFloatToDouble(center[0]);
    const centerY = encodeFloatToDouble(center[1]);
    relativeToEyeMatrix[12] += relativeToEyeMatrix[0] * centerX[0] + relativeToEyeMatrix[4] * centerY[0];
    relativeToEyeMatrix[13] += relativeToEyeMatrix[1] * centerX[0] + relativeToEyeMatrix[5] * centerY[0];
    relativeToEyeMatrix[14] += relativeToEyeMatrix[2] * centerX[0] + relativeToEyeMatrix[6] * centerY[0];
    relativeToEyeMatrix[15] += relativeToEyeMatrix[3] * centerX[0] + relativeToEyeMatrix[7] * centerY[0];

    uniformView.set({
        groupSize: [groupNum_x, groupNum_y],
        canvasSize: [canvas.width, canvas.height],
        progress: progress,
        particleNum: controller.particleNum,
        // segmentNum: 0,
        fullLife: MAX_SEGMENT_NUM * 10,
        dropRate: controller.dropRate,
        dropRateBump: controller.dropRateBump,
        speedFactor: controller.speedFactor,
        randomSeed: Math.random(),
        startStorageIndex: startStorageIndex,
        startReadIndex: startReadIndex,
        fillWidth: controller.fillWidth,
        aaWidth: controller.aaWidth,
        maxParticleNum: MAX_PARTICLE_NUM,
        maxSegmentNum: MAX_SEGMENT_NUM,
        flowBoundary: FLOW_BOUNDARY,
        u_centerHigh: [centerX[0], centerY[0]],
        u_centerLow: [centerX[1], centerY[1]],
        u_matrix: relativeToEyeMatrix
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformView.arrayBuffer);
    device.queue.writeBuffer(aliveNumBuffer, 0, new Uint32Array([0]));

    // device.queue.writeBuffer(renderIndexBuffer, 0,renderIndexInitData);

}

// !!! Start Dash !!!
async function TickRender(status: Stats) {
    debugCount ++ ;
    // // Resize display size
    // if (resizeToDisplaySize(device, canvasInfo)) {
    //     if (canvasInfo.sampleCount === 1) {
    //         const colorTexture = context.getCurrentTexture();
    //         (passDescriptor_r.colorAttachments as any)[0].view = colorTexture.createView();
    //     } else {
    //         (passDescriptor_r.colorAttachments as any)[0].view = canvasInfo.renderTargetView;
    //         (passDescriptor_r.colorAttachments as any)[0].resolveTarget = context.getCurrentTexture().createView();
    //     }
    //     (passDescriptor_r.depthStencilAttachment as any).view = canvasInfo.depthTexture!.createView();
    // }

    context.canvas.width = canvas.clientWidth;
    context.canvas.height = canvas.clientHeight;
    (passDescriptor_r.colorAttachments as any)[0].view = context.getCurrentTexture().createView();

    let depthTexture1 = device.createTexture({
        label: "depth texture",
        size: {
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            depthOrArrayLayers: 1,
        },
        // mipLevelCount: 1,
        // sampleCount: 1,
        // dimension: "2d",
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    (passDescriptor_r.depthStencilAttachment as any).view = depthTexture1.createView();



    // Start recoding commands
    const encoder = device.createCommandEncoder({label: "flow visualization encoder"});

    // Compute pass
    if (!needStop) {
        const computePass = encoder.beginComputePass({
            label: "compute pass",
        });
        computePass.setPipeline(pipeline_c);
        computePass.setBindGroup(0, uniformBindGroup);
        computePass.setBindGroup(1, textureBindGroup);
        computePass.setBindGroup(2, storageBindGroup_c);
    
        computePass.dispatchWorkgroups(groupNum_x, groupNum_y);
        computePass.end();
        // Copy data in storage buffer to the map buffer
        encoder.copyBufferToBuffer(aliveNumBuffer, 0, indirectBuffer, 4, 4);
    }

    // init pass :: cameradist, renderIndex, 
    const computeDistPass = encoder.beginComputePass({
        label: "compute camera dist pass",
    });
    computeDistPass.setPipeline(pipeline_dist);
    computeDistPass.setBindGroup(0, uniformBindGroup);
    computeDistPass.setBindGroup(1, textureBindGroup);
    computeDistPass.setBindGroup(2, storageBindGroup_dist);
    
    computeDistPass.dispatchWorkgroups(groupNum_x, groupNum_y);
    computeDistPass.end();

    const BitonicSort = (length: number) => {
        let subSize, compareOfset;
        for (subSize = 2; subSize <= length; subSize *= 2) {
            for (compareOfset = subSize / 2; compareOfset > 0.999; compareOfset /= 2) {

                const pipeline = device?.createComputePipeline({
                    label: "compute pipeline",
                    layout: pipelineLayout_sort,
                    compute: {
                        module: shader_sort,
                        entryPoint: "cMain",
                        constants: {
                            blockSize: MAX_WORK_GROUP_BLOCK_SIZE,
                            groupNum: groupNum_x,
                            _arrLength: length,
                            _cmpOffset: compareOfset,
                            _subSize: subSize
                        }
                    },
                })!;

                //this part can be finished by GPU
                //每个线程就做独立的比较或者交换，各线程互不影响
                //每个线程：compare(i,i+offset,flag)
                let aPass = encoder.beginComputePass()!;
                aPass.setPipeline(pipeline);
                aPass.setBindGroup(0, storageBindGroup_sort);
                aPass.dispatchWorkgroups(groupNum_x, groupNum_y, 1);
                aPass.end();

                // console.log(subSize, compareOfset);
            }
        }
    }

    BitonicSort(MAX_PARTICLE_NUM);



    // Render pass
    // const renderPass = encoder.beginRenderPass(passDescriptor_r);
    // renderPass.setBlendConstant([0.0, 0.0, 0.0, 0.0]);
    // if (false && renderBundles) {
    //     renderPass.executeBundles([renderBundle]);
    // }
    // else {

    //     renderPass.setPipeline(pipeline_r);
    //     renderPass.setVertexBuffer(0, vertexBuffer);
    //     renderPass.setBindGroup(0, uniformBindGroup);
    //     renderPass.setBindGroup(1, textureBindGroup);
    //     renderPass.setBindGroup(2, storageBindGroup_r);
    
    //     renderPass.drawIndirect(indirectBuffer, 0);
    //     // for(let i=0 ;i<MAX_PARTICLE_NUM; i++){
    //     //     renderPass.draw(4,1,0,i);//绘制第i个实例
    //     // }
    //     // renderPass.drawIndexed()
    // }
    // renderPass.end();


    let renderps = encoder.beginRenderPass(passDescriptor_r);
    
    renderps.setPipeline(pipeline_r);
    renderps.setVertexBuffer(0, vertexBuffer);
    renderps.setBindGroup(0, uniformBindGroup);
    renderps.setBindGroup(1, textureBindGroup);
    renderps.setBindGroup(2, storageBindGroup_r);
    // for(let i=0; i<MAX_PARTICLE_NUM; i++){
    //     renderps.draw(4,1,0,i);
    // }
    renderps.drawIndirect(indirectBuffer, 0);
    // renderps.draw(4,262144,0,0)
    renderps.end();


    // End recoding commands
    device.queue.submit([encoder.finish()]);


    // if (debugCount % 400 == 1) {
    //     await Debug();
    // }

    status?.update();
}

async function Tick(controller: FlowFieldController, matrix: Array<number>, center: Array<number>, status: Stats) {

    TickLogic(controller, matrix, center);
    TickRender(status);
}

async function Debug() {
    console.log("map count :: ");
    
    let encoder= device.createCommandEncoder();
    encoder.copyBufferToBuffer(cameraDistBuffer, 0, mapBuffer, 0, MAX_PARTICLE_NUM*4);
    encoder.copyBufferToBuffer(renderIndexBuffer, 0, mapBuffer2, 0, MAX_PARTICLE_NUM*4);
    encoder.copyBufferToBuffer(cameraDistBufferOG, 0, mapBuffer3, 0, MAX_PARTICLE_NUM*4);
    
    device.queue.submit([encoder.finish()]);
    // Map compute results to CPU memory

    await mapBuffer3.mapAsync(GPUMapMode.READ);
    const result3 = new Float32Array(mapBuffer3.getMappedRange());
    console.log("cameraDistBuffer original data:", [...result3]);
    mapBuffer3.unmap();

    await mapBuffer2.mapAsync(GPUMapMode.READ);
    const result2 = new Uint32Array(mapBuffer2.getMappedRange());
    console.log("RenderIndexBuffer data:", [...result2]);
    mapBuffer2.unmap();

    await mapBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(mapBuffer.getMappedRange());
    console.log("Sorted data:", [...result]);
    mapBuffer.unmap();
}

function Destory() {

    // Destroy texture
    flowFieldTextures.forEach((texture) => {
        texture.Destroy();
    });
    seedingTexture.Destroy();
    lowTransformTexture.Destroy();
    highTransformTexture.Destroy();

    // Destroy buffer
    mapBuffer.destroy();
    ageBuffer.destroy();
    vertexBuffer.destroy();
    uniformBuffer.destroy();
    aliveNumBuffer.destroy();
    indirectBuffer.destroy();
    positionBuffer.destroy();
    attributeBuffer.destroy();
    aliveIndexBuffer.destroy();

    // Destroy GPU device
    device.destroy();

    // Hidden canvas
    (canvas as HTMLCanvasElement).hidden = true;
}

export {
    Prepare,
    TickLogic,
    TickRender,
    Tick,
    Destory,
}