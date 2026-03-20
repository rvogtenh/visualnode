// SINE TANGLE
// Multiple overlapping sine waves at audio-reactive frequencies/phases.
// Interference between layers creates moire and standing-wave patterns.
// Bass drives large slow waves; highs drive dense fast diagonal webs.

registerScene({
  id: 'sine-tangle',
  name: 'Sine Tangle',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  float sub  = bands.x * 3.5;
  float low  = bands.y * 3.0;
  float mid  = bands.z * 2.5;
  float high = bands.w * 3.5;

  // onset.x: sudden wave compression / expansion
  float squeeze = 1.0 + onset.x * 1.8;
  vec2 ps = p * squeeze;

  // Wave 1 — horizontal, bass drives speed and scale
  float w1 = sin(ps.x * (3.0 + low  * 8.0) + time * (0.8 + sub  * 2.0));

  // Wave 2 — vertical, mid drives density
  float w2 = sin(ps.y * (4.0 + mid  * 10.0) + time * (1.2 + mid  * 3.0));

  // Wave 3 — diagonal (x+y), highs push density and speed hard
  float w3 = sin((ps.x + ps.y) * (5.0 + high * 12.0) + time * (1.5 + high * 4.0));

  // Wave 4 — radial from centre, bass drives outward pulse
  float w4 = sin(length(ps) * (4.0 + mid * 6.0) - time * (1.0 + sub));

  // Wave 5 — counter-diagonal, low-mid cross-modulates
  float w5 = sin((ps.x - ps.y) * (4.5 + low * 7.0) + time * (0.9 + mid * 2.5));

  // Combine: sum and normalise to 0..1
  float sum = (w1 + w2 + w3 + w4 + w5) / 5.0;  // -1..1
  float surface = sum * 0.5 + 0.5;

  // Interference threshold — sharp zero-crossings glow
  float edge = 1.0 - smoothstep(0.0, 0.04 + high * 0.03, abs(sum));

  surface = mix(surface, 1.0, edge * (0.5 + high * 0.6));

  // Feedback — drift along the local wave-gradient direction
  float gx = sin(ps.x * (3.0 + low * 8.0) + time * 0.8 + 1.5707);
  float gy = sin(ps.y * (4.0 + mid * 10.0) + time * 1.2 + 1.5707);
  vec2 drift = normalize(vec2(gx, gy) + 0.001) * (0.005 + sub * 0.012);
  vec4 prev = texture2D(backbuffer, pn + drift);
  float fbk = 0.60 - (mid + high) * 0.05;
  surface = mix(prev.r * fbk, surface, 0.45 + mid * 0.25);

  // Color — hue from time + bass, saturation from mid
  float hue = fract(time * 0.022 + sub * 0.13 + edge * 0.25);
  float sat = 0.65 + mid * 0.35;
  vec3 col = hsv2rgb(vec3(hue, sat, surface));

  // Edge highlight: cyan on zero-crossings
  col = mix(col, cyan, edge * (0.4 + high * 0.5));
  // Bass warmth
  col = mix(col, orange, sub * sub * 0.45);

  // Vignette
  vec2 vc = pn - 0.5;
  col *= 1.0 - dot(vc, vc) * 1.3;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
});
