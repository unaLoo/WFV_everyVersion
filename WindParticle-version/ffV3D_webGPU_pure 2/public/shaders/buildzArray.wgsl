
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


struct ST{
    @builtin(global_invocation_id) iid:vec3u,
    @builtin(workgroup_id) wid:vec3u,
    @builtin(num_workgroups) wnum:vec3u,
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
@group(2) @binding(0) var<storage, read> data_v: array<f32>;
@group(2) @binding(1) var<storage, read_write> renderIndexArray: array<u32>;
@group(2) @binding(2) var<storage, read_write> cameraDistArray: array<f32>;
@group(2) @binding(3) var<storage, read_write> cameraDistOG: array<f32>;


override blockSize: u32;


fn translateRelativeToEye(high: vec2f, low: vec2f) -> vec2f {
    let highDiff = high - flowUniform.u_centerHigh;
    let lowDiff = low - flowUniform.u_centerLow;

    return highDiff + lowDiff;
}

fn sampleGeoPosition(pos: vec2f) -> vec2f {

    let textureSize = textureDimensions(transformHighTexture, 0);
    let uv: vec2f = pos * vec2f(textureSize);
    var f = fract(uv);
    var parity = vec2i(select(-1, 1, f.x >= 0.5), select(-1, 1, f.y >= 0.5));
    let uv0 = vec2i(uv);
    let uv1 = uv0 + vec2i(parity.x, 0);
    let uv2 = uv0 + vec2i(0, parity.y);
    let uv3 = uv0 + vec2i(parity.x, parity.y);

    let highGeoPos0 = textureLoad(transformHighTexture, uv0, 0).xy;
    let highGeoPos1 = textureLoad(transformHighTexture, uv1, 0).xy;
    let highGeoPos2 = textureLoad(transformHighTexture, uv2, 0).xy;
    let highGeoPos3 = textureLoad(transformHighTexture, uv3, 0).xy;
    let lowGeoPos0 = textureLoad(transformLowTexture, uv0, 0).xy;
    let lowGeoPos1 = textureLoad(transformLowTexture, uv1, 0).xy;
    let lowGeoPos2 = textureLoad(transformLowTexture, uv2, 0).xy;
    let lowGeoPos3 = textureLoad(transformLowTexture, uv3, 0).xy;
    let geoPos0 = translateRelativeToEye(highGeoPos0, lowGeoPos0);
    let geoPos1 = translateRelativeToEye(highGeoPos1, lowGeoPos1);
    let geoPos2 = translateRelativeToEye(highGeoPos2, lowGeoPos2);
    let geoPos3 = translateRelativeToEye(highGeoPos3, lowGeoPos3);

    let lerp = abs(f - vec2f(0.5));
    return mix(mix(geoPos0.xy, geoPos1.xy, lerp.x), mix(geoPos2, geoPos3, lerp.x), lerp.y);
}



fn get_clip_position_w(address: u32) -> f32 {
    let pos = vec3f(data_v[3 * address], data_v[3 * address + 1], data_v[3 * address + 2]);
    let geoPos = sampleGeoPosition(pos.xy);
    let pos_CS = flowUniform.u_matrix * vec4f(geoPos , pos.z , 1.0);
    return pos_CS.z / pos_CS.w;
}


@compute @workgroup_size(blockSize, blockSize, 1)
// @compute @workgroup_size(256,1,1)
fn cMain(input: ST){
    
    // let bk = blockSize;
    let particleIndex = input.iid.y * flowUniform.groupSize.x * blockSize + input.iid.x;
    // let particleIndex = input.iid.x;
    renderIndexArray[particleIndex] = particleIndex;
    let cameraDist = get_clip_position_w(particleIndex);

    //cameraDistArray 对应 particlePool 的顺序
    cameraDistArray[particleIndex] = cameraDist;
    cameraDistOG[particleIndex] = cameraDist;
    // cameraDistArray[particleIndex] = f32(particleIndex);

    // cameraDistArray[0] = f32(input.wnum.x);
    // cameraDistArray[1] = f32(input.wnum.y);
    // cameraDistArray[2] = f32(input.wnum.z);
    // cameraDistArray[16385] = 9.999;


}


