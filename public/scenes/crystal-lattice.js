// CRYSTAL LATTICE
// Voronoi-based crystalline structure with sharp cell edges.
// Bass onsets shatter and reform the lattice via noise warp.
// High onsets flash bright cyan along cell boundaries.
// Quiet moments freeze the pattern into clean geometric tiles.

registerScene({
  id: 'crystal-lattice',
  name: 'Crystal Lattice',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  float sub  = bands.x * 3.5;
  float low  = bands.y * 3.0;
  float mid  = bands.z * 2.5;
  float high = bands.w * 3.5;

  // Bass onset: shatter — warp cell coordinates with noise
  float shatter = onset.x * 0.65;
  vec2 pw = p;
  if (shatter > 0.01) {
    float nx = snoise(vec3(p * 8.0,       time));
    float ny = snoise(vec3(p * 8.0 + 4.4, time));
    pw = p + vec2(nx, ny) * shatter;
  }

  // delta.z: mid-change briefly scales the lattice
  float cellScale = 3.0 + mid * 5.0 + abs(delta.z) * 2.5;

  // Voronoi cell
  vec2 v = voronoi(vec3(pw * cellScale, time * 0.08 + sub * 0.5));
  // v.x = dist to nearest point (0=centre, ~1=edge), v.y = cell ID

  // Edge mask — sharpness driven by highs
  float edgeThr = 0.04 + high * 0.03;
  float edge = 1.0 - smoothstep(0.0, edgeThr, v.x);

  // Secondary fine lattice layer for depth
  vec2 v2 = voronoi(vec3(pw * cellScale * 2.1, time * 0.12 + low * 0.4));
  float edge2 = 1.0 - smoothstep(0.0, 0.03, v2.x);

  // Cell interior color: deep blue-purple, brighter toward edge
  vec3 cellCol = mix(black, mix(blue, purple, sub * 0.6), v.x * (0.7 + sub * 0.6));

  // Edge color: teal to white
  vec3 edgeCol = mix(teal, white, edge);

  // Combine
  vec3 col = mix(cellCol, edgeCol, edge);
  // Fine lattice adds subtle secondary grid
  col = mix(col, teal * 0.7, edge2 * (0.25 + high * 0.35));

  // High onset: cyan flash along edges
  col = mix(col, cyan, onset.w * onset.w * edge * 0.85);

  // Bass onset brightness: whole frame brightens briefly
  col = mix(col, white * 0.4, onset.x * 0.35);

  // Feedback: moderate persistence — cracked patterns linger
  vec2 drift = vec2(
    snoise(vec3(pn * 2.0, time * 0.06)) * 0.003,
    snoise(vec3(pn * 2.0 + 9.1, time * 0.06)) * 0.003
  );
  vec4 prev = texture2D(backbuffer, pn + drift);
  col = mix(prev.rgb * 0.55, col, 0.50 + mid * 0.18);

  // Vignette
  vec2 vc = pn - 0.5;
  col *= 1.0 - dot(vc, vc) * 1.1;

  col = max(col, vec3(0.01, 0.01, 0.03));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
});
