// CHROMATIC STORM — v2
// Intensivere Reaktionen, grössere Gesten:
// - Bass-Warp verdoppelt, zweiter Warp-Pass mit eigenem Timing
// - Drei unabhängige Rotationsebenen
// - RMF-Blitz-Layer auf Bass-Transienten
// - Hue springt auf starke Energie (Komplementärfarbe)
// - Feedback-Drift deutlich stärker

registerScene({
  id: 'chromatic-storm',
  name: 'Chromatic Storm',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  float sub  = bands.x * 3.5;
  float low  = bands.y * 3.0;
  float mid  = bands.z * 2.5;
  float high = bands.w * 3.5;
  float energy = (sub + low + mid + high) * 0.25;

  // ---- Warp pass 1: bass deforms space aggressively ----
  float wx1 = snoise(vec3(p * 1.5,       time * 0.10));
  float wy1 = snoise(vec3(p * 1.5 + 5.3, time * 0.10));
  vec2 wp = p + vec2(wx1, wy1) * (0.35 + sub * 1.0);

  // ---- Warp pass 2: mid/high add fine turbulence ----
  float wx2 = snoise(vec3(wp * 2.8 + 1.7, time * 0.16 + mid));
  float wy2 = snoise(vec3(wp * 2.8 + 8.2, time * 0.16 + high));
  wp += vec2(wx2, wy2) * (0.12 + mid * 0.50);

  // ---- Three noise layers at different scales/speeds ----
  float a1 = time * 0.10 + sub  * 1.2;
  float a2 = time * 0.13 + low  * 1.0;
  float a3 = time * 0.08 + high * 1.5;

  float n1 = fbm(vec3(rotate(wp, vec2(0.0),  a1) * (1.6 + mid  * 2.0), time * 0.08), 5);
  float n2 = fbm(vec3(rotate(wp, vec2(0.0), -a2) * (2.8 + high * 2.5), time * 0.12), 4);
  float n3 = rmf(   rotate(wp, vec2(0.0),   a3) * (2.0 + sub  * 1.8), 4);

  float surface = n1 * 0.45 + n2 * 0.35 + n3 * 0.20;

  // RMF flash layer — only appears on strong bass transients
  float flash3 = rmf(wp * (4.0 + sub * 3.0), 3) * max(0.0, sub - 0.8);
  surface = mix(surface, flash3, max(0.0, sub - 1.0) * 0.4);

  // ---- Feedback — drift scales with bass/high ----
  vec2 drift = vec2(
    cos(time * 0.13) * (sub  * 0.018 + 0.003),
    sin(time * 0.11) * (high * 0.015 + 0.003)
  );
  vec4 prev = texture2D(backbuffer, pn + drift);
  // Moderate feedback, clears faster on high energy
  float fbk = 0.68 - energy * 0.20;
  surface = mix(prev.r * fbk, surface, 0.40 + energy * 0.40);

  // ---- Color — hue rotates, jumps on energy spike ----
  float baseHue   = fract(time * 0.03  + sub * 0.10);
  // Energy spike flips to complement (+0.5) — creates dramatic shift
  float hueDelta  = smoothstep(0.55, 0.90, energy) * 0.50;
  float hue1 = fract(baseHue + hueDelta);
  float hue2 = fract(hue1 + 0.30 + mid  * 0.08);
  float hue3 = fract(hue1 + 0.62 + high * 0.06);

  vec3 c1 = hsv2rgb(vec3(hue1, 0.95, 1.00));
  vec3 c2 = hsv2rgb(vec3(hue2, 0.85, 0.95));
  vec3 c3 = hsv2rgb(vec3(hue3, 0.80, 1.00));

  // Lower floor thresholds → color appears early
  vec3 col = mix(black, c1, smoothstep(0.04, 0.42, surface));
  col      = mix(col,   c2, smoothstep(0.36, 0.68, surface));
  col      = mix(col,   c3, smoothstep(0.62, 0.94, surface));

  // Broad energy flash — whole frame bleaches on peaks
  col = mix(col, white, smoothstep(0.70, 1.00, energy) * 0.45);

  // Bass transient warms the image
  col = mix(col, orange, max(0.0, sub - 1.5) * 0.55);

  // Vignette
  vec2 vc = pn - 0.5;
  col *= 1.0 - dot(vc, vc) * 1.2;

  col = max(col, vec3(0.02, 0.01, 0.03)); // minimum glow

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
});
