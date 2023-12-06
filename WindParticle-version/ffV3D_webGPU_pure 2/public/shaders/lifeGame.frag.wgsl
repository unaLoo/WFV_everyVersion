struct FragmentInput {
    @location(0) cell: vec2f,
};

@group(0) @binding(0) var<uniform> grid: vec2f;

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {

    let c = input.cell / grid;
    return vec4f(c, 1.0 - c.x, 1.0);
}