// THRESHOLD FLIP
// Harter Moduswechsel bei Energieschwelle — kalt/kristallin ↔ warm/chaotisch
// Fix: energy-Berechnung zu schwach, threshold 0.5 zu hoch, backbuffer-blend 0.11 zu langsam

registerScene({
  id: 'threshold-flip',
  name: 'Threshold Flip',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  float sub  = bands.x * 2.5;
  float low  = bands.y * 2.0;
  float mid  = bands.z * 2.0;
  float high = bands.w * 2.5;

  // FIX: was pow(avg * 0.25, 0.5) → too compressed.
  // Weighted sum without pow — reacts proportionally to input.
  float energy = sub * 0.40 + low * 0.30 + mid * 0.20 + high * 0.15;

  // FIX: threshold lowered from 0.5 → 0.28 (a medium signal now triggers B)
  float threshold = 0.28;

  // ---- Mode A: crystalline, cold, slow ----
  float na  = fbm(vec3(p * 2.5, time * 0.06), 6);
  float na2 = snoise(vec3(p * 7.0, time * 0.04)) * 0.5 + 0.5;
  float surfA = na * 0.7 + na2 * 0.3;
  vec3 colA = mix(black, blue,  smoothstep(0.2,  0.6,  surfA));
  colA      = mix(colA,  teal,  smoothstep(0.55, 0.9,  surfA));
  colA      = mix(colA,  cyan,  smoothstep(0.75, 1.0,  surfA) * (0.3 + high * 0.4));
  colA     += vec3(0.03, 0.04, 0.06);

  // ---- Mode B: chaotic, hot, fast ----
  vec2  pr  = rotate(p, vec2(0.0), time * 1.2 + sub * 3.0);
  float nb  = fbm(vec3(pr * (3.0 + low * 2.0), time * 0.4), 4);
  float nb2 = voronoi(vec3(p * (3.0 + mid * 8.0), time * 0.5)).x;
  float surfB = nb * 0.3 + nb2 * 0.5;
  vec3 colB = mix(black, white, smoothstep(0.5,  0.25, surfB));
  colB      = mix(colB,  black, smoothstep(0.5,  0.95, surfB) * high * 2.5);
  colB      = mix(colB,  orange, sub * 0.35);
  colB     += vec3(0.06, 0.05, 0.05);

  float inB = step(threshold, energy);

  // FIX: backbuffer blend was 0.11 (very slow). Now 0.28 — much faster A-mode refresh.
  vec4  prev  = texture2D(backbuffer, pn);
  vec3  froze = mix(prev.rgb * 0.80, colA, 0.28);
  vec3  col   = mix(froze, colB, inB);

  // Sharp flash at the threshold edge
  float atEdge = step(threshold - 0.008, energy) * step(energy, threshold + 0.015);
  col = mix(col, white * 0.6, atEdge);

  // Boost overall brightness
  col = mix(col, col * 1.5, 0.5);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
});
