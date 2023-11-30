
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

@group(0) @binding(0) var<uniform> ublock:uniformBlock;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;
@group(1) @binding(3) var<storage,read> nowLayer:u32;

@group(2) @binding(0) var<storage,read_write> indirectDispatchBuffer:array<u32>;
@group(2) @binding(1) var<storage,read> layeredParticleCount:array<u32>;//for indirectly dispatch, 3*4bytes per stride
@group(2) @binding(2) var<storage,read_write> baseArray:array<u32>;

override blockSize: u32;

fn calcBase(baseID:u32)
{
    if(baseID == 0){
        baseArray[baseID] = 0;
    }
    else if (baseID > 0 && baseID < ublock.layerInfo.layerNum){
        
        // baseArray[baseID] = baseArray[baseID-1] + layeredParticleCount[baseID*3]; // 并行计算，迭代不可取

        var i:u32 = 0;
        loop{
            if i == baseID {break;}

            // baseArray[baseID] += atomicAdd(&(layeredParticleCount[i*3]),0);
            baseArray[baseID] += layeredParticleCount[i*3];//only read

            i = i + 1;
        }
    }
    else if (baseID == ublock.layerInfo.layerNum){
        baseArray[baseID] = ublock.particleNum;
    }
}

fn calcIndirect(baseID:u32)
{
    if(baseID == ublock.layerInfo.layerNum) { return; }
    let pNum = layeredParticleCount[baseID*3];
    let width = ceil(sqrt(f32(pNum)));
    let groupNumx = ceil(width/f32(blockSize));
    let groupNumy = groupNumx;
 
    indirectDispatchBuffer[baseID*3 + 0] = u32(groupNumx);
    indirectDispatchBuffer[baseID*3 + 1] = u32(groupNumy);

}



@compute @workgroup_size(1)
fn cMain(@builtin(workgroup_id) id:vec3u)
{
   calcBase(id.x);
   calcIndirect(id.x);
}