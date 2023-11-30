
struct uniformBlock{
    canvasSize:vec2u,
    particleNum:u32,
    deltaHeight:f32,
    totalLayers:u32,
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,
}

struct vertexInput{
    @builtin(global_invocation_id) iid:vec3u,
    @builtin(workgroup_id) wid:vec3u,
    //这两个应是一样的
}

@group(0) @binding(0) var<uniform> ublock:uniformBlock;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;
@group(1) @binding(3) var<storage,read> nowLayer:array<u32>;

@group(2) @binding(0) var<storage,read_write> particleInfo:array<f32>;//pnum*4
@group(2) @binding(1) var<storage,read_write> layoutBaseArray:array<atomic<u32>>;//layerNum
@group(2) @binding(2) var<storage,read_write> old_layoutBaseArray:array<u32>;//layerNum
@group(2) @binding(3) var<storage,read_write> indirect_aliveNum:array<atomic<u32>>;//4
@group(2) @binding(4) var<storage,read_write> layeredLayoutIndex:array<u32>;//particleNum
@group(2) @binding(5) var<storage,read_write> particleLayerIndex:array<u32>;//particleNum，存i粒子的索引
@group(2) @binding(6) var<storage,read_write> justOffset:array<atomic<u32>>;




@compute @workgroup_size(1)
fn cMain(@builtin(global_invocation_id) id:vec3u)
{
    let particleID = id.x;
    let particleLayerID = particleLayerIndex[particleID];
    // let base = old_layoutBaseArray[particleLayerID];
    let base = atomicAdd(&(layoutBaseArray[particleLayerID]),0);
    // let base:u32 = 0;

    // let posZ = particleInfo[layeredLayoutIndex[particleID]*4+2];
    // if(posZ < ublock.deltaHeight*10.0)

    atomicAdd(&(indirect_aliveNum[1]),1);//delete

    let address = base + atomicAdd(&(justOffset[particleLayerID]),1);
    
    if(address < ublock.particleNum)
    {   
        layeredLayoutIndex[address] = particleID;
    }

}