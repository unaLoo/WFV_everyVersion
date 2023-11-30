
struct uniformBlock{
    ///static for all particles
    canvasSize:vec2u,
    particleNum:u32,
    deltaHeight:f32,
    totalLayers:u32,//10张纹理,中间9层，totallayers = 9
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,
}

@group(0) @binding(0) var<uniform> ublock:uniformBlock;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;

@group(2) @binding(0) var<storage,read_write> particlePosition:array<f32>;
@group(2) @binding(1) var<storage,read_write> particleAttribute:array<f32>;
@group(2) @binding(2) var<storage,read_write> indirect_aliveNum:array<atomic<u32>,4>;
@group(2) @binding(3) var<storage,read_write> layoutBaseArray:array<atomic<u32>,9>;
@group(2) @binding(4) var<storage,read_write> indexArray:array<u32>;
@group(2) @binding(5) var<storage,read_write> justIndexing:atomic<u32>;///可删
@group(2) @binding(6) var<storage,read_write> old_layoutBaseArray:array<atomic<u32>,9>;

@group(3) @binding(0) var<storage,read> nnnowLayer:array<u32>;

override blockSize: u32;



@compute @workgroup_size(blockSize,1,1)
fn cMain(@builtin(global_invocation_id) id:vec3u)
{
    let particleIndex = id.x;
    let pos_z = particlePosition[particleIndex*3+2];
    
    if((pos_z>0.0)&&(pos_z< ublock.deltaHeight * f32(ublock.totalLayers)))
    {
        // indexArray[atomicAdd(&(indirect_aliveNum[1]),1)] = particleIndex;
        if(atomicAdd(&(indirect_aliveNum[1]),0)<ublock.particleNum)
        {
            indexArray[atomicAdd(&(indirect_aliveNum[1]),1)] = particleIndex;
        }
    }
}