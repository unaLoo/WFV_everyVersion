
struct uniformBlock{
    canvasSize:vec2u,
    particleNum:u32,
    deltaHeight:f32,
    totalLayers:u32,//9
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,
}

struct vertexInput{
    @builtin(global_invocation_id) iid:vec3u,
    @builtin(workgroup_id) wid:vec3u,
    //这两个应是一样的
}
@group(0) @binding(0) var<uniform> ublock:uniformBlock;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;
@group(1) @binding(3) var<storage,read> nowLayer:array<u32>;

@group(2) @binding(0) var<storage,read_write> particleInfo:array<f32>;//pnum*4  x,y,z,attrib
@group(2) @binding(1) var<storage,read_write> layoutBaseArray:array<atomic<u32>>;//layerNum
@group(2) @binding(2) var<storage,read_write> old_layoutBaseArray:array<u32>;//layerNum
@group(2) @binding(3) var<storage,read_write> indirect_aliveNum:array<atomic<u32>>;//4
@group(2) @binding(4) var<storage,read_write> layeredLayoutIndex:array<u32>;//particleNum,indexArray
@group(2) @binding(5) var<storage,read_write> particleLayerIndex:array<u32>;//particleNum，存i粒子的索引
@group(2) @binding(6) var<storage,read_write> justOffset:array<u32>;


fn getParticleLayer(pIndex:u32)
->u32{
    return particleLayerIndex[pIndex];
}

fn getParticleIndex(invocationID:u32,thisLayerIndex:u32)
->u32{
    let base = old_layoutBaseArray[thisLayerIndex];
    let pID = layeredLayoutIndex[invocationID + base];
    // let pID = invocationID + base;
    // return pID;

    return invocationID;
} 

fn getParticleIndex2(invocationID:u32,thisLayerIndex:u32)
->i32{
    var startAddress = old_layoutBaseArray[thisLayerIndex];
    var endAddress:u32; 
    var particleAds:i32;
    var particleIndex:i32;
    if(thisLayerIndex == (ublock.totalLayers - 1 ) ) {
        endAddress = ublock.particleNum;
    }
    else{
        endAddress = old_layoutBaseArray[ thisLayerIndex+1 ];
    }

    if(invocationID < endAddress && invocationID >= startAddress)
    {
        particleAds  = i32(invocationID);
        particleIndex = i32(layeredLayoutIndex[particleAds]);
    }
    else 
    {
        particleAds = -1;
        particleIndex = -1;
    }
    return particleIndex;
}

fn getf32fromrgba(color:vec4f)
->f32{
    var f32value = f32((u32(color.x*255.0)<<24)+(u32(color.x*255.0)<<16)+(u32(color.x*255.0)<<8)+u32(color.x*255.0));
    
    let m = 256.0*256.0*256.0*256.0 - 1.0 ;
    
    f32value = mix(ublock.speedBoundary.x , ublock.speedBoundary.y , f32value/m );//makesure between min,max
    
    return f32value;
}

fn getSpeed(uv: vec2f, fTexture: texture_2d<f32> , textureSize:vec2u) 
->f32{

    var f = fract(uv);
    var parity = vec2i(select(-1, 1, f.x >= 0.5), select(-1, 1, f.y >= 0.5));
    let uv0 = vec2i(uv);
    let uv1 = uv0 + vec2i(parity.x, 0);
    let uv2 = uv0 + vec2i(0, parity.y);
    let uv3 = uv0 + vec2i(parity.x, parity.y);


    let speed0 = getf32fromrgba(textureLoad(fTexture, vec2u(vec2f(uv0)*vec2f(textureSize)), 0).rgba);
    let speed1 = getf32fromrgba(textureLoad(fTexture, vec2u(vec2f(uv1)*vec2f(textureSize)), 0).rgba) ;
    let speed2 = getf32fromrgba(textureLoad(fTexture, vec2u(vec2f(uv2)*vec2f(textureSize)), 0).rgba) ;
    let speed3 = getf32fromrgba(textureLoad(fTexture, vec2u(vec2f(uv3)*vec2f(textureSize)), 0).rgba) ;

    let lerp = abs(f - vec2f(0.5));
    let speed =  mix(mix(speed0, speed1, lerp.x), mix(speed2, speed3, lerp.x), lerp.y);

    return clamp(speed,ublock.speedBoundary.x,ublock.speedBoundary.y);
}

