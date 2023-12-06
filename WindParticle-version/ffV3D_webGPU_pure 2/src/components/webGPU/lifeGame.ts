/// <reference types="@webgpu/types" />

import axios from "axios";

async function HelloWebGPU(canvas: HTMLCanvasElement) {

    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
    }

    // Requset an adapter
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("No appropriate GPUAdapter found.");
    }

    // Request a device
    const device = await adapter.requestDevice();

    // Configure canvas
    const context = canvas.getContext("webgpu")!;
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat,
    });

    // Create vertex buffer
    const vertices = new Float32Array([
        // x, y
        -0.8, -0.8,
        -0.8, 0.8,
        0.8, -0.8,
        0.8, 0.8
    ]);

    const vertexBuffer = device.createBuffer({
        label: "Cell vertices",
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    // Create uniform buffer
    const GRID_SIZE = 32;
    const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);

    const uniformBuffer = device.createBuffer({
        label: "Grid Uniforms",
        size: uniformArray.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

    // Create storage buffer
    const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);

    const cellStateStorage = [
        device.createBuffer({
            label: "Cell State A",
            size: cellStateArray.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        }),
        device.createBuffer({
            label: "Cell State B",
            size: cellStateArray.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        }),
    ];

    for (let i = 0; i < cellStateArray.length; i += 3) {
        cellStateArray[i] = Math.random() > 0.3 ? 1 : 0;
    }
    device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);

    // 
    const WORKGROUP_SIZE = 8;
    

    // Set shader
    const vertexBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 8,
        attributes: [{
            format: "float32x2",
            offset: 0,
            shaderLocation: 0
        }],
    };

    let vertexShaderCode = "";
    let fragmentShaderCode = "";
    let computeShaderCode = ``;
    await axios.get("/shaders/lifeGame.vert.wgsl")
    .then((response) => {
        vertexShaderCode += response.data;
    });
    await axios.get("/shaders/lifeGame.frag.wgsl")
    .then((response) => {
        fragmentShaderCode += response.data;
    });
    await axios.get("/shaders/lifeGame.compute.wgsl")
    .then((response) => {
        computeShaderCode += response.data;
    });

    const cellVertexShaderModule = device.createShaderModule({
        label: "Cell shader",
        code: vertexShaderCode
    });

    const cellFragmentShaderModule = device.createShaderModule({
        label: "Cell shader",
        code: fragmentShaderCode
    });

    const simulationShaderModule = device.createShaderModule({
        label: "Game of Life simulation shader",
        code: computeShaderCode
    });
    // Create bindGroup layout
    const bindGroupLayout = device.createBindGroupLayout({
        label: "Cell Bind Group Layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
                buffer: { type: "read-only-storage" }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" }
            }
        ]
    });

    // Create binding group
    const bindGroups = [
        device.createBindGroup({
            label: "Cell renderer bind group A",
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {buffer: uniformBuffer}
                } as GPUBindGroupEntry,
                {
                    binding: 1,
                    resource: {buffer: cellStateStorage[0]}
                } as GPUBindGroupEntry,
                {
                    binding: 2,
                    resource: {buffer: cellStateStorage[1]}
                } as GPUBindGroupEntry,
            ],
        }),
        device.createBindGroup({
            label: "Cell renderer bind group B",
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {buffer: uniformBuffer}
                } as GPUBindGroupEntry,
                {
                    binding: 1,
                    resource: {buffer: cellStateStorage[1]}
                } as GPUBindGroupEntry,
                {
                    binding: 2,
                    resource: {buffer: cellStateStorage[0]}
                } as GPUBindGroupEntry,
            ],
        })
    ];

    // Create render pipeline layout
    const pipelineLayout = device.createPipelineLayout({
        label: "Cell Pipeline Layout",
        bindGroupLayouts: [bindGroupLayout],
    });

    // Create render pipeline
    const cellPipeline = device.createRenderPipeline({
        label: "Cell pipeline",
        layout: pipelineLayout,
        vertex: {
            module: cellVertexShaderModule,
            entryPoint: "vertexMain",
            buffers: [vertexBufferLayout]
        },
        fragment: {
            module: cellFragmentShaderModule,
            entryPoint: "fragmentMain",
            targets: [{
                format: canvasFormat
            }]
        },
        primitive: {
            topology: "triangle-strip"
        },
    });

    // Create compute pipeline
    const simulationPipeline = device.createComputePipeline({
        label: "Simulation pipeline",
        layout: pipelineLayout,
        compute: {
            module: simulationShaderModule,
            entryPoint: "computeMain",
            constants: {
                blockSize: WORKGROUP_SIZE,
            }
        }
    });


    // Render loop
    const UPDATE_INTERVAL = 200;
    let step = 0;

    setInterval(updateGrid, UPDATE_INTERVAL);

    function updateGrid() {

        const encoder = device.createCommandEncoder();

        const computePass = encoder.beginComputePass();

        computePass.setPipeline(simulationPipeline);
        // computePass.setBindGroup(0, bindGroups[step % 2]);
        computePass.setBindGroup(0, bindGroups[0]);

        const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
        computePass.dispatchWorkgroups(workgroupCount, workgroupCount);

        computePass.end();

        step++;
    
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                clearValue: [0, 0, 0.4, 1],
                storeOp: "store",
            }]
        });
    
        pass.setPipeline(cellPipeline);
        pass.setVertexBuffer(0, vertexBuffer);
        // pass.setBindGroup(0, bindGroups[step % 2]);
        pass.setBindGroup(0, bindGroups[1]);
        pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE);
    
        pass.end();
    
        // Add a commandBuffer to the queue
        device.queue.submit([encoder.finish()]);
    }
}



export {
    HelloWebGPU
}