 

// struct uniformBlock{
//     canvasSize:vec2u,
//     particleNum:u32,
//     speedFactor:f32,
//     layerNum:u32,//9
//     totalHeight:f32,
//     // heightArrayLength:u32,
//     // test:u32,
//     speedBoundary:vec2f,//speed_min , speed_max
//     matrix:mat4x4f,
// }


struct LayerInfo{
    layerNum:u32,
    totalHeight:f32,
    heightArrayLength:u32,
}

struct uniformBlock{
    canvasSize:vec2u,
    particleNum:u32,
    speedFactor:f32,
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,
    layerInfo:LayerInfo,
}


struct vertexInput{
    @builtin(global_invocation_id) iid:vec3u,
    @builtin(workgroup_id) wid:vec3u,
}

@group(0) @binding(0) var<uniform> ublock:uniformBlock;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;
@group(1) @binding(3) var<storage,read> nowLayer:u32;

@group(2) @binding(0) var<storage,read> particleInfo:array<f32>;
@group(2) @binding(1) var<storage,read_write> indexArray:array<u32>;
@group(2) @binding(2) var<storage,read_write> justOffset:array<atomic<u32>>;
@group(2) @binding(3) var<storage,read> baseArray:array<u32>;
@group(2) @binding(4) var<storage,read> heightArray:array<u32>;

override blockSize: u32;
override groupNum: u32;

fn getLayerfromBuffer(height:f32)
->u32{
    let mappedZ:f32 = height / ublock.layerInfo.totalHeight * f32(ublock.layerInfo.heightArrayLength);
    let layerID = heightArray[u32(mappedZ)];
    return layerID;
}

@compute @workgroup_size(blockSize,blockSize,1)
fn cMain(@builtin(global_invocation_id) id:vec3u)
{
    let particleIndex = id.x + id.y*blockSize*groupNum;
    let particleLayerID = getLayerfromBuffer(particleInfo[ particleIndex * 4 + 2 ]);
    
    let base = baseArray[particleLayerID];//not old base array!!!

    let address = base + atomicAdd(&(justOffset[particleLayerID]),1);
    
    if(address < baseArray[particleLayerID+1])
    {   
        indexArray[address] = particleIndex; //从一个indexarray里面取索引，又存到对应address上，会出问题
        // new_indexArray[address] = particleIndex;
    }

}