import axios from "axios";

const main = async (canvas: HTMLCanvasElement) => {

    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();
    console.log(device?.limits);

    if (!device) {
        console.log('broswer does not support WebGPU');
    }

    const context = canvas.getContext("webgpu")!;
    const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device!,
        format: preferredFormat,
    });

    const shaderSrc = (await axios.get('/shaders/paraSort.wgsl')).data;
    const module = device?.createShaderModule({
        label: "compute module",
        code: shaderSrc
    });

    // const uniformBuffer = device?.createBuffer({
    //     label:'uniform buffer',
    //     size:12,
    //     usage:GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    // });
    // device?.queue.writeBuffer(uniformBuffer!,0,new Uint32Array([8,1,8]));

    // GPU get data from buffer 
    // const input = randomFloatArray(256);
    const input = randomFloatArray(262144);
    const inputBuffer = device?.createBuffer({
        label: 'work buffer',
        size: input.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    device?.queue.writeBuffer(inputBuffer!, 0, input);


    const outputBuffer = device?.createBuffer({
        label: 'output buffer',
        size: input.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    })
    device?.queue.writeBuffer(outputBuffer!, 0, new Float32Array(input.length).fill(0));


    // calculate the workgroup num
    let maxInvocationPerGroup = device?.limits.maxComputeInvocationsPerWorkgroup!;//256
    let maxInvocationPerDimension = Math.ceil(Math.sqrt(maxInvocationPerGroup));
    console.log("maxInvocationPerDimension",maxInvocationPerDimension);//16
    
    const blockSize = maxInvocationPerDimension;//256

    let totalWGnum = Math.ceil(input.length/maxInvocationPerGroup);
    let WGnumPerDimension = Math.ceil(Math.sqrt(totalWGnum));
    
    console.log("blockSize",blockSize);
    console.log("totalWGnum",totalWGnum);
    console.log("WGnumPerDimension",WGnumPerDimension);
    

    
    const bindGroupLayout = device?.createBindGroupLayout({
        label: "bind group layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage"
                }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "storage"
                }
            },
            // {
            //     binding:2,
            //     visibility:GPUShaderStage.COMPUTE,
            //     buffer:{
            //         type:"uniform"
            //     }
            // }
        ]
    })!

    const bindGroup = device?.createBindGroup({
        label: "bind group for work buffer",
        layout: bindGroupLayout!,
        entries: [
            { binding: 0, resource: { buffer: inputBuffer! } },
            { binding: 1, resource: { buffer: outputBuffer! } },
            // { binding:2,resource:{buffer:uniformBuffer!}}
        ]
    })!

    const pipLayout = device!.createPipelineLayout({
        label: "compute pipeline layout",
        bindGroupLayouts: [
            bindGroupLayout!,
        ]
    });

    // const pipeline1 = device?.createComputePipeline({
    //     label:"compute pipeline",
    //     layout:pipLayout,
    //     compute:{
    //         module:module!,
    //         entryPoint:"cMain",
    //         constants:{
    //             blockSize:blockSize,
    //             groupNum:totalWGnum,
    //             _arrLength:8,
    //             _cmpOffset:2,
    //             _subSize:4
    //         }
    //     },
    // })!;


    const readBuffer = device?.createBuffer({
        label: "read buffer",
        size: input.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    })



    //start encoding commands for run computeshaderprogram
    const encoder = device?.createCommandEncoder({
        label: "compute command encoder",
    })!
    let count = 0;

    
    /////real BitonicSort
    const BitonicSort = (nums: Float32Array) => {
        let subSize, compareOfset;
        for (subSize = 2; subSize <= nums.length; subSize *= 2) {
            for (compareOfset = subSize / 2; compareOfset > 0.999; compareOfset /= 2) {

                // device?.queue.writeBuffer(uniformBuffer!,0,new Uint32Array([8,compareOfset,subSize]));
                const pipeline = device?.createComputePipeline({
                    label: "compute pipeline",
                    layout: pipLayout,
                    compute: {
                        module: module!,
                        entryPoint: "cMain",
                        constants: {
                            blockSize: blockSize,
                            groupNum:WGnumPerDimension,
                            _arrLength: nums.length,
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
                aPass.setBindGroup(0, bindGroup);
                aPass.dispatchWorkgroups(WGnumPerDimension, WGnumPerDimension, 1);
                aPass.end();

                console.log(subSize, compareOfset);
                count++;
            }
        }
    }

    BitonicSort(input);

    ///////one time test 
    // let pass = encoder.beginComputePass()!;
    // pass.setPipeline(pipeline1);
    // pass.setBindGroup(0, bindGroup);
    // pass.dispatchWorkgroups(totalWGnum,1,1);
    // pass.end();

    const commandBuffer = encoder!.finish();
    device?.queue.submit([commandBuffer]);
    //over 
    console.log("compute pass count::", count);


    const Debug = async () => {
        let encoder1 = device?.createCommandEncoder();
        encoder1?.copyBufferToBuffer(inputBuffer!, 0, readBuffer!, 0, input.byteLength);
        device?.queue.submit([encoder1?.finish()!]);

        await readBuffer!.mapAsync(GPUMapMode.READ);
        const result = new Float32Array(readBuffer!.getMappedRange());
        const vres = [...result]
        console.log('readBuffer', vres);
        readBuffer?.unmap();
    }

    await Debug();

    // const BitnicSort = (nums:Float32Array) => {
    //     let subSize,compareOfset;
    //     for( subSize = 2; subSize <= nums.length; subSize *= 2) {
    //         for( compareOfset = subSize/2; compareOfset>0.999; compareOfset/=2){
    //             //this part can be finished by GPU
    //             //每个线程就做独立的比较或者交换，各线程互不影响
    //             //每个线程：compare(i,i+offset,flag)
    //             // let aPass = encoder.beginComputePass()!;
    //             // aPass.setPipeline(pipeline);
    //             // aPass.setBindGroup(0, bindGroup);
    //             // aPass.dispatchWorkgroups(nums.length,1,1);
    //             // aPass.end();
    //             console.log(subSize,compareOfset);
    //         }
    //     }
    // }
    // BitnicSort(randomFloatArray(16));
}


const randomFloatArray = (n: number) => {
    const array = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        array[i] = Math.random();
    }
    return array;
};





export {
    main, randomFloatArray
}