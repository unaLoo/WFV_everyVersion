////////////////render
struct uniformBlock{
    ///static for all particles
    canvasSize:vec2u,
    particleNum:f32,
    deltaHeight:f32,
    totalLayers:u32,//10张纹理,中间9层，totallayers = 9
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,
}
struct VertexInput {
    @builtin(vertex_index) vertexIndex:u32,
    @builtin(instance_index) instanceIndex:u32,
}

struct VertexOutput {
    @builtin(position) position:vec4f,
    @location(0) speedRate:f32,
}

@group(0) @binding(0) var<uniform> ublock1:uniformBlock;
@group(0) @binding(1) var mySampler:sampler;
@group(0) @binding(2) var transformTex:texture_2d<f32>;
@group(0) @binding(3) var<storage,read> indexArray:array<u32>;
@group(0) @binding(4) var<storage,read> particleInfo:array<f32>;//x,y,z,

fn ReCoordinate(pos:vec3f)
->vec4f{
    let textureSize = textureDimensions(transformTex,0);
    let coords = vec2u( pos.xy*vec2f(textureSize));
    //注意这里取整了，实际是不是应该插值？ 好像不需
    var geoPos = textureLoad(transformTex,coords,0).xy; ////worldspace
    var resultPos = ublock1.matrix * vec4f(geoPos,pos.z,1.0);////clip，带w
    // resultPos = vec4f(resultPos.x/resultPos.w,resultPos.y/resultPos.w,resultPos.z/resultPos.w,1.0);
    return resultPos;
}

fn GetVertexAddress(instanceIndex:u32)
->u32{
    let particleAddress = indexArray[instanceIndex];
    return particleAddress;
    // return instanceIndex;
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
    // let box = array(vec2f(0.0,0.0),vec2f(0.0,30.0),vec2f(30.0,0.0),vec2f(30.0,30.0));


    //这里的Ads是原始粒子位置，基于实例index查找的
    let vertexAds = GetVertexAddress(input.instanceIndex);
    let vertexPos = GetVertexPostion_ClipSpace(vertexAds);//ClipSpace，带w

    /// offset to build a small shape  for one particle
    let fillWidth = 1.0;
    let aaWidth = 1.0;
    let vertexPos_xy_SS = vertexPos.xy/vertexPos.w ;// x,y   in Screen Space
    let r = (fillWidth + aaWidth*2.0);
    let screenOfs = r / 2.0 * box[input.vertexIndex];//vec2f
    let vertexPos_xy_Ofset = vertexPos_xy_SS + screenOfs / vec2f(ublock1.canvasSize);

    let speedRate = GetSpeedRate(vertexAds);
    var output:VertexOutput;
    output.position = vec4f(vertexPos_xy_Ofset*vertexPos.w,vertexPos.zw);
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