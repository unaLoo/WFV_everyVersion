
struct uniformBlock{
    ///static for all particles
    canvasSize:vec2u,
    particleNum:f32,
    deltaHeight:f32,
    totalLayers:u32,//10张纹理,中间9层，totallayers = 9
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,
}

@group(0) @binding(0) var<uniform> ublock:uniformBlock;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;

@group(2) @binding(0) var<storage,read_write> particleInfo:array<f32>;
@group(2) @binding(1) var<storage,read_write> old_layoutBase:array<u32>;
@group(2) @binding(2) var<storage,read_write> new_layoutBase:array<atomic<u32>,9>;
@group(2) @binding(3) var<storage,read_write> layerIndex:array<u32>;
@group(2) @binding(4) var<storage,read_write> particleIndex:array<u32>;
@group(2) @binding(5) var<storage,read_write> justOffset:atomic<u32>;
@group(2) @binding(6) var<storage,read_write> indirectBuffer:array<atomic<u32>,4>;


override blockSize: u32;

fn getSpeed(pos:vec2f,fkTex:texture_2d<f32>)
->f32{

    let textureSize = textureDimensions(fkTex,0);
    let coords = vec2u(pos * vec2f(textureSize));//未进行插值
    let color  = textureLoad(fkTex,coords,0).rgba;
    var f32value = f32((u32(color.x*255.0)<<24)+(u32(color.x*255.0)<<16)+(u32(color.x*255.0)<<8)+u32(color.x*255.0));
    f32value = f32value / f32(256*256*256*256-1);
    f32value = mix(ublock.speedBoundary.x , ublock.speedBoundary.y , f32value);//makesure between min,max
    
    return f32value;
}

fn getAttribute(speed:f32) 
->f32{
    //attribute是标准化的速度，用于后期着色
    return (speed - ublock.speedBoundary.x)/(ublock.speedBoundary.y - ublock.speedBoundary.x);
}


fn simulation(pIndex:u32)
->vec4f{

    let pos = vec3f(particlePosition[pIndex*3],particlePosition[pIndex*3+1],particlePosition[pIndex*3+2]);
    
    let moveUnit:f32 = ublock.deltaHeight/5.0;

    let speed:f32 = getSpeed(pos.xy,lowTex);

    let attrib:f32 = getAttribute(speed);

    let resultPos = vec4f(pos.xy , pos.z + speed * moveUnit , attrib);

    return resultPos;
}

fn getParticleIndex(invocationId:u32)
->u32{
    ///question
    return invocationId;
}



@compute @workgroup_size(blockSize,1,1)
fn cMain(@builtin(global_invocation_id) id:vec3u)
{
    let pIndex = getParticleIndex(id.x);

    let layerID = layerIndex[pIndex];

    if((id.x + base) < nextbase)
    {
        let particleIndex = id.x + base;
        let newPos = simulation(particleIndex);//vec4f (x,y,z,speedRate)

        particlePosition[particleIndex*3+0] = newPos.x;
        particlePosition[particleIndex*3+1] = newPos.y;
        particlePosition[particleIndex*3+2] = newPos.z;
        particleAttribute[particleIndex] = newPos.w;

        if((newPos.z < 1.0 * ublock.deltaHeight))
        {
            atomicAdd(&(layoutBaseArray[1]),1);
            atomicAdd(&(layoutBaseArray[2]),1);
            atomicAdd(&(layoutBaseArray[3]),1);
            atomicAdd(&(layoutBaseArray[4]),1);
            atomicAdd(&(layoutBaseArray[5]),1);
            atomicAdd(&(layoutBaseArray[6]),1);
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);

        }
        else if(newPos.z < 2.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[2]),1);
            atomicAdd(&(layoutBaseArray[3]),1);
            atomicAdd(&(layoutBaseArray[4]),1);
            atomicAdd(&(layoutBaseArray[5]),1);
            atomicAdd(&(layoutBaseArray[6]),1);
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(newPos.z < 3.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[3]),1);
            atomicAdd(&(layoutBaseArray[4]),1);
            atomicAdd(&(layoutBaseArray[5]),1);
            atomicAdd(&(layoutBaseArray[6]),1);
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(newPos.z < 4.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[4]),1);
            atomicAdd(&(layoutBaseArray[5]),1);
            atomicAdd(&(layoutBaseArray[6]),1);
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(newPos.z < 5.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[5]),1);
            atomicAdd(&(layoutBaseArray[6]),1);
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(newPos.z < 6.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[6]),1);
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(newPos.z < 7.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(newPos.z < 8.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(newPos.z < 9.0 * ublock.deltaHeight)
        {//不需要统计了。因为没有第9层了，不需要第9层的base
            //最终layoutBaseArray[9]应该等于pariticlenum
        }
    }

    if(id.x === 199)
    {
        
    }
}