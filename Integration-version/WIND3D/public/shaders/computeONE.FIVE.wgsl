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

@group(1) @binding(0) var<storage,read_write> indirectDispatchBuffer: array<u32>;
@group(1) @binding(1) var<storage,read> layeredParticleCount: array<u32>;//for indirectly dispatch, 3*4bytes per stride
@group(1) @binding(2) var<storage,read_write> baseArray: array<u32>;

override blockSize: u32;

fn calcBase(baseID: u32)
{
    if(baseID == 0){
        baseArray[baseID] = 0;
    }
    else if (baseID > 0 && baseID < ubo.layerInfo.layerNum){
        
        var i: u32 = 0;
        loop{
            if i == baseID {break;}

            baseArray[baseID] += layeredParticleCount[i];//only read

            i = i + 1;
        }
    }
    else if (baseID == ubo.layerInfo.layerNum){
        baseArray[baseID] = ubo.particleNum;
    }
}

fn calcIndirect(baseID: u32)
{
    if(baseID == ubo.layerInfo.layerNum) { return; }

    let pNum = layeredParticleCount[baseID];
    let width = ceil(sqrt(f32(pNum)));
    let groupNumx = ceil(width/f32(blockSize));
    let groupNumy = groupNumx;
 
    indirectDispatchBuffer[baseID*3 + 0] = u32(groupNumx);
    indirectDispatchBuffer[baseID*3 + 1] = u32(groupNumy);
}



@compute @workgroup_size(1)
fn cMain(@builtin(workgroup_id) id: vec3u)
{
   calcBase(id.x);
   calcIndirect(id.x);
}