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
    speedBoundary: array<f32,6>,
    u_centerHigh: vec2f,
    u_centerLow: vec2f,
    u_matrix: mat4x4f,
    layerInfo: LayerInfo,
}

@group(0) @binding(0) var<unifrom> ubo: UniformBlock;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var last_down_windTex: texture_2d<f32>;
@group(1) @binding(2) var last_up_windTex: texture_2d<f32>;
@group(1) @binding(3) var next_down_windTex: texture_2d<f32>;
@group(1) @binding(4) var next_up_windTex: texture_2d<f32>;
@group(1) @binding(5) var seedingTexture: texture_2d<f32>;
@group(1) @binding(6) var transformHighTexture: texture_2d<f32>;
@group(1) @binding(7) var transformLowTexture: texture_2d<f32>;
@group(1) @binding(8) var<storage,read> nowLayer: <u32>;

@group(2) @binding(0) var<storage,read_write> particlePool: array<f32>;//x,y,z,attrib
@group(2) @binding(1) var<storage,read_write> layeredParticleCount: array<atomic<u32>>;
@group(2) @binding(2) var<storage,read_write> indirectDraw: array<u32,4>;//4,alivenum,0,0
@group(2) @binding(3) var<storage,read_write> indirectDispatch: array<u32>;
@group(2) @binding(4) var<storage,read_write> oldBaseArray: array<u32>;
@group(2) @binding(5) var<storage,read_write> indexArray: array<u32>;
@group(2) @binding(6) var<storage,read_write> heightArray: array<f32>;

override blockSize: u32;

fn rand(co: vec2f) -> f32 
{
    let rand_constants = vec3f(12.9898, 78.233, 4375.85453);
    let t = dot(rand_constants.xy, co);
    return abs(fract(sin(t) * (rand_constants.z + t)));
}

fn getLayerIndex(zvalue: f32) -> f32
{
    let mappedIndex: f32 = height / ubo.layerInfo.maxHeight * f32(ubo.layerInfo.heightArrayLength);
    let layerID = heightArray[u32(mappedIndex)];
    return u32(layerID);
}

fn getParticleIndex(invocationID: vec3u, layerIndex: u32) -> u32
{
    let validAddressRange = vec2u(oldBaseArray[layerIndex], oldBaseArray[layerIndex + 1]);
    let workGroupPerDimension = indirectDispatch[layerIndex * 3 + 0];
    let address = validAddressRange.x + (invocationID.x + invocationID.y * blockSize * workGroupPerDimension);

    let particleIndex: u32 = select(ubo.particleNum + 1, indexArray[address], address >= validAddressRange.x && address < validAddressRange.y); //select(f,t,cond)
    return particleIndex;
}

fn outofBoundary(position: vec3f) -> f32 
{
    let textureSize = textureDimensions(seedingTexture, 0);
    let coords = vec2u(position.xy * vec2f(textureSize));
    let color = textureLoad(seedingTexture, coords, 0);
    let xy = vec2u((u32(color.x * 255.0) << 8) + u32(color.y * 255.0), (u32(color.z * 255.0) << 8) + u32(color.w * 255.0));

    let xyOutFlag = select(0.0, 1.0, (xy.x == coords.x) && (xy.y == coords.y));// == 0 if (x,y) out
    let zOutFlag = step(-1.0 * ubo.layerInfo.maxHeight, -1.0 * position.z ); // == 0 if z > zmax

    return xyOutFlag * zOutFlag;// return 0 if out
}

fn drop(speedRate: f32, pos_xy: vec2f) -> f32 
{
    let seed = pos_xy * flowUniform.randomSeed;
    let drop_rate = flowUniform.dropRate + speedRate * flowUniform.dropRateBump;
    return step(drop_rate, rand(seed)); // return 0 if drop_rate > rand(seed)
}



fn getSpeed(vec3f pos) -> vec3f
{
    //get speed from last_down_windTex | last_up_windTex | next_down_windTex | next_up_windTex
    return vec3f(0.1, 0.1, 0.1);
}

fn getSpeedRate(vec3f speed) -> f32
{
    //get the length of speed and normalize 
    return 0.5;
}

fn dieNrebirth(vec4f particleInfo) -> vec4f
{
    let seed = ubo.randomSeed + particleInfo.xy;
    let texcoords = vec2f(rand(seed + 1.4), rand(seed + 2.1));
    let textureSize = vec2f(textureDimensions(seedingTexture, 0));
    let uv = vec2u(texcoords * textureSize);

    let color = textureLoad(seedingTexture, uv, 0);
    var rebirth_x = f32((u32(rebirthColor.x * 255.0) << 8) + u32(rebirthColor.y * 255.0));
    var rebirth_y = f32((u32(rebirthColor.z * 255.0) << 8) + u32(rebirthColor.w * 255.0));
    rebirth_x = rebirth_x + rand(seed + rebirth_x);
    rebirth_y = rebirth_y + rand(seed + rebirth_y);
    var rebirth_z = rand(vec2f(rebirth_x, rebirth_y));
    rebirth_z = 0.0 + rebirth_z  * ubo.layerInfo.maxHeight; //(0,1) to (0.0,maxheight)
    
    let rebirthPos = vec3f(rebirth_x, rebirth_y, rebirth_z);
    let speedRate = getSpeedRate(getSpeed(rebirthPos));

    return vec4f(rebirthPos, speedRate);
}



fn simulation(particleIndex: u32) -> vec4f
{
    let originInfo = vec4f(particlePool[4 * pIndex], particlePool[4 * pIndex + 1], particlePool[4 * pIndex + 2], particlePool[4 * pIndex + 3]);
    let textureSize = vec2f(textureDimensions(seedingTexture, 0));
    let speed = getSpeed(originInfo.xyz);
    let speedRate = getSpeedRate(speed);

    var newPos = originInfo.xyz + speed.xyz * ubo.speedFactor / textureSize;
    newPos = clamp(newPos, vec3f(0.0), vec3f(1.0));
    
    let newINFO = vec4f(newPos,speedRate);
    let dieINFO = dieNrebirth(originInfo);

    let dropped = outofBoundary(newPos) * drop(speedRate, newPos.xy); // == 0 if particle die

    return select(newINFO, dieINFO, dropped == 0.0);//select(f,t,cond)
}
 

@compute @workgroup_size(blockSize, blockSize, 1)
fn cMain(@builtin(global_invocation_id) id: vec3u)
{
    // 0. get valid particle index
    let pIndex = getParticleIndex(id, nowLayer);

    if(pIndex != ubo.particleNum + 1){
        // 1. simulation
        var simuResult = simulation(pIndex);
        
        // 2. storage
        particlePool[4*pIndex+0]= simuResult.x;
        particlePool[4*pIndex+1]= simuResult.y;
        particlePool[4*pIndex+2]= simuResult.z;
        particlePool[4*pIndex+3]= simuResult.w;
        
        //3. layered particle num count+
        let particleLayerIndex_aftersimu = getLayerIndex(simuResult.z);
        atomicAdd(&(layeredParticleCount[particleLayerIndex_aftersimu]), 1);

        //4. particle alive num count+ 
        atomicAdd(&(indirectDraw[1]), 1);
    }

}