struct uBlock1 {
    groupSize:vec2u,
    canvasSize:vec2u,
    segmentNum:f32,
    startStorageIndex:f32,
    startReadIndex:f32,
    particleNum:f32,
    deltaHeight:f32,
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,//7+16 = 23
    
}

@group(0) @binding(0) var<uniform> ublock1:uBlock1;
@group(0) @binding(1) var mySampler:sampler;
@group(0) @binding(2) var fakeTexture_low:texture_2d<f32>;
@group(0) @binding(3) var fakeTexture_mid:texture_2d<f32>;
@group(0) @binding(4) var fakeTexture_hi:texture_2d<f32>;//取出的速度应该在min max之间插值
@group(0) @binding(5) var transformTex:texture_2d<f32>;
@group(0) @binding(6) var<storage,read_write> particlePosition:array<f32>;//(x,y,z)  ---- particleNum*3
@group(0) @binding(7) var<storage,read_write> particleAttribute:array<f32>;//speedRate -- particleNum

override blockSize: u32;
// pseudo-random generator
fn rand(co: vec2f) -> f32 {
    let rand_constants = vec3f(12.9898, 78.233, 4375.85453);
    let t = dot(rand_constants.xy, co);
    return abs(fract(sin(t) * (rand_constants.z + t)));
}

fn getSpeed(pos:vec2f,fkTex:texture_2d<f32>)
->f32{
    // input is (0,1) vec2
    // f32Value是实际的速度，between min & max
    let textureSize = textureDimensions(fkTex,0);
    let coords = vec2u(pos * vec2f(textureSize));
    let color  = textureLoad(fkTex,coords,0).rgba;
    var f32value = f32((u32(color.x*255.0)<<24)+(u32(color.x*255.0)<<16)+(u32(color.x*255.0)<<8)+u32(color.x*255.0));
    f32value = f32value / f32(256*256*256*256-1);

    f32value = mix(ublock1.speedBoundary.x,ublock1.speedBoundary.y,f32value);//makesure between min,max
    return f32value;
} 

fn getAttribute(speed:f32) 
->f32{
    //attribute是标准化的速度，用于后期着色
    return (speed - ublock1.speedBoundary.x)/(ublock1.speedBoundary.y - ublock1.speedBoundary.x);
}

//transform 是后面renderShader的时候才用的，先在就01模拟即可

fn simulation(downTex:texture_2d<f32>,upTex:texture_2d<f32>, pIndex:u32,npIndex:u32)
{
    //基于nowpos 速度信息 来计算nextpos，nextAttrib
    let pos = vec3f(particlePosition[pIndex*3],particlePosition[pIndex*3+1],particlePosition[pIndex*3+2]);
    
    let zvalue_unit = ublock1.deltaHeight/100; // 每次最多走height/50
    // let progress    = mod(pos.z,ublock1.deltaHeight)/ublock1.deltaHeight;
    let progress = pos.z - ublock1.deltaHeight * floor(pos.z/ublock1.deltaHeight);
    let speed  = mix(getSpeed(pos.xy,downTex),getSpeed(pos.xy,upTex),progress);
    var delta_zvalue= speed*zvalue_unit;
    // delta_zvalue = mix(0.00000,zvalue_unit,delta_zvalue);

    let attrib = getAttribute(speed);
    
    particlePosition[npIndex*3]  = pos.x;
    particlePosition[npIndex*3+1]= pos.y;
    particlePosition[npIndex*3+2]= pos.z + delta_zvalue;
    particleAttribute[npIndex]   = attrib;
     
}


@compute @workgroup_size(blockSize,blockSize,1)
fn cMain(@builtin(global_invocation_id) id:vec3<u32>){

    let particleIndex =  id.y * ublock1.groupSize.x * blockSize + id.x;
    let nxtParticleIndex = id.y * ublock1.groupSize.x * blockSize + id.x;

    let nowPos = vec3f(particlePosition[particleIndex*3],particlePosition[particleIndex*3+1],particlePosition[particleIndex*3+2]);

    if(nowPos.z<ublock1.deltaHeight){

        simulation(fakeTexture_low,fakeTexture_mid,particleIndex,nxtParticleIndex);

    }else if(nowPos.z<2*ublock1.deltaHeight){

        simulation(fakeTexture_mid,fakeTexture_hi,particleIndex,nxtParticleIndex);

    }else {

        // freeze
        particlePosition[nxtParticleIndex*3]=particlePosition[particleIndex*3];
        particlePosition[nxtParticleIndex*3+1]=particlePosition[particleIndex*3+1];
        particlePosition[nxtParticleIndex*3+2]=2*ublock1.deltaHeight;
        particleAttribute[nxtParticleIndex] = particleAttribute[particleIndex];

    }
    // let testPost = vec2f(0.2,0.91111);
    // particleAttribute[particleIndex] = getSpeed(testPost,fakeTexture_low);


}
