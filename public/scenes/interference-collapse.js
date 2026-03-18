// INTERFERENCE COLLAPSE — v2
// Mehr Bewegung: Domain-Warp vor den Interferenz-Feldern, dritte Rotationsebene,
// Hue-Shift durch Bass, autonome Drift auch ohne Audio.

registerScene({
  id: 'interference-collapse',
  name: 'Interference Collapse',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  // Amplify — bands often sit in 0.05..0.4 range
  float sub  = bands.x * 3.5;
  float low  = bands.y * 3.0;
  float mid  = bands.z * 2.5;
  float high = bands.w * 3.5;
  float rms  = (sub + low + mid + high) * 0.25;

  // ---- Domain warp (adds large-scale turbulence) ----
  // Even without audio there's slow autonomous movement
  float warpT = time * 0.08;
  float wx = snoise(vec3(p * 1.2,       warpT));
  float wy = snoise(vec3(p * 1.2 + 3.7, warpT));
  vec2 wp = p + vec2(wx, wy) * (0.18 + sub * 0.45);

  // ---- Field 1: fbm, rotates with bass ----
  float freq1  = 2.5 + low  * 6.0;
  float speed1 = time * 0.18 + sub * 1.5;
  float f1 = fbm(vec3(rotate(wp, vec2(0.0), speed1) * freq1, speed1 * 0.5), 3);

  // ---- Field 2: snoise, counter-rotates with highs ----
  float freq2  = 2.6 + mid  * 6.0;
  float speed2 = time * 0.21 + high * 1.5;
  float f2 = snoise(vec3(rotate(wp, vec2(0.15, 0.1), -speed2) * freq2, speed2 * 0.4)) * 0.5 + 0.5;

  // ---- Field 3: fast voronoi layer — adds granular detail ----
  float f3 = voronoi(vec3(wp * (3.0 + mid * 4.0), time * 0.25 + sub * 0.8)).x;

  // ---- Interference ----
  float product  = f1 * f2;
  float diff     = abs(f1 - f2);
  float sum      = (f1 + f2) * 0.5;

  // Stripe density driven by mid (more mids = finer stripes)
  float stripes  = sin(product * PI2 * (3.5 + mid * 10.0) + time * 0.6) * 0.5 + 0.5;
  float collapse = 1.0 - smoothstep(0.0, 0.10 + high * 0.06, diff);

  float surface = mix(sum,     stripes,   0.35 + mid  * 0.5);
  surface       = mix(surface, collapse,  0.30 + high * 0.45);
  // Blend in voronoi on bass peaks
  surface       = mix(surface, f3,        sub  * 0.25);

  // ---- Feedback ----
  vec2 drift = vec2(
    sin(time * 0.09 + low)  * (0.006 + sub  * 0.016),
    cos(time * 0.07 + high) * (0.005 + high * 0.012)
  );
  vec4  prev   = texture2D(backbuffer, pn + drift);
  float fbkStr = 0.58 - (mid + high) * 0.04;
  surface = mix(prev.r * fbkStr, surface, 0.50 + mid * 0.32);

  // ---- Color — hue rotates with bass, second band from high ----
  float hueBase = fract(time * 0.018 + sub * 0.12);
  vec3 colDark   = mix(black,  vec3(0.06, 0.03, 0.14), sum);
  vec3 colStripe = mix(colDark,  hsv2rgb(vec3(hueBase, 0.85, 0.9)), stripes * (0.5 + low));
  vec3 colLine   = mix(colStripe, white, collapse * (0.9 + high * 0.4));

  // Bass → warm push
  colLine = mix(colLine, orange, sub * sub * 0.55);
  // High transient → cyan flash
  colLine = mix(colLine, cyan,   max(0.0, high - 1.8) * 0.45);
  // Mid detail → purple tint
  colLine = mix(colLine, purple, mid * mid * 0.35);

  // Vignette
  vec2 vc = pn - 0.5;
  colLine *= 1.0 - dot(vc, vc) * 1.4;

  gl_FragColor = vec4(clamp(colLine, 0.0, 1.0), 1.0);
}
`
});
