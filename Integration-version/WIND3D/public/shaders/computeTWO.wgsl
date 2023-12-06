struct LayerInfo{
    layerNum: u32,
    maxHeight: f32,
    heightArrayLength: u32,
    unitHeight: f32,
}

struct UniformBlock{
    groupSize: vec2u,
    canvasSize: vec2u,
    
    progress: f32,
    particleNum: u32,
    dropRate: f32,
    dropRateBump: f32,
    randomSeed: f32,
    speedFactor: f32,
    // zspeedBoundary: vec2f,//speed_min , speed_max
    // flowBoundary: vec4f, // vec4f(uMin, vMin, uMax, vMax)
    u_centerHigh: vec2f,
    u_centerLow: vec2f,
    speedBoundary: array<f32,6>,
    u_matrix: mat4x4f,
    layerInfo: LayerInfo,
}

@group(0) @binding(0) var<unifrom> ubo: UniformBlock;

@group(1) @binding(0) var<storage,read> particleInfo: array<f32>;
@group(1) @binding(1) var<storage,read_write> indexArray: array<u32>;
@group(1) @binding(2) var<storage,read_write> justOffset: array<atomic<u32>>;
@group(1) @binding(3) var<storage,read> baseArray: array<u32>;
@group(1) @binding(4) var<storage,read> heightArray: array<f32>;

override blockSize: u32;
override groupNum: u32;

fn getLayerfromBuffer(height: f32)->u32
{
    let mappedZ: f32 = height / ubo.layerInfo.totalHeight * f32(ubo.layerInfo.heightArrayLength);
    let layerID = heightArray[u32(mappedZ)];
    return u32(layerID);
}

@compute @workgroup_size(blockSize, blockSize, 1)
fn cMain(@builtin(global_invocation_id) id: vec3u)
{
    let particleIndex = id.x + id.y * blockSize * groupNum;
    let particleLayerID = getLayerfromBuffer(particleInfo[ particleIndex * 4 + 2 ]);
    
    let base = baseArray[particleLayerID];//not old base array!!!

    let address = base + atomicAdd(&(justOffset[particleLayerID]), 1);
    
    if(address < baseArray[particleLayerID+1])
    {   
        indexArray[address] = particleIndex;
    }

}