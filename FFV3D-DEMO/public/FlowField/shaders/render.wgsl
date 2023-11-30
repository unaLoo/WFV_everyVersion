struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32,
    @location(0) position: vec2f,//no
    @location(1) texcoords: vec2f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) @interpolate(perspective, center) uv: vec2f,
    @location(1) @interpolate(perspective, center) speedRate: f32,
    @location(2) @interpolate(perspective, center) edgeParam: f32,
    @location(3) @interpolate(perspective, center) alphaDegree: f32,
}

struct UniformBlock1{
    groupSize: vec2u,
    canvasSize: vec2u,
}

struct UniformBlock2 {
    progress: f32,
    segmentNum: f32,
    fullLife: f32,
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
}

// Uniform bindings
@group(0) @binding(0) var<uniform> flowUniform1:UniformBlock1;
@group(0) @binding(1) var<uniform> flowUniform: UniformBlock2;

// Texture bindings
@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var fTexture: texture_2d<f32>;
@group(1) @binding(2) var seedingTexture: texture_2d<f32>;

// Storage bindings
@group(2) @binding(0) var<storage> data_v: array<f32>;//particle position buffer
@group(2) @binding(1) var<storage> indexArray_v: array<u32>;//aliveIndex buffer
@group(2) @binding(2) var<storage> attributes: array<f32>;//attributeBuffer

//注意：：
//一个实例类似一个粒子形成的轨迹
//一个粒子轨迹由<=segNum个原顶点构成
//要绘制条形的粒子，每个粒子往朝着两侧拓展偏移两个点，那么四个点两个三角形就可以构成最一个条状轨迹

fn get_address(nodeIndex: u32, instanceIndex: u32) -> u32 {
    //nodeIndex 原顶点ID ， instanceIndex 粒子ID 
    // Calculate the blockIndex of the current node
    //let blockIndex = (u32(flowUniform.startStorageIndex) - nodeIndex + u32(flowUniform.maxSegmentNum)) % u32(flowUniform.maxSegmentNum);
    let blockIndex = (u32(flowUniform.startStorageIndex)+(u32(flowUniform.maxSegmentNum) - nodeIndex))% u32(flowUniform.maxSegmentNum);
    //弄清楚这里的 - nodeIndex  为何不是加
    // Calculate original address of the block
    let blockAddress = blockIndex * u32(flowUniform.maxParticleNum);

    // Calculate address of the current node
    let nodeAddress = blockAddress + indexArray_v[instanceIndex];

    return nodeAddress;
}

fn ReCoordinate(pos: vec2f) -> vec4f {

    return vec4f(pos * 2.0 - 1.0, 0.0, 1.0);//-1,1   canvas gl坐标
    // return vec4f(pos,0.0,1.0);
}

fn transfer_to_clip_space(pos: vec2f) -> vec4f {
    
    return ReCoordinate(pos);
}

fn get_clip_position(address: u32) -> vec4f {

    return transfer_to_clip_space(vec2f(data_v[2 * address], data_v[2 * address + 1]));
}

fn get_vector(beginVertex: vec2f, endVertex: vec2f) -> vec2f {
    
    return normalize(endVertex - beginVertex);
}

//这里完全是针对实例化渲染来写的，不像computeshader是完全按storagebuffer来的
//所以这里  实例化的顶点----storagebuffer对应存储位置   这个映射很重要
@vertex
fn vMain(vsInput: VertexInput) -> VertexOutput {

    // Get screen positions from particle pool
    let parity = f32(vsInput.vertexIndex % 2);
    let currentNode = vsInput.vertexIndex / 2;
    let nextNode = currentNode + 1;
    let c_address = get_address(currentNode, vsInput.instanceIndex);
    let n_address = get_address(nextNode, vsInput.instanceIndex);
    let cn_pos_CS = get_clip_position(c_address);
    let nn_pos_CS = get_clip_position(n_address);
    let cn_pos_SS = cn_pos_CS.xy / cn_pos_CS.w;
    let nn_pos_SS = nn_pos_CS.xy / nn_pos_CS.w;

    // Calculate the screen offset
    let lineWidth = (flowUniform.fillWidth + flowUniform.aaWidth * 2.0);
    let cn_vector = get_vector(cn_pos_SS, nn_pos_SS);
    let screenOffset = lineWidth / 2.0;

    // Translate current vertex position
    let view = vec3f(0.0, 0.0, 1.0);
    let v_offset = normalize(cross(view, vec3f(cn_vector, 0.0))).xy * mix(1.0, -1.0, parity);
    let vertexPos_SS = cn_pos_SS + v_offset * screenOffset / vec2f(flowUniform1.canvasSize);

    ////////////////////
    // Calculate vertex position in screen coordinates
    let vertexPos_CS = vertexPos_SS * cn_pos_CS.w;
    let segmentRate = f32(currentNode) / flowUniform.maxSegmentNum;

    var output: VertexOutput;
    output.position = vec4f(vertexPos_CS, 0.0, cn_pos_CS.w);
    output.speedRate = attributes[c_address];
    output.edgeParam = 2.0 * parity - 1.0;
    output.alphaDegree = 1.0 - segmentRate;

    ///////
    // let aliveIndex = indexArray_v[vsInput.instanceIndex] + u32(flowUniform.startStorageIndex * flowUniform.maxParticleNum);

    // let centerPos_CS = vec2f(data_v[2 * aliveIndex], data_v[2 * aliveIndex + 1]);
    // // let centerPos_CS = vec2f(data_v[2 * vsInput.instanceIndex], data_v[2 * vsInput.instanceIndex + 1]);
    // var centerPos_SS = vec2f(centerPos_CS * 2.0 - vec2f(1.0));
    // var screenOffset1 = 1.0 * vsInput.position * 2.0 / vec2f(flowUniform.canvasSize);

    // var output: VertexOutput;
    // output.position = vec4f(centerPos_SS + screenOffset1, 0.0, 1.0);
    output.uv = vsInput.texcoords;

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

fn getAlpha(param: f32) -> f32 {

    if (flowUniform.aaWidth == 0.0) {
        return 1.0;
    }
    else {
        return 1.0 - sin(clamp((param * (0.5 * flowUniform.fillWidth + flowUniform.aaWidth) - 0.5 * flowUniform.fillWidth) / flowUniform.aaWidth, 0.0, 1.0) * 2.0 / 3.141592653);
    }
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

    let alpha = getAlpha(abs(fsInput.edgeParam));
    let color = velocityColor(fsInput.speedRate, rampColors0);
    return vec4f(color, 1.0) * alpha * fsInput.alphaDegree;
    // return vec4f(0.0,1.0,0.0,1.0);
}