fn getSpeed2(uv:vec2f, fTexture: texture_2d<f32> , textureSize:vec2u)
->f32{

    let coords = vec2u( uv*vec2f(textureSize) );
    let color = textureLoad(fTexture,coords,0).rgba;
    return getf32fromrgba(color);
}


fn getSpeedRate(speed:f32)
->f32{
    return clamp((speed - ublock.speedBoundary.x)/(ublock.speedBoundary.y - ublock.speedBoundary.x),0.0,1.0);
}

fn simulation(pIndex:u32)
->vec4f{

    let originInfo = vec4f(particleInfo[4*pIndex],particleInfo[4*pIndex+1],particleInfo[4*pIndex+2],particleInfo[4*pIndex+3]);

    let textureSize:vec2u = textureDimensions(lowTex,0);

    let low_speed = getSpeed2(originInfo.xy,lowTex,textureSize);
    let high_speed= getSpeed2(originInfo.xy,highTex,textureSize);
    // let progress = clamp(originInfo.z - ublock.deltaHeight * f32(nowLayer[0]),0.0,1.0);
    let speed = clamp(mix(low_speed,high_speed,0.1),ublock.speedBoundary.x,ublock.speedBoundary.y);
    // let speed = low_speed;
    let moveunit = ublock.deltaHeight / 100.0 ;
    let newZ = originInfo.z + moveunit*speed;
    
    let speedRate = getSpeedRate(speed);
     
    return vec4f(originInfo.xy,newZ,speedRate);

}

fn updateLayoutBaseArray(layerID:u32)
{
    var i = layerID;
    loop{
        if i >= 9 {break;}

        atomicAdd(&(layoutBaseArray[i]),1);

        i++;
    }
}


@compute @workgroup_size(1)
fn cMain(input:vertexInput)
{
  

    // let pIndex = getParticleIndex(input.iid.x,nowLayer[0]);
    // let pIndex = input.iid.x;

    //new solution

    let pIdx:i32 = getParticleIndex2(input.iid.x,nowLayer[0]);
    if( pIdx == -1 )
    {
        return;
    }
    let pIndex = u32(pIdx);


    let pLayer = getParticleLayer(pIndex);

    // if(pLayer == nowLayer[0] && pIndex < ublock.particleNum)
    if( pIndex < ublock.particleNum)
    {

        var simuResult = simulation(pIndex);

        particleInfo[4*pIndex]  = simuResult.x;
        particleInfo[4*pIndex+1]= simuResult.y;
        particleInfo[4*pIndex+2]= simuResult.z;
        particleInfo[4*pIndex+3]= simuResult.w;

        if(simuResult.z <= 1.0 * ublock.deltaHeight){
            updateLayoutBaseArray(1);
            particleLayerIndex[pIndex] = 0;
        }
        if(simuResult.z <= 2.0 * ublock.deltaHeight && simuResult.z > 1.0 * ublock.deltaHeight){
            updateLayoutBaseArray(2);
            particleLayerIndex[pIndex] = 1;
        }
        if(simuResult.z <= 3.0 * ublock.deltaHeight && simuResult.z > 2.0 * ublock.deltaHeight){
            updateLayoutBaseArray(3);
            particleLayerIndex[pIndex] = 2;
        }
        if(simuResult.z <= 4.0 * ublock.deltaHeight && simuResult.z > 3.0 * ublock.deltaHeight){
            updateLayoutBaseArray(4);
            particleLayerIndex[pIndex] = 3;
        }
        if(simuResult.z <= 5.0 * ublock.deltaHeight && simuResult.z > 4.0 * ublock.deltaHeight){
            updateLayoutBaseArray(5);
            particleLayerIndex[pIndex] = 4;
        }
         if(simuResult.z <= 6.0 * ublock.deltaHeight && simuResult.z > 5.0 * ublock.deltaHeight){
            updateLayoutBaseArray(6);
            particleLayerIndex[pIndex] = 5;
        }
        if(simuResult.z <= 7.0 * ublock.deltaHeight && simuResult.z > 6.0 * ublock.deltaHeight){
            updateLayoutBaseArray(7);
            particleLayerIndex[pIndex] = 6;
        }
        if(simuResult.z <= 8.0 * ublock.deltaHeight && simuResult.z > 7.0 * ublock.deltaHeight){
            updateLayoutBaseArray(8);
            particleLayerIndex[pIndex] = 7;
        }
        if(simuResult.z <= 9.0 * ublock.deltaHeight && simuResult.z > 8.0 * ublock.deltaHeight){

            particleLayerIndex[pIndex] = 8;
        }
    }
}