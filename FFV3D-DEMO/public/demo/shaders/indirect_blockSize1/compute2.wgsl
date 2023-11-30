struct ts{
    t:f32,
    s:u32,
}

struct uniformBlock{
    canvasSize:vec2u,
    particleNum:u32,
    deltaHeight:f32,
    totalLayers:u32,//9
    totalHeight:f32,
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,
    myts:ts,
}
struct vertexInput{
    @builtin(global_invocation_id) iid:vec3u,
    @builtin(workgroup_id) wid:vec3u,
    //这两个应是一样的
}

@group(0) @binding(0) var<uniform> ublock:uniformBlock;
@group(0) @binding(1) var heightTex:texture_2d<f32>;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;
@group(1) @binding(3) var<storage,read> nowLayer:u32;

@group(2) @binding(0) var<storage,read_write> particleInfo:array<f32>;//pnum*4
@group(2) @binding(1) var<storage,read_write> indirectDispatchBuffer:array<atomic<u32>>;
@group(2) @binding(2) var<storage,read_write> old_baseArray:array<u32>;//layerNum
@group(2) @binding(3) var<storage,read_write> indexArray:array<u32>;//particleNum
@group(2) @binding(4) var<storage,read_write> justOffset:array<atomic<u32>>;
@group(2) @binding(5) var<storage,read_write> layeredParticleCount:array<atomic<u32>>;//for indirectly dispatch, 3*4bytes per stride
@group(2) @binding(6) var<storage,read_write> baseArray:array<u32>;



fn decodeHeightTexel(texel:vec4f)
->u32{
    return u32(texel.a * 255.0);
}

fn getLayerfromTex(particleIndex:u32)
->u32{

    let zValue = particleInfo[ particleIndex * 4 + 2 ];
    let hTexSize = textureDimensions(heightTex,0);

    let uv = vec2f(zValue/ublock.totalHeight , 0.0);
    let coords = vec2u(uv * vec2f(hTexSize));

    return decodeHeightTexel(textureLoad(heightTex,coords,0).rgba);

}


@compute @workgroup_size(1)
fn cMain(@builtin(global_invocation_id) id:vec3u)
{
    let particleIndex = id.x;
    let particleLayerID = getLayerfromTex(particleIndex);
    
    let base = baseArray[particleLayerID];//not old base array!!!

    let address = base + atomicAdd(&(justOffset[particleLayerID]),1);
    
    if(address < baseArray[particleLayerID+1])
    {   
        indexArray[address] = particleIndex; //从一个indexarray里面取索引，又存到对应address上，会出问题
        // new_indexArray[address] = particleIndex;
    }

}