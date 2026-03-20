// PLASMA BLOOM
// Classic plasma effect — smooth organic color fields driven by overlapping
// sine/cosine oscillators. Audio accelerates and warps the plasma flow.
// Complementary hue pairing, light feedback glow.

registerScene({
  id: 'plasma-bloom',
  name: 'Plasma Bloom',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  float sub  = bands.x * 3.5;
  float low  = bands.y * 3.0;
  float mid  = bands.z * 2.5;
  float high = bands.w * 3.5;

  // Audio-driven oscillator frequencies
  float f1 = 1.8 + low  * 3.5;
  float f2 = 2.2 + mid  * 4.0;
  float f3 = 1.5 + sub  * 2.5 + high * 1.5;
  float f4 = 2.8 + high * 5.0;

  // Phase times — each band pushes its oscillator faster
  float t1 = time * 0.50 + sub  * 1.8;
  float t2 = time * 0.65 + low  * 1.5;
  float t3 = time * 0.40 + mid  * 2.0;
  float t4 = time * 0.80 + high * 2.5;

  // Classic 4-term plasma
  float v  = sin(p.x * f1 + t1);
        v += sin(p.y * f2 + t2);
        v += sin((p.x + p.y) * f3 + t3);
        v += sin(length(p)   * f4 - t4);
  // v in ~-4..4, map to 0..1
  float plasma = (v + 4.0) / 8.0;

  // Subtle high-freq wrinkle on top (driven by mids)
  float ripple = sin(p.x * (6.0 + mid * 8.0) + time * 1.1)
               * sin(p.y * (5.0 + high * 7.0) + time * 0.9)
               * 0.06;
  plasma = clamp(plasma + ripple, 0.0, 1.0);

  // onset.w: high attack flips hue to complement briefly
  float hueJump = onset.w * 0.5;
  float hue1 = fract(time * 0.040 + sub * 0.15 + hueJump);
  float hue2 = fract(hue1 + 0.50 + mid * 0.10);

  vec3 colA = hsv2rgb(vec3(hue1, 0.90, 0.95));
  vec3 colB = hsv2rgb(vec3(hue2, 0.85, 1.00));
  vec3 col  = mix(colA, colB, plasma);

  // Bass onset: brightness burst
  float burst = onset.x * onset.x;
  col = mix(col, white, burst * 0.55);

  // Light feedback — just enough for soft glow trails
  vec2 drift = vec2(
    sin(time * 0.07 + sub)  * 0.004,
    cos(time * 0.05 + high) * 0.004
  );
  vec4 prev = texture2D(backbuffer, pn + drift);
  col = mix(prev.rgb * 0.18, col, 0.82);

  // Soft vignette
  vec2 vc = pn - 0.5;
  col *= 1.0 - dot(vc, vc) * 0.9;

  col = max(col, vec3(0.01, 0.01, 0.02));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
});
