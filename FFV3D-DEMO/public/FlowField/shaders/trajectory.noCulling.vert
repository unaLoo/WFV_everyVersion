#version 300 es
precision highp float;

layout (location = 0) in float isAlive;//age

layout (std140) uniform FlowFieldUniforms
{
    float progress;
    float segmentNum;
    float fullLife;
    float dropRate;
    float dropRateBump;
    float speedFactor;
    float colorScheme;
    vec4 flowBoundary;
};

uniform sampler2D particlePool;
uniform sampler2D projectionTexture;
uniform int blockNum;
uniform int beginBlock;
uniform int blockSize;
uniform float fillWidth;
uniform float aaWidth;
uniform vec2 viewport;
uniform mat4 u_matrix;

out struct Stream_line_setting 
{
    float edgeParam;
    float alphaDegree;
    float velocity; // a percentage
    float isDiscarded;
} sls;


vec4 ReCoordinate(vec2 pos) {
    //projectionTexture中存的是归一化了的mercator , -1,1
    vec3 geoPos;
    geoPos = texture(projectionTexture, pos).xyz;// rgba8.xyz？  (0,1)
    vec4 res = u_matrix * vec4(geoPos, 1.0);
    return res;
}

ivec2 get_uv(int vertexIndex)
{
    //vertexIndex 是 原顶点
    // calculate the blockIndex of the current vertx
    int blockIndex = (beginBlock - vertexIndex + blockNum) % blockNum;

    // calculate original uv of the block
    int textureWidth = textureSize(particlePool, 0).x;
    int columnNum = textureWidth / blockSize;
    //blockUV是对应的block的(0,0)位置
    ivec2 blockUV = ivec2(blockIndex % columnNum, blockIndex / columnNum) * blockSize;
    

    // calculate uv of the current vertex
    //基于实例id偏移到该实例所在texel
    ivec2 vertexUV = blockUV + ivec2(gl_InstanceID % blockSize, gl_InstanceID / blockSize);
    //返回纹理坐标，texel的行列号
    return vertexUV;
}

vec4 transfer_to_clip_space(vec2 pos)
{
    return ReCoordinate(pos);
}

vec4 get_clip_position(ivec2 uv)
{
    return transfer_to_clip_space(texelFetch(particlePool, uv, 0).rg);
}

vec2 get_vector(vec2 beginVertex, vec2 endVertex)
{
    return normalize(endVertex - beginVertex);
}

void main()
{
    // get screen positions from particle pool
    float parity = float(gl_VertexID % 2);
    int currentVertex = gl_VertexID / 2;
    int nextVertex = currentVertex + 1;
    ivec2 c_uv = get_uv(currentVertex);
    ivec2 n_uv = get_uv(nextVertex);//texel在poolTex上的行列号
    vec4 cv_pos_CS = get_clip_position(c_uv);//从poolTex的Texel获取xy，然后从ProjTex的texel获取插值经纬度，后用Matrix变换，最终w！=1
    vec4 nv_pos_CS = get_clip_position(n_uv);// w!=1
    vec2 cv_pos_SS = cv_pos_CS.xy / cv_pos_CS.w;//clip to space
    vec2 nv_pos_SS = nv_pos_CS.xy / nv_pos_CS.w;//clip to space

    // calculate the screen offset
    float speedRate = texelFetch(particlePool, c_uv, 0).b;
    float lineWidth = (fillWidth + aaWidth * 2.0);// * mix(2.0, 1.0, clamp(pow(speedRate * 10.0, 3.0), 0.0, 1.0));
    vec2 cn_vector = get_vector(cv_pos_SS, nv_pos_SS);//当前位置到下一位置的单位方向向量
    float screenOffset = lineWidth / 2.0;

    // translate current vertex position
    vec3 view = vec3(0.0, 0.0, 1.0);
    vec2 v_offset = normalize(cross(view, vec3(cn_vector, 0.0))).xy * mix(1.0, -1.0, parity);
    vec2 vertexPos_SS = cv_pos_SS + v_offset * screenOffset / viewport;

    //////////////
    // calculate vertex position in screen coordinates
    vec2 vertexPos_CS = vertexPos_SS * cv_pos_CS.w;
    gl_Position = vec4(vertexPos_CS, 0.0, cv_pos_CS.w);

    // prepare for anti-aliasing
    sls.edgeParam = 2.0 * parity - 1.0;

    float segmentRate = float(currentVertex) / segmentNum;
    sls.alphaDegree = 1.0 - segmentRate;//segment越到后期，越透明

    sls.velocity = speedRate;
    sls.isDiscarded = isAlive;
}