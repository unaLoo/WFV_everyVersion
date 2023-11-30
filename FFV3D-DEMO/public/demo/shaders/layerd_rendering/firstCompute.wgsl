////////////////first compute
//
struct uniformBlock{
    ///static for all particles
    canvasSize:vec2u,
    particleNum:f32,
    deltaHeight:f32,
    totalLayers:u32,//10张纹理,中间9层，totallayers = 9
    speedBoundary:vec2f,//speed_min , speed_max
    matrix:mat4x4f,//7+16 = 23
}

@group(0) @binding(0) var<uniform> ublock:uniformBlock;

@group(1) @binding(0) var nSampler: sampler;
@group(1) @binding(1) var highTex: texture_2d<f32>;
@group(1) @binding(2) var lowTex: texture_2d<f32>;

@group(2) @binding(0) var<storage,read_write> particlePosition:array<f32>;
@group(2) @binding(1) var<storage,read_write> particleAttribute:array<f32>;
@group(2) @binding(2) var<storage,read_write> indirect_aliveNum:array<atomic<u32>,4>; //note!
@group(2) @binding(3) var<storage,read_write> layoutBaseArray:array<atomic<u32>,9>; //note!
@group(2) @binding(4) var<storage,read_write> indexArray:array<u32>;
@group(2) @binding(5) var<storage,read_write> justIndexing:atomic<u32>;
@group(2) @binding(6) var<storage,read_write> old_layoutBaseArray:array<atomic<u32>,9>;
@group(2) @binding(7) var<storage,read> nowLayer:array<u32>;

override blockSize: u32;


fn getSpeed(pos:vec2f,fkTex:texture_2d<f32>)
->f32{
    // input is (0,1) vec2
    // f32Value是实际的速度，between min & max

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
{

    //基于nowpos 速度信息 来计算nextpos，nextAttrib
    let pos = vec3f(particlePosition[pIndex*3],particlePosition[pIndex*3+1],particlePosition[pIndex*3+2]);
    
    // let zvalue_unit = ublock.deltaHeight/50; // 每次最大行动单元
    let zvalue_unit = ublock.deltaHeight/50; // 每次最大行动单元
    // let progress    = mod(pos.z,ublock.deltaHeight)/ublock.deltaHeight;
    let progress = pos.z - ublock.deltaHeight * floor(pos.z/ublock.deltaHeight);
    let speed  = mix(getSpeed(pos.xy,lowTex),getSpeed(pos.xy,highTex),progress);
    var delta_zvalue= speed*zvalue_unit;
    // delta_zvalue = mix(0.00000,zvalue_unit,delta_zvalue);

    let attrib = getAttribute(speed);
    
    particlePosition[pIndex*3]  = pos.x;
    particlePosition[pIndex*3+1]= pos.y;
    particlePosition[pIndex*3+2]= pos.z + delta_zvalue;
    particleAttribute[pIndex]   = attrib;
    
}

@compute @workgroup_size(blockSize,1,1)
fn cMain()
{
    //注意这里的索引方式，暴力往后加，不行就下次override，只要index小于particleNum即可。省去了很多disgusting things。
    let particleIndex = atomicAdd(&(justIndexing),1);
    let base:u32 = atomicAdd(&(old_layoutBaseArray[nowLayer[0]]),0);

    var pIndex = base + particleIndex;///?

    if(pIndex<u32(ublock.particleNum))
    {
        simulation(pIndex);
        let nowPos = vec3f(particlePosition[pIndex*3],particlePosition[pIndex*3+1],particlePosition[pIndex*3+2]);

        //////layer judge
        if((nowPos.z < 1.0 * ublock.deltaHeight))
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
        else if(nowPos.z < 2.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[2]),1);
            atomicAdd(&(layoutBaseArray[3]),1);
            atomicAdd(&(layoutBaseArray[4]),1);
            atomicAdd(&(layoutBaseArray[5]),1);
            atomicAdd(&(layoutBaseArray[6]),1);
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(nowPos.z < 3.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[3]),1);
            atomicAdd(&(layoutBaseArray[4]),1);
            atomicAdd(&(layoutBaseArray[5]),1);
            atomicAdd(&(layoutBaseArray[6]),1);
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(nowPos.z < 4.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[4]),1);
            atomicAdd(&(layoutBaseArray[5]),1);
            atomicAdd(&(layoutBaseArray[6]),1);
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(nowPos.z < 5.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[5]),1);
            atomicAdd(&(layoutBaseArray[6]),1);
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(nowPos.z < 6.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[6]),1);
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(nowPos.z < 7.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[7]),1);
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(nowPos.z < 8.0 * ublock.deltaHeight)
        {
            atomicAdd(&(layoutBaseArray[8]),1);
        }
        else if(nowPos.z < 9.0 * ublock.deltaHeight)
        {
            // atomicAdd(&(layoutBaseArray[8]),1);//不需要统计了。因为没有第9层了，不需要第9层的base
        }
    }


}
