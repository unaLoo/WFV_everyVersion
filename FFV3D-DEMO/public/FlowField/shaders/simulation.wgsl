struct UniformBlock1 {
    groupSize: vec2u, //groupNum x , groupNum y
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
@group(0) @binding(0) var<uniform> flowUniform1: UniformBlock1;
@group(0) @binding(1) var<uniform> flowUniform: UniformBlock2;

// Texture bindings
@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var fTexture: texture_2d<f32>;
@group(1) @binding(2) var seedingTexture: texture_2d<f32>;

// Storage bindings
@group(2) @binding(0) var<storage, read_write> particlePosition: array<f32>;//particlePositionBuffer    vec2 (x,y)
@group(2) @binding(1) var<storage, read_write> indexArray: array<u32>;//aliveIndexbuffer   uint[i] 
@group(2) @binding(2) var<storage, read_write> aliveNum: atomic<u32>;//aliveNumBuffer   just one uint
@group(2) @binding(3) var<storage, read_write> particleAge: array<f32>;//ageBuffer
@group(2) @binding(4) var<storage, read_write> particleAttribute: array<f32>;//attributeBuffer
@group(2) @binding(5) var<storage, read_write> writeTest: array<f32>;//WRITEBUFFER TEST
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

fn is_in_flow_progress(position: vec2f) -> f32 {

    let textureSize = textureDimensions(seedingTexture, 0);
    let uv = vec2u(position * vec2f(textureSize));
    let color1 = textureLoad(seedingTexture, uv, 0);
    // let color1 = textureLoad(seedingTexture, uv, 0);

    let xy1 = vec2u((u32(color1.x * 255.0) << 8) + u32(color1.y * 255.0), (u32(color1.z * 255.0) << 8) + u32(color1.w * 255.0));
    return select(0.0, 1.0, (xy1.x == uv.x) && (xy1.y == uv.y));
}

fn get_speed(uv: vec2u) -> vec2f {

    return textureLoad(fTexture, uv, 0).xy; //textureLoad -- return the unfiltered texel data
}

fn lookup_speed(position: vec2f) -> vec2f {
    
    let textureSize = textureDimensions(seedingTexture, 0);
    let uv = vec2u(position * vec2f(textureSize)); //整型坐标，无插值

    let lSpeed = mix(flowUniform.flowBoundary.xy, flowUniform.flowBoundary.zw, get_speed(uv));
    // let lSpeed1 = mix(flowUniform.flowBoundary.xy, flowUniform.flowBoundary.zw, get_speed(uv));//?
    // let lSpeed2 = mix(flowUniform.flowBoundary.xy, flowUniform.flowBoundary.zw, get_speed(uv));//?
    // let lSpeed3 = mix(flowUniform.flowBoundary.xy, flowUniform.flowBoundary.zw, get_speed(uv));//?

    return lSpeed;
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

fn die(particleIndex: u32, nextIndex: u32, nextOffset: u32, particleInfo: vec4f) {

    let seed = flowUniform.randomSeed + particleInfo.xy;
    let texcoords = vec2f(rand(seed + 1.4), rand(seed + 2.1));

    let textureSize = vec2f(textureDimensions(seedingTexture, 0));
    let uv = vec2u(texcoords * textureSize);
    
    let rebirthColor = textureLoad(seedingTexture, uv, 0);
    var rebirth_x = f32((u32(rebirthColor.x * 255.0) << 8) + u32(rebirthColor.y * 255.0));
    var rebirth_y = f32((u32(rebirthColor.z * 255.0) << 8) + u32(rebirthColor.w * 255.0));
    rebirth_x = rebirth_x + rand(seed + rebirth_x);
    rebirth_y = rebirth_y + rand(seed + rebirth_y);
    let rebirthPos = vec2f(rebirth_x, rebirth_y) / textureSize;
    
    particlePosition[2 * nextIndex] = rebirthPos.x;
    particlePosition[2 * nextIndex + 1] = rebirthPos.y;
    particleAge[nextIndex - nextOffset] = particleInfo.z + 1.0;
    particleAttribute[nextIndex] = speed_rate(lookup_speed(rebirthPos));
}

fn simulation(particleIndex: u32, nextIndex: u32, nextOffset: u32, particleInfo: vec4f) {

    let textureSize = vec2f(textureDimensions(seedingTexture, 0));
    let velocity = lookup_speed(particleInfo.xy);
    let speedRate = speed_rate(velocity);

    var newPos = particleInfo.xy + velocity * flowUniform.speedFactor / textureSize;
    newPos = clamp(newPos, vec2f(0.0), vec2f(1.0));
    
    let dropped = drop(speedRate, particleInfo.xy) * is_in_flow_progress(newPos);
    // let dropped = drop(speedRate, particleInfo.xy);

    //重生点：原位置，初始age，attrib = 0
    let rebirthInfo = vec4f(particleInfo.xy, flowUniform.fullLife - flowUniform.segmentNum, particleInfo.w);
    let newInfo = vec4f(newPos, particleInfo.z + 1.0, speedRate);
    let realInfo = mix(rebirthInfo, newInfo, dropped);//if drop=0 rebirth; eles newInfo;

    //posbuffer -- size:: segNum*ParticleNum*2
    //AgeBuffer -- size:: particleNum
    //AtrBuffer -- size:: segNum*ParticleNum

    particlePosition[2 * nextIndex] = realInfo.x;
    particlePosition[2 * nextIndex + 1] = realInfo.y;
    particleAge[nextIndex - nextOffset] = realInfo.z;
    particleAttribute[nextIndex] = realInfo.w;
}

fn freeze(particleIndex: u32, nextIndex: u32, nextOffset: u32, particleInfo: vec4f) {

    particlePosition[2 * nextIndex] = particleInfo.x;
    particlePosition[2 * nextIndex + 1] = particleInfo.y;
    particleAge[nextIndex - nextOffset] = particleInfo.z + 1.0;
    particleAttribute[nextIndex] = particleInfo.w;
}

fn rebirth(particleIndex: u32, nextIndex: u32, nextOffset: u32, particleInfo: vec4f) {

    particlePosition[2 * nextIndex] = particleInfo.x;
    particlePosition[2 * nextIndex + 1] = particleInfo.y;
    particleAge[nextIndex - nextOffset] = 0.0;
    particleAttribute[nextIndex] = particleInfo.w;
}

@compute @workgroup_size(blockSize, blockSize, 1)
fn cMain(@builtin(global_invocation_id) id: vec3<u32>) {
    //id: vec3<u32>  三个分量分别是该线程在工作组中的xyz方向的索引
    let indexOffset = u32(flowUniform.startReadIndex * flowUniform.maxParticleNum);
    let nextIndexOffset = u32(flowUniform.startStorageIndex * flowUniform.maxParticleNum);
    let particleIndex = indexOffset + id.y * flowUniform1.groupSize.x * blockSize + id.x;
    let nextIndex = nextIndexOffset + id.y * flowUniform1.groupSize.x * blockSize + id.x;//blocksize=16，groupsize=4
    // let nextIndex = particleIndex;

    // let particleIndex = id.y * flowUniform1.groupSize.x * blockSize + id.x;
    let currentPos = vec2f(particlePosition[2 * particleIndex], particlePosition[2 * particleIndex + 1]);
    let currentAge = particleAge[particleIndex - indexOffset];
    let currentAttribute = particleAttribute[particleIndex];
    let particleInfo = vec4f(currentPos, currentAge, currentAttribute);

    if (currentAge < flowUniform.fullLife - flowUniform.segmentNum) {
        simulation(particleIndex, nextIndex, nextIndexOffset, particleInfo);
    }
    else if (currentAge == flowUniform.fullLife) {
        die(particleIndex, nextIndex, nextIndexOffset, particleInfo);
    }
    else if (abs(flowUniform.fullLife - currentAge) <= flowUniform.segmentNum) {
        freeze(particleIndex, nextIndex, nextIndexOffset, particleInfo);
    }
    else {
        rebirth(particleIndex, nextIndex, nextIndexOffset, particleInfo);
    }

    // indexArray[atomicAdd(&aliveNum, 1)] = particleIndex - indexOffset;

    // if (particleAge[nextIndex - nextIndexOffset] < flowUniform.segmentNum * 9.0) {

    //     // indexArray[atomicAdd(&aliveNum, 1)] = nextIndex;
    //     indexArray[atomicAdd(&aliveNum, 1)] = particleIndex - indexOffset;
    //     // indexArray[atomicAdd(&aliveNum, 1)] = id.y * flowUniform.groupSize.x * blockSize + id.x;;
    // }


    if (particleAge[nextIndex - nextIndexOffset] < flowUniform.fullLife) {
        indexArray[atomicAdd(&aliveNum, 1)] = particleIndex - indexOffset;// simular 
    }

    // ///test for simulation Phase

    //for logic
    writeTest[0] = 99.9;
    /////////////////////////OK  

    //foruniform2       
    // writeTest[1] = flowUniform.segmentNum;
    // writeTest[2] = flowUniform.fullLife;
    // writeTest[3] = flowUniform.dropRate;
    // writeTest[4] = flowUniform.dropRateBump;
    // writeTest[5] = flowUniform.startStorageIndex;
    // writeTest[6] = flowUniform.maxParticleNum;
    // writeTest[7] = flowUniform.flowBoundary.x;
    // writeTest[8] = flowUniform.flowBoundary.y;
    ////////////////////////OK

    //foruniform1
    // writeTest[0] = flowUniform1.groupSize.x;
    // writeTest[1] = flowUniform1.groupSize.y;
    // writeTest[2] = flowUniform1.canvasSize.x;
    // writeTest[3] = flowUniform1.canvasSize.y;
    /////////////////////////OK

    //for postion 直接外面创一个buffer把position copy出去,比对input和output
    // particlePosition[0] = particlePosition[0]+1;
    // particlePosition[0] = 6.0;
    /////////////////////////OK


    //for alivenum 从外面的testbuffer读取数据,获取当前帧的alive particle num
    /////////////////////////OK

    //for texture 用writebuffer取数据,看能否取到
    // let testTexel = textureLoad(seedingTexture, vec2u(21,4), 0);
    // writeTest[0] = testTexel.x;
    // writeTest[1] = testTexel.y;
    // writeTest[2] = testTexel.z;
    // writeTest[3] = testTexel.w;
    /////////////////////////OK
}