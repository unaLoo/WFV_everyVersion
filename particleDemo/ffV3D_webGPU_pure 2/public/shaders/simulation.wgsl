struct UniformBlock {
    groupSize: vec2u,
    canvasSize: vec2u,

    progress: f32,
    particleNum: u32,
    segmentNum: f32,
    fullLife: f32,
    n_fullLife: f32,
    dropRate: f32,
    dropRateBump: f32,
    speedFactor: f32,
    randomSeed: f32,
    startStorageIndex: f32,
    startReadIndex: f32,
    fillWidth: f32,
    aaWidth: f32,
    maxParticleNum: f32,
    maxSegmentNum: f32,
    flowBoundary: vec4f, // vec4f(uMin, vMin, uMax, vMax)
    u_centerHigh: vec2f,
    u_centerLow: vec2f,
    u_matrix: mat4x4f
}

// Uniform bindings
@group(0) @binding(0) var<uniform> flowUniform: UniformBlock;

// Texture bindings
@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var fTexture1: texture_2d<f32>;
@group(1) @binding(2) var fTexture2: texture_2d<f32>;
@group(1) @binding(3) var seedingTexture: texture_2d<f32>;
@group(1) @binding(4) var transformHighTexture: texture_2d<f32>;
@group(1) @binding(5) var transformLowTexture: texture_2d<f32>;
@group(1) @binding(6) var upSpeedTexture: texture_2d<f32>;

// Storage bindings
@group(2) @binding(0) var<storage, read_write> particlePosition: array<f32>;
@group(2) @binding(1) var<storage, read_write> indexArray: array<u32>;
@group(2) @binding(2) var<storage, read_write> aliveNum: atomic<u32>;
@group(2) @binding(3) var<storage, read_write> particleAge: array<f32>;
@group(2) @binding(4) var<storage, read_write> particleAttribute: array<f32>;

// Constants
override blockSize: u32;

// pseudo-random generator
fn rand(co: vec2f) -> f32 {
    let rand_constants = vec3f(12.9898, 78.233, 4375.85453);
    let t = dot(rand_constants.xy, co);
    return abs(fract(sin(t) * (rand_constants.z + t)));
}


fn drop(velocity: f32, uv: vec2f) -> f32 {
    let seed = uv * flowUniform.randomSeed;
    let drop_rate = flowUniform.dropRate + velocity * flowUniform.dropRateBump;
    return step(drop_rate, rand(seed));
}

fn is_in_flow_progress(position: vec3f) -> f32 {

    let textureSize = textureDimensions(seedingTexture, 0);
    let uv = vec2u(position.xy * vec2f(textureSize));
    let color1 = textureLoad(seedingTexture, uv, 0);
    // let color1 = textureLoad(seedingTexture, uv, 0);

    let xy1 = vec2u((u32(color1.x * 255.0) << 8) + u32(color1.y * 255.0), (u32(color1.z * 255.0) << 8) + u32(color1.w * 255.0));

    let xyOutFlag = select(0.0, 1.0, (xy1.x == uv.x) && (xy1.y == uv.y));// 0 if out boundary

    let zOutFlag = step(-1.0 * flowUniform.n_fullLife, -1.0 * position.z ); // 0 if z > 0.001

    return xyOutFlag * zOutFlag;


    // return select(0.0, 1.0, (xy1.x == uv.x) && (xy1.y == uv.y));// return 0 if out boundary
}

fn get_speed(uv: vec2f, fTexture: texture_2d<f32>) -> vec2f {

    var f = fract(uv);
    var parity = vec2i(select(-1, 1, f.x >= 0.5), select(-1, 1, f.y >= 0.5));
    let uv0 = vec2i(uv);
    let uv1 = uv0 + vec2i(parity.x, 0);
    let uv2 = uv0 + vec2i(0, parity.y);
    let uv3 = uv0 + vec2i(parity.x, parity.y);

    let speed0 = textureLoad(fTexture, uv0, 0).xy;
    let speed1 = textureLoad(fTexture, uv1, 0).xy;
    let speed2 = textureLoad(fTexture, uv2, 0).xy;
    let speed3 = textureLoad(fTexture, uv3, 0).xy;

    let lerp = abs(f - vec2f(0.5));
    let speed =  mix(mix(speed0.xy, speed1.xy, lerp.x), mix(speed2, speed3, lerp.x), lerp.y);
    return speed;
}

