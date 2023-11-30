
struct uniformBlock{
    ///static for all particles
    canvasSize:vec2u,
    particleNum:u32,
    deltaHeight:f32,
    totalLayers:u32,//10张纹理,中间9层，totallayers = 9
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,
}

@group(0) @binding(0) var<uniform> ublock:uniformBlock;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;

@group(2) @binding(0) var<storage,read_write> particlePosition:array<f32>;
@group(2) @binding(1) var<storage,read_write> particleAttribute:array<f32>;
@group(2) @binding(2) var<storage,read_write> indirect_aliveNum:array<atomic<u32>,4>;
@group(2) @binding(3) var<storage,read_write> layoutBaseArray:array<atomic<u32>,9>;
@group(2) @binding(4) var<storage,read_write> indexArray:array<u32>;
@group(2) @binding(5) var<storage,read_write> justIndexing:atomic<u32>;///可删
@group(2) @binding(6) var<storage,read_write> old_layoutBaseArray:array<u32>;

@group(3) @binding(0) var<storage,read> nnnowLayer:array<u32>;

override blockSize: u32;

fn getSpeed(pos:vec2f,fkTex:texture_2d<f32>)
->f32{

    let textureSize = textureDimensions(fkTex,0);
    let coords = vec2u(pos * vec2f(textureSize));//未进行插值
    let color  = textureLoad(fkTex,coords,0).rgba;
    
    return getf32fromrgba(color);
}

fn getf32fromrgba(color:vec4f)
->f32{
    var f32value = f32((u32(color.x*255.0)<<24)+(u32(color.x*255.0)<<16)+(u32(color.x*255.0)<<8)+u32(color.x*255.0));
    f32value = f32value / f32(256*256*256*256-1);
    f32value = mix(ublock.speedBoundary.x , ublock.speedBoundary.y , f32value);//makesure between min,max
    
    return f32value;
}

fn get_speed(uv: vec2f, fTexture: texture_2d<f32>) -> f32 {

    var f = fract(uv);
    var parity = vec2i(select(-1, 1, f.x >= 0.5), select(-1, 1, f.y >= 0.5));
    let uv0 = vec2i(uv);
    let uv1 = uv0 + vec2i(parity.x, 0);
    let uv2 = uv0 + vec2i(0, parity.y);
    let uv3 = uv0 + vec2i(parity.x, parity.y);

    let speed0 = getf32fromrgba(textureLoad(fTexture, uv0, 0).rgba);
    let speed1 = getf32fromrgba(textureLoad(fTexture, uv1, 0).rgba) ;
    let speed2 = getf32fromrgba(textureLoad(fTexture, uv2, 0).rgba) ;
    let speed3 = getf32fromrgba(textureLoad(fTexture, uv3, 0).rgba) ;

    let lerp = abs(f - vec2f(0.5));
    let speed =  mix(mix(speed0, speed1, lerp.x), mix(speed2, speed3, lerp.x), lerp.y);
    return speed;
}

fn getAttribute(speed:f32) 
->f32{
    //attribute是标准化的速度，用于后期着色
    return (speed - ublock.speedBoundary.x)/(ublock.speedBoundary.y - ublock.speedBoundary.x);
}


fn simulation(pIndex:u32)
->vec4f{

    let pos = vec3f(particlePosition[pIndex*3],particlePosition[pIndex*3+1],particlePosition[pIndex*3+2]);
    
    let moveUnit:f32 = ublock.deltaHeight/0.5;

    let speed:f32 = getSpeed(pos.xy,lowTex);

    let attrib:f32 = getAttribute(speed);

    let resultPos = vec4f(pos.xy , pos.z + speed * moveUnit , attrib);

    return resultPos;
}




@compute @workgroup_size(blockSize,1,1)
fn cMain(@builtin(global_invocation_id) id:vec3u)
{
    let layerIndex = nnnowLayer[0];//注意测试
    let base =old_layoutBaseArray[layerIndex];
    let nextbase = old_layoutBaseArray[layerIndex+1];
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
    // if(id.x == blockSize - 1)
    // {
    //     atomicAdd(&(layoutBaseArray[layerIndex]),1);
    // }
    
    
    
    // old_layoutBaseArray[nnnowLayer[0]] = nnnowLayer[0];//layerIndex成功传入
}