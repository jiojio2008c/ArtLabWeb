export const portalVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const portalFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uOpacity;
  varying vec2 vUv;

  float lineMask(float value, float width) {
    return 1.0 - smoothstep(width, width + 0.008, abs(value));
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float edgeDistance = max(abs(centered.x), abs(centered.y));
    float outerFrame = lineMask(edgeDistance - 0.485, 0.008);
    float innerFrame = lineMask(edgeDistance - 0.425, 0.004);

    vec2 gridUv = fract(vUv * vec2(15.0, 18.0) + vec2(uTime * 0.09, -uTime * 0.16));
    float grid = max(
      1.0 - smoothstep(0.018, 0.045, abs(gridUv.x - 0.5)),
      1.0 - smoothstep(0.018, 0.045, abs(gridUv.y - 0.5))
    );
    grid *= 1.0 - smoothstep(0.16, 0.48, length(centered));

    float scan = 1.0 - smoothstep(0.0, 0.035, abs(vUv.y - fract(uTime * 0.31)));
    float pulse = 0.72 + 0.28 * sin(uTime * 4.8 + uProgress * 8.0);
    float centerGlow = exp(-7.5 * dot(centered, centered));

    vec3 cyan = vec3(0.08, 0.87, 1.0);
    vec3 violet = vec3(0.58, 0.17, 1.0);
    vec3 color = mix(cyan, violet, smoothstep(-0.5, 0.5, centered.x + sin(uTime) * 0.08));
    float alpha = outerFrame * 0.95 + innerFrame * 0.62 + grid * 0.19 + scan * centerGlow * 0.38;
    alpha += centerGlow * (0.08 + uProgress * 0.18);
    alpha *= pulse * uOpacity;

    gl_FragColor = vec4(color * (1.1 + centerGlow * 1.8), alpha);
  }
`