fn lookup_Z_speed(position: vec3f) -> f32 {
    
    let textureSize = textureDimensions(upSpeedTexture, 0);
    let coords = vec2u(position.xy * vec2f(textureSize));
    let color = textureLoad(upSpeedTexture, coords, 0).rgba;

    var zSpeed = f32((u32(color.x * 255.0) << 24)+(u32(color.x * 255.0) << 16)+(u32(color.x * 255.0) << 8)+u32(color.x * 255.0));
    let m = pow(2, 32) - 1.0;
    
    zSpeed = mix(0.1 , 0.9 , zSpeed / m );
    return zSpeed;
}

fn lookup_speed(position: vec3f) -> vec3f {
    
    let textureSize = textureDimensions(seedingTexture, 0);
    let uv = position.xy * vec2f(textureSize);

    let speed1 = mix(flowUniform.flowBoundary.xy, flowUniform.flowBoundary.zw, get_speed(uv, fTexture1));
    let speed2 = mix(flowUniform.flowBoundary.xy, flowUniform.flowBoundary.zw, get_speed(uv, fTexture2));

    let zSpeed = lookup_Z_speed(position);

    let xySpeed:vec2f = mix(speed1, speed2, flowUniform.progress);

    return vec3f(xySpeed, zSpeed);
}

fn speed_rate(velocity: vec2f) -> f32 {
    
    return length(velocity) / length(flowUniform.flowBoundary.zw);
    // return length(velocity - flowUniform.flowBoundary.xy) / length(flowUniform.flowBoundary.zw - flowUniform.flowBoundary.xy);
}

fn isInField(position: vec2f) -> bool {
    
    let textureSize = textureDimensions(seedingTexture, 0);
    let uv = vec2u(position * vec2f(textureSize));
    let color1 = textureLoad(seedingTexture, uv, 0);
    // let color1 = textureLoad(seedingTexture, uv, 0);

    let xy1 = vec2u((u32(color1.x * 255.0) << 8) + u32(color1.y * 255.0), (u32(color1.z * 255.0) << 8) + u32(color1.w * 255.0));
    return (xy1.x == uv.x) && (xy1.y == uv.y);
}

fn die(particleIndex: u32, nextIndex: u32, nextOffset: u32, particleInfo: vec2f, particlePos:vec3f) {

    let seed = flowUniform.randomSeed + particlePos.xy;
    let texcoords = vec2f(rand(seed + 1.4), rand(seed + 2.1));

    let textureSize = vec2f(textureDimensions(seedingTexture, 0));
    let uv = vec2u(texcoords * textureSize);
    
    let rebirthColor = textureLoad(seedingTexture, uv, 0);
    var rebirth_x = f32((u32(rebirthColor.x * 255.0) << 8) + u32(rebirthColor.y * 255.0));
    var rebirth_y = f32((u32(rebirthColor.z * 255.0) << 8) + u32(rebirthColor.w * 255.0));
    rebirth_x = rebirth_x + rand(seed + rebirth_x);
    rebirth_y = rebirth_y + rand(seed + rebirth_y);
    let rebirthPos_xy = vec2f(rebirth_x, rebirth_y) / textureSize;
    
    // let rebirth_z = 0.0005;
    let rebirth_z = rand(vec2f(rebirth_x,rebirth_y)) / 1000.0;//random rebirth in z
    let rebirthPos = vec3f(rebirthPos_xy, rebirth_z);

    particlePosition[3 * nextIndex] = rebirthPos.x;
    particlePosition[3 * nextIndex + 1] = rebirthPos.y;
    particlePosition[3 * nextIndex + 2] = rebirthPos.z;
    particleAge[nextIndex] = particleInfo.x + 1.0;
    particleAttribute[nextIndex] = speed_rate((lookup_speed(rebirthPos)).xy);
}

