struct LayerInfo{
    layerNum:u32,
    totalHeight:f32,
    heightArrayLength:u32,
}

struct uniformBlock{
    canvasSize:vec2u,
    particleNum:u32,
    speedFactor:f32,
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,
    layerInfo:LayerInfo,
}

struct vertexInput{
    @builtin(global_invocation_id) iid:vec3u,
    @builtin(workgroup_id) wid:vec3u
    //这两个应是一样的
}
@group(0) @binding(0) var<uniform> ublock:uniformBlock;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;
@group(1) @binding(3) var<storage,read> nowLayer:u32;

@group(2) @binding(0) var<storage,read_write> particleInfo:array<f32>;
@group(2) @binding(1) var<storage,read> indirectDispatchBuffer:array<u32>;
@group(2) @binding(2) var<storage,read> old_baseArray:array<u32>;
@group(2) @binding(3) var<storage,read> indexArray:array<u32>;
@group(2) @binding(4) var<storage,read_write> layeredParticleCount:array<atomic<u32>>;
@group(2) @binding(5) var<storage,read> heightArray:array<u32>;
override blockSize: u32;

fn getLayerfromBuffer(height:f32)
->u32{
    let mappedZ:f32 = height / ublock.layerInfo.totalHeight * f32(ublock.layerInfo.heightArrayLength);
    let layerID = heightArray[u32(mappedZ)];
    return layerID;
}



fn getParticleIndex3(invocationID:vec3u,thisLayerIndex:u32)
->u32{

    var startAddress = old_baseArray[thisLayerIndex];
    var endAddress = old_baseArray[thisLayerIndex+1];
    var particleIndex:u32;

    let groupNumx = indirectDispatchBuffer[thisLayerIndex*3+0];
    let address = startAddress + (invocationID.x + invocationID.y * blockSize * groupNumx);

    // let address = invocationID + startAddress;
    if(address < endAddress && address >= startAddress ){
        particleIndex = indexArray[address];
    }
    else 
    {
        particleIndex = ublock.particleNum+1;
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

    if(originInfo.z<ublock.layerInfo.totalHeight)
    {
        let low_speed = getSpeed2(originInfo.xy,lowTex,textureSize);
        let high_speed= getSpeed2(originInfo.xy,highTex,textureSize);
        // let speed = clamp(mix(low_speed,high_speed,0.2),ublock.speedBoundary.x,ublock.speedBoundary.y);
        let speed = low_speed;
        let moveunit = ublock.speedFactor / 10.0 ;
        let newZ = originInfo.z + moveunit*speed;
        
        let speedRate = getSpeedRate(speed);
        
        return vec4f(originInfo.xy,newZ,speedRate);
    }
    else {
        return originInfo;
    }

}

fn updateLayeredParticleCount(layerID:u32)
{
    atomicAdd(&(layeredParticleCount[layerID*3]),1);
}


@compute @workgroup_size(blockSize,blockSize,1)
fn cMain(input:vertexInput)
{
  
    //new solution
    let pIndex:u32 = getParticleIndex3(input.iid,nowLayer); 
    //get valid particle index
    if( pIndex != ublock.particleNum+1)
    {
        //1.simulate
        var simuResult = simulation(pIndex);

        //2.storage
        particleInfo[4*pIndex]  = simuResult.x;
        particleInfo[4*pIndex+1]= simuResult.y;
        particleInfo[4*pIndex+2]= simuResult.z;
        particleInfo[4*pIndex+3]= simuResult.w;

        //3.count
        let layerAfterSimu = getLayerfromBuffer(simuResult.z);

        if(layerAfterSimu != ublock.layerInfo.layerNum+1)
        {
            updateLayeredParticleCount(layerAfterSimu);
        }
    }
}