// struct LayerInfo{
//     layerNum: u32,
//     maxHeight: f32,
//     heightArrayLength: u32,
//     unitHeight: f32,
// }

struct UniformBlock{
    // groupSize: vec2u,
    canvasSize: vec2u,
    
    // progress: f32,
    particleNum: u32,
    // dropRate: f32,
    // dropRateBump: f32,
    // randomSeed: f32,
    // speedFactor: f32,
    // zspeedBoundary: vec2f,//speed_min , speed_max
    // flowBoundary: vec4f, // vec4f(uMin, vMin, uMax, vMax)
    u_centerHigh: vec2f,
    u_centerLow: vec2f,
    // speedBoundary: array<f32,6>,
    u_matrix: mat4x4f,
    // layerInfo: LayerInfo,
}
struct VertexInput {
    @builtin(vertex_index) vertexIndex:u32,
    @builtin(instance_index) instanceIndex:u32,
}

struct VertexOutput {
    @builtin(position) position:vec4f,
    @location(0) speedRate:f32,
}

@group(0) @binding(0) var<unifrom> ubo: UniformBlock;
@group(0) @binding(1) var mySampler:sampler;
@group(0) @binding(2) var transformHighTexture:texture_2d<f32>;
@group(0) @binding(3) var transformLowTexture:texture_2d<f32>;
@group(0) @binding(4) var<storage,read> indexArray:array<u32>;
@group(0) @binding(5) var<storage,read> particleInfo:array<f32>;//x,y,z,

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


fn ReCoordinate(pos:vec3f)
->vec4f{
    // let textureSize = textureDimensions(transformTex,0);
    // let coords = vec2u( pos.xy*vec2f(textureSize));
    // var geoPos = textureLoad(transformTex,coords,0).xy; ////worldspace
    let geoPos = sampleGeoPosition(pos.xy);
    var resultPos = ubo.matrix * vec4f(geoPos,pos.z,1.0);////clip，带w
    // resultPos = vec4f(resultPos.x/resultPos.w,resultPos.y/resultPos.w,resultPos.z/resultPos.w,1.0);
    return resultPos;
}

fn GetVertexAddress(instanceIndex:u32)
->u32{
    let particleAddress = indexArray[instanceIndex];
    return particleAddress;
}

fn GetVertexPostion_ClipSpace(vertexAds:u32)
->vec4f{
    var particleAddress = vertexAds;
    let pos_LocalSpace = vec3f(particleInfo[particleAddress*4],particleInfo[particleAddress*4+1],particleInfo[particleAddress*4+2]);
    let pos_ClipSpace  = ReCoordinate(pos_LocalSpace);//vec4f
    
    return pos_ClipSpace;
}

fn GetSpeedRate(vertexAds:u32)
->f32{
    let particleAddressOffset = vertexAds;
    return particleInfo[particleAddressOffset*4+3];
}

fn colorFromInt(color: u32) -> vec3f {
    
    let b = f32(color & 0xFF) / 255.0;
    let g = f32((color >> 8) & 0xFF) / 255.0;
    let r = f32((color >> 16) & 0xFF) / 255.0;

    return vec3f(r, g, b);
}


fn GetColorbySpeedRate(speedRate:f32 , rampColors: array<u32, 8>)
->vec4f{
    let bottomIndex = floor(speedRate * 10.0);
    let topIndex = mix(bottomIndex + 1.0, 7.0, step(6.0, bottomIndex));
    let interval = mix(1.0, 4.0, step(6.0, bottomIndex));

    let slowColor = colorFromInt(rampColors[u32(bottomIndex)]);
    let fastColor = colorFromInt(rampColors[u32(topIndex)]);

    let color = mix(slowColor, fastColor, (speedRate * 10.0 - f32(bottomIndex)) / interval);
    return vec4f(color,0.9);
}


@vertex
fn vMain(input:VertexInput)
->VertexOutput{

    let box = array(vec2f(0.0,0.0),vec2f(0.0,3.0),vec2f(3.0,0.0),vec2f(3.0,3.0));

    //这里的Ads是原始粒子位置，基于实例index查找的
    let vertexAds = GetVertexAddress(input.instanceIndex);
    let vertexPos = GetVertexPostion_ClipSpace(vertexAds);//ClipSpace，带w

    /// offset to build a small shape  for one particle
    let fillWidth = 1.0;
    let aaWidth = 1.0;
    let vertexPos_xy_SS = vertexPos.xy/vertexPos.w ;// x,y   in Screen Space
    let r = (fillWidth + aaWidth*2.0);
    let screenOfs = r / 2.0 * box[input.vertexIndex];//vec2f
    let vertexPos_xy_Ofset = vertexPos_xy_SS + screenOfs / vec2f(ubo.canvasSize);

    let speedRate = GetSpeedRate(vertexAds);
    var output:VertexOutput;
    output.position = vec4f(vertexPos_xy_Ofset * vertexPos.w, vertexPos.zw);
    output.speedRate = speedRate;
    
    return output;
}

@fragment
fn fMain(input:VertexOutput)
->@location(0) vec4f{
    let rampColors = array<u32, 8>(
        0x3288bd,
        0x66c2a5,
        0xabdda4,
        0xe6f598,
        0xfee08b,
        0xfdae61,
        0xf46d43,
        0xd53e4f
    );
    let color = GetColorbySpeedRate(input.speedRate,rampColors);
    return color;
    // return vec4f(1.0,0.0,0.0,0.5);
}