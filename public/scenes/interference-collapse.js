// INTERFERENCE COLLAPSE
// Zwei interferierende Felder — Feinstruktur kippt mit Obertönen
// Fix: stärkere Bandverstärkung, weniger Feedback, höhere Blend-Rate

registerScene({
  id: 'interference-collapse',
  name: 'Interference Collapse',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  // Amplify bands — WebAudio values are often in low 0..0.3 range
  float sub  = bands.x * 3.0;
  float low  = bands.y * 2.5;
  float mid  = bands.z * 2.0;
  float high = bands.w * 3.0;

  // Frequencies driven hard by audio
  float freq1  = 3.0 + low  * 7.0;
  float freq2  = 3.1 + mid  * 7.0;
  float speed1 = time * 0.2 + sub  * 1.2;
  float speed2 = time * 0.22 + high * 1.2;

  float f1 = fbm(vec3(rotate(p, vec2(0.0),  speed1) * freq1, speed1), 5);
  float f2 = snoise(vec3(rotate(p, vec2(0.2), -speed2) * freq2, speed2)) * 0.5 + 0.5;

  float product  = f1 * f2;
  float diff     = abs(f1 - f2);
  float sum      = (f1 + f2) * 0.5;

  float stripes  = sin(product * PI2 * (4.0 + mid * 9.0) + time * 0.5) * 0.5 + 0.5;
  float collapse = 1.0 - smoothstep(0.0, 0.12 + high * 0.08, diff);

  float surface = mix(sum, stripes,   0.4 + mid  * 0.5);
  surface       = mix(surface, collapse, 0.35 + high * 0.45);

  // Drift direction driven by bass / highs
  vec2 drift = vec2(
    sin(time * 0.07) * sub  * 0.014,
    cos(time * 0.05) * high * 0.010
  );
  vec4  prev = texture2D(backbuffer, pn + drift);

  // Reduced feedback (was 0.88), higher new-frame blend (was 0.2)
  float fbkStr = 0.62 - (mid + high) * 0.04;
  surface = mix(prev.r * fbkStr, surface, 0.48 + mid * 0.35);

  // Colors — more saturation and range
  vec3 baseCol     = mix(black,      vec3(0.07, 0.04, 0.14), sum);
  vec3 stripeCol   = mix(baseCol,    purple, stripes  * (0.55 + low));
  vec3 collapseCol = mix(stripeCol,  white,  collapse * (0.85 + high * 0.5));
  collapseCol      = mix(collapseCol, orange, sub * sub * 0.65);
  collapseCol      = mix(collapseCol, teal,   mid * mid * 0.45);

  // Flash on strong bass transient
  collapseCol = mix(collapseCol, pink, max(0.0, sub - 1.5) * 0.4);

  vec2  vc  = pn - 0.5;
  float vig = 1.0 - dot(vc, vc) * 1.5;
  collapseCol *= clamp(vig, 0.0, 1.0);

  gl_FragColor = vec4(collapseCol, 1.0);
}
`
});
