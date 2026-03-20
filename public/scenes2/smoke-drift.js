registerScene2({
  id: 'smoke-drift',
  name: 'Smoke Drift',
  glsl: `
    void main() {
      vec2 p = uv();

      float sub    = bands.x * 3.5;
      float mid    = bands.z * 2.5;
      float high   = bands.w * 3.0;
      float energy = (sub + mid + high) * 0.33;

      // Domain warp: push sample coords with noise-driven flow
      float wx = snoise(vec3(p * 1.5,       time * 0.06 + sub * 0.2));
      float wy = snoise(vec3(p * 1.5 + 4.1, time * 0.06));
      vec2 wp = p + vec2(wx, wy) * (0.25 + energy * 0.4);

      // Two smoke field layers
      float smoke  = fbm(vec3(wp * 2.0, time * 0.08 + mid * 0.3), 3);
      float smoke2 = rmf(wp * 1.5 + snoise(vec3(wp, time * 0.04)) * 0.3, 3);
      float surface = smoke * 0.6 + smoke2 * 0.4;

      // Near-monochrome with slight warm/purple tint
      vec3 col = mix(black, vec3(0.35, 0.28, 0.42), smoothstep(0.2, 0.7, surface));
      col = mix(col, vec3(0.6, 0.55, 0.7), smoothstep(0.6, 0.9, surface));

      // Bass adds purple tint
      col += purple * sub * sub * 0.4;

      // onset.w: brief bright wisp flash
      col = mix(col, white, onset.w * onset.w * 0.5);

      // Heavy feedback for smoke persistence
      vec3 prev = texture2D(backbuffer, uvN()).rgb;
      col = mix(col, prev, 0.75);

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
