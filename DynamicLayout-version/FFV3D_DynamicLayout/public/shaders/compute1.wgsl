struct LayerInfo{
    layerNum: u32,
    totalHeight: f32,
    heightArrayLength: u32,
    unitHeight: f32,
}

struct uniformBlock{
    canvasSize: vec2u,
    particleNum: u32,
    speedFactor: f32,
    speedBoundary: vec2f,//speed_min , speed_max
    matrix: mat4x4f,
    layerInfo: LayerInfo,
}


@group(0) @binding(0) var<uniform> ublock: uniformBlock;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;
@group(1) @binding(3) var<storage,read> nowLayer: u32;

@group(2) @binding(0) var<storage,read_write> particleInfo: array<f32>;
@group(2) @binding(1) var<storage,read> indirectDispatchBuffer: array<u32>;
@group(2) @binding(2) var<storage,read> old_baseArray: array<u32>;
@group(2) @binding(3) var<storage,read> indexArray: array<u32>;
@group(2) @binding(4) var<storage,read_write> layeredParticleCount: array<atomic<u32>>;
@group(2) @binding(5) var<storage,read> heightArray: array<f32>;

override blockSize: u32;

fn getLayerID(height: f32) -> u32
{
    let mappedIndex: f32 = height / ublock.layerInfo.totalHeight * f32(ublock.layerInfo.heightArrayLength);
    let layerID = heightArray[u32(mappedIndex)];
    return u32(layerID);
}

fn getParticleIndex(invocationID: vec3u,thisLayerIndex: u32) -> u32
{
    var startAddress = old_baseArray[thisLayerIndex];
    var endAddress = old_baseArray[thisLayerIndex+1];
    var particleIndex: u32;

    let groupNumx = indirectDispatchBuffer[thisLayerIndex * 3 + 0];
    let address = startAddress + (invocationID.x + invocationID.y * blockSize * groupNumx);

    // valid index range :  [startAddress , endAddress]
    if(address < endAddress && address >= startAddress ){
        particleIndex = indexArray[address];
    }
    else 
    {
        particleIndex = ublock.particleNum+1;//error tag
    }
    return particleIndex;
}

fn getf32fromrgba(color: vec4f) -> f32
{
    var f32value = f32((u32(color.x * 255.0) << 24)+(u32(color.x * 255.0) << 16)+(u32(color.x * 255.0) << 8)+u32(color.x * 255.0));
    let m = pow(2, 32) - 1.0;
    
    f32value = mix(ublock.speedBoundary.x , ublock.speedBoundary.y , f32value / m );
    return f32value;
}

fn getSpeed(uv: vec2f, fTexture:  texture_2d<f32> , textureSize: vec2u) -> f32
{
    let coords = vec2u(uv * vec2f(textureSize));
    let color = textureLoad(fTexture, coords, 0).rgba;
    return getf32fromrgba(color);
}


fn getSpeedRate(speed: f32) -> f32
{
    // return unorm speed
    return clamp((speed - ublock.speedBoundary.x) / (ublock.speedBoundary.y - ublock.speedBoundary.x), 0.0, 1.0);
}

fn getProgress(height: f32) -> f32 {

    let mappedIndex: f32 = height / ublock.layerInfo.totalHeight * f32(ublock.layerInfo.heightArrayLength);
    let mappedIndex_i: u32 = u32(mappedIndex);
    let mappedIndex_f: f32 = fract(mappedIndex);

    let layerID_down = heightArray[mappedIndex_i];                           // 1.33
    let layerID_up = heightArray[mappedIndex_i + 1];                         // 1.66
    let layerID = layerID_down + mappedIndex_f * (layerID_up - layerID_down);// 1.5123 
    let progress = fract(layerID);                                           // 0.5123

    return progress;
}


fn simulation(pIndex: u32) -> vec4f
{
    let originInfo = vec4f(particleInfo[4 * pIndex], particleInfo[4 * pIndex + 1], particleInfo[4 * pIndex + 2], particleInfo[4 * pIndex + 3]);

    let textureSize: vec2u = textureDimensions(lowTex, 0);

    if(originInfo.z < ublock.layerInfo.totalHeight)
    {
        let low_speed = getSpeed(originInfo.xy, lowTex, textureSize);
        let high_speed= getSpeed(originInfo.xy, highTex, textureSize);
        let progress = clamp(getProgress(originInfo.z), 0.0, 1.0);

        let speed = mix(low_speed, high_speed, progress);
        let moveunit = ublock.layerInfo.unitHeight * ublock.speedFactor;
        let newZ = originInfo.z + moveunit * speed;
        
        let speedRate = getSpeedRate(speed);
        
        return vec4f(originInfo.xy, newZ,speedRate);
    }
    else {
        return originInfo;
    }
}

fn updateLayeredParticleCount(layerID: u32)
{
    atomicAdd(&(layeredParticleCount[layerID]), 1);
}


@compute @workgroup_size(blockSize, blockSize, 1)
fn cMain(@builtin(global_invocation_id) id: vec3u)
{
    //get valid particle index
    let pIndex: u32 = getParticleIndex(id, nowLayer); 

    if( pIndex != ublock.particleNum+1)
    {
        //1.simulate
        var simuResult = simulation(pIndex);

        //2.storage
        particleInfo[4*pIndex+0]= simuResult.x;
        particleInfo[4*pIndex+1]= simuResult.y;
        particleInfo[4*pIndex+2]= simuResult.z;
        particleInfo[4*pIndex+3]= simuResult.w;

        //3.count
        let layerAfterSimu = getLayerID(simuResult.z);

        // if(layerAfterSimu != ublock.layerInfo.layerNum+1)
        // {
            updateLayeredParticleCount(layerAfterSimu);
        // }
    }
}