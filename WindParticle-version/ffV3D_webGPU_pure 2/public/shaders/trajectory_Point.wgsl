struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
    @location(0) position: vec2f,
    @location(1) texcoords: vec2f,
}

struct VertexOutput {
    @builtin(position) position:vec4f,
    @location(0) speedRate:f32,
    @location(1) coords: vec2f
}

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
@group(2) @binding(0) var<storage> data_v: array<f32>;
@group(2) @binding(1) var<storage> indexArray_v: array<u32>;
@group(2) @binding(2) var<storage> attributes: array<f32>;

fn get_address(nodeIndex: u32, instanceIndex: u32) -> u32 {

    // // Calculate the blockIndex of the current node
    // let blockIndex = (u32(flowUniform.startStorageIndex) - nodeIndex + u32(flowUniform.maxSegmentNum)) % u32(flowUniform.maxSegmentNum);

    // // Calculate original address of the block
    // let blockAddress = blockIndex * u32(flowUniform.maxParticleNum);

    // // Calculate address of the current node
    // let nodeAddress = blockAddress + indexArray_v[instanceIndex];

    let nodeAddress = indexArray_v[instanceIndex];

    return nodeAddress;
}

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
    // let geoPos0 = textureLoad(transformTexture, uv0, 0).xy;
    // let geoPos1 = textureLoad(transformTexture, uv1, 0).xy;
    // let geoPos2 = textureLoad(transformTexture, uv2, 0).xy;
    // let geoPos3 = textureLoad(transformTexture, uv3, 0).xy;

    let lerp = abs(f - vec2f(0.5));
    // return mix(mix(highGeoPos0.xy, highGeoPos1.xy, lerp.x), mix(highGeoPos2, highGeoPos3, lerp.x), lerp.y);
    return mix(mix(geoPos0.xy, geoPos1.xy, lerp.x), mix(geoPos2, geoPos3, lerp.x), lerp.y);
}

fn ReCoordinate(pos: vec3f) -> vec4f {

    // let highGeoPos = sampleGeoPosition(pos, transformHighTexture);
    // let lowGeoPos = sampleGeoPosition(pos, transformLowTexture);
    // let geoPos = translateRelativeToEye(highGeoPos, lowGeoPos);
    let geoPos = sampleGeoPosition(pos.xy);

    let res = flowUniform.u_matrix * vec4f(geoPos , pos.z , 1.0);
    // let res = flowUniform.u_matrix * vec4f(geoPos, 0.001, 1.0);

    return res;
}

fn transfer_to_clip_space(pos: vec3f) -> vec4f {
    
    return ReCoordinate(pos);
}

fn get_clip_position(address: u32) -> vec4f {

    return transfer_to_clip_space(vec3f(data_v[3 * address], data_v[3 * address + 1], data_v[3 * address + 2]));
}

fn get_vector(beginVertex: vec2f, endVertex: vec2f) -> vec2f {
    
    return normalize(endVertex - beginVertex);
}

@vertex
fn vMain(vsInput: VertexInput) -> VertexOutput {

    let width = 3.0;
    let box = array(vec2f(0.0,0.0),vec2f(0.0,width),vec2f(width,0.0),vec2f(width,width));
    let boxCoords = array(vec2f(-1.0,-1.0),vec2f(-1.0,1.0),vec2f(1.0,-1.0),vec2f(1.0,1.0));

    let currentNode = vsInput.vertexIndex;

    let c_address = get_address(currentNode, vsInput.instanceIndex);

    let cn_pos_CS = get_clip_position(c_address);
   

    let vertexAds = c_address;
    var vertexPos = cn_pos_CS;

    /// offset to build a small shape  for one particle

    let vertexPos_xy_SS = vertexPos.xy/vertexPos.w ;// x,y   in Screen Space
    let r = (flowUniform.fillWidth + flowUniform.aaWidth*2.0);
    let screenOfs = r / 2.0 * box[vsInput.vertexIndex];//vec2f
    let vertexPos_xy_Ofset = vertexPos_xy_SS + screenOfs / vec2f(flowUniform.canvasSize);
    
    // let vertexPos = vertexPos_xy_Ofset * vertexPos.w

    var output: VertexOutput;
    output.position = vec4f(vertexPos_xy_Ofset * vertexPos.w, vertexPos.zw);
    output.speedRate = attributes[c_address];
    output.coords = boxCoords[vsInput.vertexIndex];

    return output;
}

fn colorFromInt(color: u32) -> vec3f {
    
    let b = f32(color & 0xFF) / 255.0;
    let g = f32((color >> 8) & 0xFF) / 255.0;
    let r = f32((color >> 16) & 0xFF) / 255.0;

    return vec3f(r, g, b);
}

fn velocityColor(speed: f32, rampColors: array<u32, 8>) -> vec3f {
    
    let bottomIndex = floor(speed * 10.0);
    let topIndex = mix(bottomIndex + 1.0, 7.0, step(6.0, bottomIndex));
    let interval = mix(1.0, 4.0, step(6.0, bottomIndex));

    let slowColor = colorFromInt(rampColors[u32(bottomIndex)]);
    let fastColor = colorFromInt(rampColors[u32(topIndex)]);

    return mix(slowColor, fastColor, (speed * 10.0 - f32(bottomIndex)) / interval);
}



@fragment
fn fMain(fsInput: VertexOutput) -> @location(0) vec4f {

    let rampColors0 = array<u32, 8>(
        0x3288bd,
        0x66c2a5,
        0xabdda4,
        0xe6f598,
        0xfee08b,
        0xfdae61,
        0xf46d43,
        0xd53e4f
    );

    let radius = fsInput.coords.x * fsInput.coords.x +  fsInput.coords.y * fsInput.coords.y;
    var alpha = select(0.0, sin((1.0 - radius) * 3.141592653 / 2.0), radius <= 1.0);
    // let alpha = 1.0;

    let color = velocityColor(fsInput.speedRate, rampColors0);
    if (fsInput.speedRate < 0.03)
    {
        alpha = 0.0;
    }
    return vec4f(color, 1.0) * alpha;
    // return vec4f(color, 1.0);
    // let out = vec4f(1.0, 1.0, 1.0, 1.0) * alpha * fsInput.alphaDegree;
    // return vec4f(out.xyz, out.w * 0.2);
}