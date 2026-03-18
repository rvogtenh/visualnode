// CHROMATIC STORM — v3
// onset / delta machen Amplitudensprünge direkt sichtbar:
// - onset.x (Bass-Attack): Warp-Spitze, Rotationsbeschleunigung, Orange-Bloom
// - onset.w (High-Attack): Weissblitz + Hue-Sprung zur Komplementärfarbe
// - delta.z  (Mid-Änderung): Feinstruktur-Shift (fbm-Achse)
// - Negativer delta (Abfall): Feedback stärker → Bild "gefriert" kurz

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

  float atkBass = onset.x;   // bass attack, 0..1
  float atkHigh = onset.w;   // high attack, 0..1
  float dMid    = delta.z;   // mid change (signed, amplified)
  float dBass   = delta.x;   // bass change (signed)

  // ---- Warp pass 1: bass drives space — attack spikes it ----
  float wx1 = snoise(vec3(p * 1.5,       time * 0.10));
  float wy1 = snoise(vec3(p * 1.5 + 5.3, time * 0.10));
  // Attack adds a sudden warp surge, then decays with onset
  float warpStr = 0.35 + sub * 1.0 + atkBass * 1.6;
  vec2 wp = p + vec2(wx1, wy1) * warpStr;

  // ---- Warp pass 2: mid/high turbulence + delta jitter ----
  float wx2 = snoise(vec3(wp * 2.8 + 1.7, time * 0.16 + mid));
  float wy2 = snoise(vec3(wp * 2.8 + 8.2, time * 0.16 + high));
  // Signed delta.z shifts the noise axis — positive = push, negative = pull
  wp += vec2(wx2, wy2) * (0.12 + mid * 0.50);
  wp += vec2(dMid * 0.08, -dMid * 0.06); // mid transient deforms independently

  // ---- Three noise layers ----
  // Attack accelerates rotation: atkBass adds angular velocity burst
  float a1 = time * 0.10 + sub  * 1.2 + atkBass * 4.0;
  float a2 = time * 0.13 + low  * 1.0;
  float a3 = time * 0.08 + high * 1.5 + atkHigh * 3.0;

  float n1 = fbm(vec3(rotate(wp, vec2(0.0),  a1) * (1.6 + mid  * 2.0), time * 0.08 + abs(dMid) * 0.5), 3);
  float n2 = fbm(vec3(rotate(wp, vec2(0.0), -a2) * (2.8 + high * 2.5), time * 0.12), 3);
  float n3 = rmf(   rotate(wp, vec2(0.0),   a3) * (2.0 + sub  * 1.8 + atkBass * 2.0), 3);

  float surface = n1 * 0.45 + n2 * 0.35 + n3 * 0.20;

  // RMF flash on bass attack — bright burst in the noise
  float flashLayer = rmf(wp * (4.0 + sub * 3.0 + atkBass * 5.0), 3) * atkBass;
  surface = mix(surface, flashLayer, atkBass * 0.5);

  // ---- Feedback ----
  vec2 drift = vec2(
    cos(time * 0.13) * (sub  * 0.018 + atkBass * 0.030 + 0.003),
    sin(time * 0.11) * (high * 0.015 + atkHigh * 0.025 + 0.003)
  );
  vec4 prev = texture2D(backbuffer, pn + drift);
  // On falling edge (negative delta): freeze image slightly → contrast with next attack
  float falling  = max(0.0, -dBass);
  float fbk = 0.68 - energy * 0.20 + falling * 0.25;
  surface = mix(prev.r * fbk, surface, 0.40 + energy * 0.40 + atkBass * 0.30);

  // ---- Color ----
  float baseHue  = fract(time * 0.03 + sub * 0.10);
  // High attack flips hue to complement — strong, immediate colour change
  float hueDelta = smoothstep(0.55, 0.90, energy) * 0.50
                 + atkHigh * 0.50;       // independent jump on high transient
  float hue1 = fract(baseHue + hueDelta);
  float hue2 = fract(hue1 + 0.30 + mid  * 0.08);
  float hue3 = fract(hue1 + 0.62 + high * 0.06);

  vec3 c1 = hsv2rgb(vec3(hue1, 0.95, 1.00));
  vec3 c2 = hsv2rgb(vec3(hue2, 0.85, 0.95));
  vec3 c3 = hsv2rgb(vec3(hue3, 0.80, 1.00));

  vec3 col = mix(black, c1, smoothstep(0.04, 0.42, surface));
  col      = mix(col,   c2, smoothstep(0.36, 0.68, surface));
  col      = mix(col,   c3, smoothstep(0.62, 0.94, surface));

  // Broad energy flash
  col = mix(col, white, smoothstep(0.70, 1.00, energy) * 0.45);

  // Bass attack: hot orange bloom
  col = mix(col, orange, atkBass * atkBass * 0.60);

  // High attack: white spike — sharp, very brief (onset decays fast)
  col = mix(col, white, atkHigh * atkHigh * 0.75);

  // Vignette
  vec2 vc = pn - 0.5;
  col *= 1.0 - dot(vc, vc) * 1.2;

  col = max(col, vec3(0.02, 0.01, 0.03));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
});
