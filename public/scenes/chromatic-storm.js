// CHROMATIC STORM
// Domain-warped turbulenz mit starker Farbreaktion auf alle Frequenzbänder.
// Bass verzerrt die Koordinaten. Mitten treiben die Farbe. Höhen erzeugen Blitze.
// Hue rotiert langsam — selbst ohne Signal bleibt ein lebendiges Bild.

registerScene({
  id: 'chromatic-storm',
  name: 'Chromatic Storm',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  float sub  = bands.x * 3.0;
  float low  = bands.y * 2.5;
  float mid  = bands.z * 2.0;
  float high = bands.w * 3.0;
  float energy = (sub + low + mid + high) * 0.25;

  // Domain warping: bass deforms space, creates turbulent structure
  float wx = snoise(vec3(p * 1.8,        time * 0.09));
  float wy = snoise(vec3(p * 1.8 + 4.7,  time * 0.09));
  vec2 warp = vec2(wx, wy) * (0.25 + sub * 0.7);
  vec2 wp = p + warp;

  // Second warp pass — adds complexity on mid/high
  float wx2 = snoise(vec3(wp * 2.5 + 2.3, time * 0.13 + mid * 0.5));
  float wy2 = snoise(vec3(wp * 2.5 + 7.1, time * 0.13 + high * 0.5));
  wp += vec2(wx2, wy2) * (0.1 + mid * 0.35);

  // Two noise layers with rotation driven by bands
  float angle1 = time * 0.06 + sub * 0.8;
  float angle2 = time * 0.08 + low * 0.6;
  float n1 = fbm(vec3(rotate(wp, vec2(0.0), angle1) * (1.8 + mid * 1.5), time * 0.07), 5);
  float n2 = fbm(vec3(rotate(wp, vec2(0.0), angle2) * (2.5 + high * 2.0), time * 0.10), 4);

  float surface = n1 * 0.55 + n2 * 0.45;

  // Feedback with drift proportional to audio movement
  vec2 drift = vec2(
    cos(time * 0.11) * sub  * 0.009,
    sin(time * 0.13) * high * 0.007
  );
  vec4 prev = texture2D(backbuffer, pn + drift);
  // Moderate feedback — image stays alive but reacts fast
  surface = mix(prev.r * 0.70, surface, 0.42 + energy * 0.35);

  // Hue shifts slowly with time and audio — always colorful
  float baseHue = fract(time * 0.035 + sub * 0.15);
  float hue1 = baseHue;
  float hue2 = fract(baseHue + 0.33 + mid * 0.12);
  float hue3 = fract(baseHue + 0.66 + high * 0.10);

  vec3 c1 = hsv2rgb(vec3(hue1, 0.9, 1.0));
  vec3 c2 = hsv2rgb(vec3(hue2, 0.85, 0.95));
  vec3 c3 = hsv2rgb(vec3(hue3, 0.75, 1.0));

  vec3 col = mix(black, c1, smoothstep(0.05, 0.45, surface));
  col      = mix(col,   c2, smoothstep(0.38, 0.70, surface));
  col      = mix(col,   c3, smoothstep(0.62, 0.92, surface));

  // High energy: white flash bleaches the whole frame
  float flash = smoothstep(0.6, 1.0, energy);
  col = mix(col, white, flash * 0.35);

  // Bass transient: brief bloom on the warmest colour
  col = mix(col, orange, max(0.0, sub - 1.8) * 0.5);

  // Vignette
  vec2  vc  = pn - 0.5;
  float vig = 1.0 - dot(vc, vc) * 1.3;
  col *= clamp(vig, 0.0, 1.0);

  // Minimum glow so there's always something to see
  col = max(col, vec3(0.02, 0.01, 0.03));

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
});
