// struct UniformBlock{
//     arrLength: u32,
//     cmpOffset: u32,
//     subSize: u32,
// }


@group(0) @binding(0)  var<storage,read_write> input : array<f32>;
@group(0) @binding(1)  var<storage,read_write> output: array<f32>;
// @group(0) @binding(2)  var<uniform> ubo: UniformBlock;

override blockSize: u32;
override groupNum: u32;
override _arrLength: u32;
override _cmpOffset: u32;
override _subSize: u32;

fn getCompareInfo(id: u32) -> vec3u{
    //(shouldCmp, cmpID, flag)
    // let cmpId = id + ubo.cmpOffset;
    let cmpId = id + _cmpOffset;

    // let shouldCmp = u32(select(0, 1, (cmpId%ubo.subSize)>(id%ubo.subSize) && (cmpId < ubo.arrLength) && ((id/ubo.cmpOffset)%2==0)));
    let shouldCmp = u32(select(0, 1, (cmpId%_subSize)>(id%_subSize) && (cmpId < _arrLength) && ((id/_cmpOffset)%2==0)));

    // let flag = (id / ubo.subSize) % 2;//0 rise, 1 down
    let flag = (id / _subSize) % 2;

    return vec3u(shouldCmp, cmpId, flag);
}

fn compare(id: u32,cmpid: u32,flag: u32){
    let now_value = input[id];
    let cmp_value = input[cmpid];
    let shouldSwap = select(1, 0, ((flag == 0 && now_value < cmp_value) || (flag == 1 && now_value > cmp_value)));

    // output[id] = select(cmp_value, now_value, shouldSwap == 0);
    // output[cmpid] = select(now_value, cmp_value, shouldSwap == 0);
    input[id] = select(cmp_value, now_value, shouldSwap == 0);
    input[cmpid] = select(now_value, cmp_value, shouldSwap == 0);
}

@compute @workgroup_size(blockSize,blockSize,1) fn cMain(
    @builtin(global_invocation_id) id:vec3<u32>
){
    let ID = id.x + id.y * groupNum * blockSize;
    let cmpINFO = getCompareInfo(ID);

    if(cmpINFO.x != 0){
        compare(ID,cmpINFO.y,cmpINFO.z);//compare(id,cmpid,flag)
    }

    // input[ID] = f32(ID);

}