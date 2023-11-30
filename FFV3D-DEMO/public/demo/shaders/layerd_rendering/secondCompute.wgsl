////////////////second compute
//统计indirect_alivenum ， 填充indexArray
struct uniformBlock{
    ///static for all particles
    canvasSize:vec2u,
    particleNum:f32,
    deltaHeight:f32,
    totalLayers:u32,
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,
} 


struct VertexInput{
    @builtin(global_invocation_id) id:vec3u,
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
@group(2) @binding(5) var<storage,read_write> justIndexing:atomic<u32>;
@group(2) @binding(6) var<storage,read_write> old_layoutBaseArray:array<atomic<u32>,9>;
@group(2) @binding(7) var<storage,read> nowLayer:array<u32>;

override blockSize: u32;

fn getAddress()
->u32{
    let ads:u32 = 1;
    return ads;
}



@compute @workgroup_size(blockSize,1,1)
fn cMain(input:VertexInput)
{
    //compute pass 2
 
    let particleIndex = input.id.x;//派遣了totalNum个workGroup，所以可以直接用于索引

    let nowPos = vec3f(particlePosition[particleIndex*3],particlePosition[particleIndex*3+1],particlePosition[particleIndex*3+2]);
    
    if((nowPos.z>=0.0)&&(nowPos.z<=f32(ublock.totalLayers) * ublock.deltaHeight))//只要在高度范围内，该粒子就是存活的，渲染的
    {
        indexArray[atomicAdd(&(indirect_aliveNum[1]),1)] = particleIndex;//indexArray向后存1个
    }

}
