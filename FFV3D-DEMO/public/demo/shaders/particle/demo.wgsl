struct VertInput{
    @location(0) position:vec2f,//vertexbuffer location0
    @location(1) color:vec4f,  //vertexbuffer location1
}

struct FragInput{
    @builtin(position) position:vec4f,//builtin position
    @location(0) color:vec4f,
}

struct MyUniform{
    matrix:mat4x4f,
    zValue:f32,
}

@group(0) @binding(0) var<uniform> myUniform:MyUniform;

@group(1) @binding(0) var mySampler:sampler;
@group(1) @binding(1) var transformTex:texture_2d<f32>;
@group(1) @binding(2) var seedingTex:texture_2d<f32>;



fn getPos(uv:vec2f)
->vec2f{
    //input::uv::(rowf,colf);    rowcol_float

    //demo:直接取整
    let iuv = vec2u(uv);
    return textureLoad(transformTex,iuv,0).xy;

    //best:取小数位，找最近四个点，双线性插值    
    //pass;
}


@vertex fn vMain(vInput:VertInput)
->FragInput{
    let resolution = textureDimensions(transformTex,0);
    let rowcol_float = vInput.position * vec2f(resolution) ;
    let pos = getPos(rowcol_float);//取整格子，基于seedingTex找inflow的点

    var info:FragInput;
    info.position = myUniform.matrix * vec4f(pos,myUniform.zValue,1.0);
    info.color = vInput.color;
    return info;
}


@fragment fn fMain(fInput:FragInput)
->@location(0) vec4f{
    return fInput.color;
}