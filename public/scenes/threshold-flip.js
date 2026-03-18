// THRESHOLD FLIP — v4
// onset.x (Bass-Attack) beschleunigt den Warp in Mode B
// onset.w (High-Attack) erzeugt einen Weiss-Blitz unabhängig vom Threshold
// delta treibt einen kurzen "Riss" in Mode A auf Transienten
// Threshold reagiert auf schnelle Amplitudenänderung: steigt onset hoch →
//   crossfade zu B auch wenn steady-state energy noch unter Schwelle liegt

registerScene({
  id: 'threshold-flip',
  name: 'Threshold Flip',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  float sub  = bands.x * 3.0;
  float low  = bands.y * 2.5;
  float mid  = bands.z * 2.0;
  float high = bands.w * 3.0;

  // Steady-state energy (slow changes)
  float energy = sub * 0.45 + low * 0.35 + mid * 0.25 + high * 0.20;

  // Attack signals — react to sudden amplitude increase
  float atkBass = onset.x;  // bass attack: 0..1, decays fast
  float atkHigh = onset.w;  // high attack: 0..1

  // Combined trigger: steady energy OR a strong bass attack tips it over
  float trigger = max(energy, atkBass * 0.75);
  float threshold = 0.22;
  float inB = smoothstep(threshold - 0.04, threshold + 0.04, trigger);

  // ---- Mode A: crystalline, cold ----
  float t1  = time * 0.07;
  float na1 = fbm(vec3(p * 2.2, t1), 5);
  float na2 = fbm(vec3(rotate(p, vec2(0.0), time * 0.04) * 5.5, t1 * 1.3), 4);
  float na3 = snoise(vec3(p * 9.0, t1 * 1.8)) * 0.5 + 0.5;
  float surfA = na1 * 0.50 + na2 * 0.35 + na3 * 0.15;

  // delta.z (mid change) cracks the A surface on transients
  float crack = abs(delta.z) * 2.5;
  surfA = mix(surfA, 1.0 - surfA, crack * smoothstep(0.3, 0.8, surfA));

  float pulseA = 1.0 + mid * 0.6;
  vec3 colA  = mix(black, blue, smoothstep(0.20, 0.60, surfA)) * pulseA;
  colA       = mix(colA,  teal, smoothstep(0.55, 0.88, surfA) * pulseA);
  colA       = mix(colA,  cyan, smoothstep(0.80, 1.00, surfA) * (0.3 + high * 0.5));
  colA      += vec3(0.03, 0.05, 0.08);

  // ---- Mode B: chaotic, hot — attack drives speed ----
  // Bass attack warps B faster: rotation accelerates on transient
  float rotB = time * 1.5 + sub * 4.0 + atkBass * 8.0;
  vec2  prB  = rotate(p, vec2(0.0), rotB);
  float nb1  = fbm(vec3(prB * (2.5 + low * 3.0), time * 0.45 + atkBass * 2.0), 4);
  float nb2  = voronoi(vec3(p  * (3.0 + mid * 9.0), time * 0.55 + sub + atkBass)).x;
  float nb3  = rmf(prB * (1.8 + high * 2.0), 4);
  float surfB = nb1 * 0.25 + nb2 * 0.45 + nb3 * 0.30;

  // B gets brighter and faster on onset
  float hueB  = fract(0.05 + sub * 0.08 - low * 0.05 + atkBass * 0.15);
  vec3 colB   = mix(black, hsv2rgb(vec3(hueB, 0.9, 1.0)), smoothstep(0.45, 0.20, surfB));
  colB        = mix(colB,  white,  smoothstep(0.45, 0.85, surfB) * (0.5 + high + atkHigh));
  colB        = mix(colB,  orange, sub * 0.40 + atkBass * 0.30);
  colB       += vec3(0.06, 0.04, 0.03);

  // ---- Backbuffer crossfade ----
  vec4 prev  = texture2D(backbuffer, pn);
  vec3 froze = mix(prev.rgb * 0.78, colA, 0.30);
  vec3 col   = mix(froze, colB, inB);

  // Flash at threshold edge
  float atEdge = smoothstep(0.0, 1.0, 1.0 - abs(trigger - threshold) / 0.025);
  col = mix(col, white, atEdge * 0.55);

  // High-frequency attack → independent white spike (short, sharp)
  col = mix(col, white, atkHigh * atkHigh * 0.70);

  // Bass attack: warm bloom independent of mode
  col = mix(col, orange, atkBass * atkBass * 0.45);

  col = mix(col, col * 1.6, 0.45);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
});