fn simulation(particleIndex: u32, nextIndex: u32, nextOffset: u32, particleInfo: vec2f, particlePos:vec3f) {

    let textureSize = vec2f(textureDimensions(seedingTexture, 0));
    let velocity:vec3f = lookup_speed(particlePos);
    let speedRate = speed_rate(velocity.xy);

    var newPos_xy = particlePos.xy + velocity.xy * flowUniform.speedFactor / textureSize;
    newPos_xy = clamp(newPos_xy, vec2f(0.0), vec2f(1.0));

    let newPos_z = particlePos.z + velocity.z * 0.00001; //unitHeigt * Z-speedfactor
    
    let newPos = vec3f(newPos_xy,newPos_z);
    let newAge = particleInfo.x + 1.0;
    let newRate = speedRate;

    let diePos = particlePos;
    // let dieAge = flowUniform.fullLife - flowUniform.maxSegmentNum;
    let dieAge = flowUniform.n_fullLife;
    let dieRate = particleInfo.y;
    
    let dropped = drop(speedRate, particlePos.xy) * is_in_flow_progress(newPos);

    // let dyingInfo = vec4f(particlePos.xy, flowUniform.fullLife - flowUniform.maxSegmentNum, particleInfo.y);
    // let newInfo = vec4f(newPos_xy, particleInfo.x + 1.0, speedRate);

    // let realInfo = mix(dyingInfo, newInfo, dropped);// dropped = 0  ==> die

    if(dropped == 1){
        particlePosition[3 * nextIndex] = newPos.x;
        particlePosition[3 * nextIndex + 1] = newPos.y;
        particlePosition[3 * nextIndex + 2] = newPos.z;
        particleAge[nextIndex] = newAge;
        particleAttribute[nextIndex] = newRate;
    }
    else{
        particlePosition[3 * nextIndex] = diePos.x;
        particlePosition[3 * nextIndex + 1] = diePos.y;
        particlePosition[3 * nextIndex + 2] = diePos.z;
        particleAge[nextIndex] = dieAge;
        particleAttribute[nextIndex] = dieRate;
    }

}

fn freeze(particleIndex: u32, nextIndex: u32, nextOffset: u32, particleInfo: vec2f, particlePos:vec3f) {

    // stay here , no change
    // particlePosition[3 * nextIndex] = particlePos.x;
    // particlePosition[3 * nextIndex + 1] = particlePos.y;
    // particlePosition[3 * nextIndex + 2] = particlePos.z;
    
    particleAge[nextIndex] = particleInfo.x + 1.0;
    particleAttribute[nextIndex] = particleInfo.y;
}

fn rebirth(particleIndex: u32, nextIndex: u32, nextOffset: u32, particleInfo: vec2f, particlePos:vec3f) {

    // from start point , no change
    // particlePosition[3 * nextIndex] = particlePos.x;
    // particlePosition[3 * nextIndex + 1] = particlePos.y;
    // particlePosition[3 * nextIndex + 2] = particlePos.z;
    particleAge[nextIndex] = 0.0;
    particleAttribute[nextIndex] = particleInfo.y;
}

@compute @workgroup_size(blockSize, blockSize, 1)
fn cMain(@builtin(global_invocation_id) id: vec3<u32>) {


    let particleIndex = id.y * flowUniform.groupSize.x * blockSize + id.x;


    let particlePos = vec3f(particlePosition[3 * particleIndex], particlePosition[3 * particleIndex + 1],particlePosition[3 * particleIndex + 2]);
    let currentAge = particleAge[particleIndex];
    let currentAttribute = particleAttribute[particleIndex];
    let particleInfo = vec2f(currentAge, currentAttribute);

    if (currentAge < flowUniform.n_fullLife) {
        simulation(0, particleIndex, 0, particleInfo, particlePos);
    }
    else if (abs(currentAge - flowUniform.n_fullLife) < 0.000001) {
        die(0, particleIndex, 0, particleInfo, particlePos);
    }
    // else if (abs(flowUniform.fullLife - currentAge) <= flowUniform.maxSegmentNum) {
    //     freeze(0, particleIndex, 0, particleInfo, particlePos);
    // }
    else {
        rebirth(0, particleIndex, 0, particleInfo, particlePos);
    }




    if ((particleIndex < flowUniform.particleNum) ) {//q
        indexArray[atomicAdd(&aliveNum, 1)] = particleIndex;
    }
}