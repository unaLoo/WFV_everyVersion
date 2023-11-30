struct ts{
    t:f32,
    s:u32,
}

struct uniformBlock{
    canvasSize:vec2u,
    particleNum:u32,
    deltaHeight:f32,
    totalLayers:u32,//9
    totalHeight:f32,
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,
    myts:ts,
}

struct vertexInput{
    @builtin(global_invocation_id) iid:vec3u,
    @builtin(workgroup_id) wid:vec3u,
    //这两个应是一样的
}
@group(0) @binding(0) var<uniform> ublock:uniformBlock;
@group(0) @binding(1) var heightTex:texture_2d<f32>;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;
@group(1) @binding(3) var<storage,read> nowLayer:u32;

@group(2) @binding(0) var<storage,read_write> particleInfo:array<f32>;//pnum*4  x,y,z,attrib
@group(2) @binding(1) var<storage> indirectDispatchBuffer:array<u32>;
@group(2) @binding(2) var<storage,read_write> old_baseArray:array<u32>;//layerNum
@group(2) @binding(3) var<storage,read_write> indexArray:array<u32>;//particleNum,indexArray
@group(2) @binding(4) var<storage,read_write> justOffset:array<atomic<u32>>;
@group(2) @binding(5) var<storage,read_write> layeredParticleCount:array<atomic<u32>>;//for indirectly dispatch, 3*4bytes per stride
@group(2) @binding(6) var<storage,read_write> baseArray:array<u32>;

override blockSize: u32;

fn decodeHeightTexel(texel:vec4f)
->u32{
    return u32(texel.a * 255.0);
}

fn getLayerfromTex(particleIndex:u32)
->u32{

    let zValue = particleInfo[ particleIndex * 4 + 2 ];
    let hTexSize = textureDimensions(heightTex,0);

    let uv = vec2f(zValue/ublock.totalHeight , 0.0);
    let coords = vec2u(uv * vec2f(hTexSize));

    let layerID = decodeHeightTexel(textureLoad(heightTex,coords,0).rgba);
    
    if(coords.x > hTexSize.x){
        //纹理越界，回返回0,导致所有base++
        return ublock.totalLayers+1;//error tag
    }

    return layerID;

}


fn getParticleIndex2(invocationID:u32,thisLayerIndex:u32)
->u32{

    var startAddress = old_baseArray[thisLayerIndex];
    var endAddress = old_baseArray[thisLayerIndex+1]; 
    var particleIndex:u32;

    let address = invocationID + startAddress;
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

    if(originInfo.z<ublock.totalHeight)
    {
        let low_speed = getSpeed2(originInfo.xy,lowTex,textureSize);
        let high_speed= getSpeed2(originInfo.xy,highTex,textureSize);
        // let speed = clamp(mix(low_speed,high_speed,0.2),ublock.speedBoundary.x,ublock.speedBoundary.y);
        let speed = low_speed;
        let moveunit = ublock.deltaHeight / 10.0 ;
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


@compute @workgroup_size(1,1,1)
fn cMain(input:vertexInput)
{
  
    //new solution
    let pIndex:u32 = getParticleIndex2(input.wid.x,nowLayer); 
    let bs = blockSize;
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
        let layerAfterSimu = getLayerfromTex(pIndex);

        if(layerAfterSimu != ublock.totalLayers+1)
        {
            updateLayeredParticleCount(layerAfterSimu);
        }
    }
}