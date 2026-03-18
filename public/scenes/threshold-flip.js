// THRESHOLD FLIP — v3
// Fix: energy war zu komprimiert (pow+Durchschnitt), threshold zu hoch.
// Neu: energy = gewichtete Rohsumme (kann > 1 sein), threshold 0.22.
// Mode A pulsiert jetzt auch ohne Trigger sichtbar.

registerScene({
  id: 'threshold-flip',
  name: 'Threshold Flip',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  // Raw amplified bands
  float sub  = bands.x * 3.0;
  float low  = bands.y * 2.5;
  float mid  = bands.z * 2.0;
  float high = bands.w * 3.0;

  // FIX: unnormalized weighted sum — reacts proportionally, no pow compression.
  // At moderate music volume (bands ~ 0.2–0.5) energy easily exceeds threshold.
  float energy = sub * 0.45 + low * 0.35 + mid * 0.25 + high * 0.20;

  // FIX: threshold lowered 0.5 → 0.22
  float threshold = 0.22;
  float inB = smoothstep(threshold - 0.04, threshold + 0.04, energy); // soft crossfade

  // ---- Mode A: crystalline, cold — active & animated even at rest ----
  float t1 = time * 0.07;
  float na1 = fbm(vec3(p * 2.2, t1), 5);
  float na2 = fbm(vec3(rotate(p, vec2(0.0), time * 0.04) * 5.5, t1 * 1.3), 4);
  float na3 = snoise(vec3(p * 9.0, t1 * 1.8)) * 0.5 + 0.5;
  float surfA = na1 * 0.5 + na2 * 0.35 + na3 * 0.15;
  // Pulse brightness on mid
  float pulseA = 1.0 + mid * 0.6;
  vec3 colA = mix(black, blue,  smoothstep(0.20, 0.60, surfA)) * pulseA;
  colA      = mix(colA,  teal,  smoothstep(0.55, 0.88, surfA) * pulseA);
  colA      = mix(colA,  cyan,  smoothstep(0.80, 1.00, surfA) * (0.3 + high * 0.5));
  colA     += vec3(0.03, 0.05, 0.08); // minimum glow in A

  // ---- Mode B: chaotic, hot — driven hard by audio ----
  float rotB = time * 1.5 + sub * 4.0;
  vec2  prB  = rotate(p, vec2(0.0), rotB);
  float nb1  = fbm(vec3(prB * (2.5 + low * 3.0), time * 0.45), 4);
  float nb2  = voronoi(vec3(p  * (3.0 + mid * 9.0), time * 0.55 + sub)).x;
  float nb3  = rmf(prB * (1.8 + high * 2.0), 4);
  float surfB = nb1 * 0.25 + nb2 * 0.45 + nb3 * 0.30;

  // Hue in B follows energy — more energy = warmer
  float hueB = fract(0.05 + sub * 0.08 - low * 0.05);
  vec3 colB  = mix(black, hsv2rgb(vec3(hueB, 0.9, 1.0)), smoothstep(0.45, 0.20, surfB));
  colB       = mix(colB,  white,  smoothstep(0.45, 0.85, surfB) * (0.5 + high));
  colB       = mix(colB,  orange, sub * 0.40);
  colB      += vec3(0.06, 0.04, 0.03);

  // ---- Crossfade via backbuffer ----
  vec4 prev  = texture2D(backbuffer, pn);
  // A keeps refreshing at 30% new content per frame — stays alive
  vec3 froze = mix(prev.rgb * 0.78, colA, 0.30);
  vec3 col   = mix(froze, colB, inB);

  // Sharp white flash exactly at threshold crossing
  float atEdge = smoothstep(0.0, 1.0, 1.0 - abs(energy - threshold) / 0.025);
  col = mix(col, white, atEdge * 0.55);

  col = mix(col, col * 1.6, 0.45); // brightness boost

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
});
