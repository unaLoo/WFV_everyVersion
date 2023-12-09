
@group(0) @binding(0) var<storage,read_write> input : array<f32>;
@group(0) @binding(1) var<storage,read_write> renderIndexArray: array<u32>;

override blockSize: u32;
override groupNum: u32;
override _arrLength: u32;
override _cmpOffset: u32;
override _subSize: u32;

fn getCompareInfo(id: u32) -> vec3u{
    //(shouldCmp, cmpid, flag)
    let cmpid = id + _cmpOffset;

    let shouldCmp = u32(select(0, 1, (cmpid%_subSize)>(id%_subSize) && (cmpid < _arrLength) && ((id/_cmpOffset)%2==0)));

    let flag = (id / _subSize) % 2;

    return vec3u(shouldCmp, cmpid, flag);
}

fn compare(id: u32,cmpid: u32,flag: u32){
    let now_value = input[id];
    let cmp_value = input[cmpid];
    let shouldSwap = select(1, 0, ((flag == 0 && now_value < cmp_value) || (flag == 1 && now_value > cmp_value)));

    input[id] = select(cmp_value, now_value, shouldSwap == 0);
    input[cmpid] = select(now_value, cmp_value, shouldSwap == 0);

    let now_index = id;
    let cmp_index = cmpid;
    if( now_value>0 && cmp_value>0){
        renderIndexArray[id] = select(cmp_index, now_index, shouldSwap == 0);
        renderIndexArray[cmpid] = select(now_index, cmp_index, shouldSwap == 0);
    }else{
        renderIndexArray[id] = 0;
        renderIndexArray[cmpid] = 0;
    }
}

@compute @workgroup_size(blockSize,blockSize,1) fn cMain(
    @builtin(global_invocation_id) id:vec3<u32>
){
    let ID = id.x + id.y * groupNum * blockSize;
    let cmpINFO = getCompareInfo(ID);

    if(cmpINFO.x != 0){
        compare(ID,cmpINFO.y,cmpINFO.z);//compare(id,cmpid,flag)
    }

    // renderIndexArray[ID] = ID;
    // input[ID] = f32(ID);
}