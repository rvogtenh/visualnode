// STOCHASTIC JUMP
// Zufällige Parameterwechsel — Tempo der Sprünge = Audio-Energie
// Fix: blend war 0.2 → surface blieb nahe 0 → schwarz.
//      smoothstep-Schwellen zu hoch. Sub-Gating entfernt.

registerScene({
  id: 'stochastic-jump',
  name: 'Stochastic Jump',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  float sub    = bands.x * 2.5;
  float low    = bands.y * 2.0;
  float mid    = bands.z * 2.0;
  float high   = bands.w * 2.5;
  float energy = (sub + low + mid + high) * 0.35;

  // Jump speed driven by energy
  float jumpSpeed = 0.8 + energy * 3.5;
  float jumpTime  = floor(time * jumpSpeed);

  float s0 = fract(sin(jumpTime * 127.1 + 1.0) * 43758.5);
  float s1 = fract(sin(jumpTime * 311.7 + 2.0) * 43758.5);
  float s2 = fract(sin(jumpTime * 74.3  + 3.0) * 43758.5);
  float s3 = fract(sin(jumpTime * 191.9 + 4.0) * 43758.5);

  float rScale = 2.0 + s0 * 5.0;
  float rAngle = s1 * PI2;
  float rMode  = s2;
  float rHue   = s3;

  vec2 pr = rotate(p, vec2(0.0), rAngle + time * 0.1);

  float n0 = fbm(vec3(pr * rScale, time * 0.15), 5);
  float n1 = voronoi(vec3(pr * rScale * 0.6, time * 0.12)).x; // already clamped 0..1
  float n2 = rmf(pr * rScale * 0.4, 4);                       // already clamped 0..1

  float surface = n0;
  if (rMode > 0.33) surface = mix(n0, n1, (rMode - 0.33) * 3.0);
  if (rMode > 0.66) surface = mix(n1, n2, (rMode - 0.66) * 3.0);
  surface = clamp(surface, 0.0, 1.0);

  // FIX: blend was 0.2 → surface stayed near 0 → black image
  // Now starts at 0.55 so surface builds to visible levels immediately
  vec4  prev  = texture2D(backbuffer, pn);
  float blend = 0.55 + energy * 0.25;
  surface = mix(prev.r * 0.80, surface, blend);

  // Three hues from current random state
  vec3 c0  = hsv2rgb(vec3(rHue,                0.9, 1.0));
  vec3 c1  = hsv2rgb(vec3(fract(rHue + 0.45),  0.7, 0.9));
  vec3 c2  = hsv2rgb(vec3(fract(rHue + 0.72),  0.6, 1.0));

  // FIX: lowered thresholds (was 0.2→0.65, 0.6→0.95) so color is visible at low audio
  vec3 col = mix(black, c0, smoothstep(0.05, 0.45, surface));
  col      = mix(col,   c1, smoothstep(0.40, 0.72, surface));
  col      = mix(col,   c2, smoothstep(0.68, 0.95, surface));

  // Minimum glow — never fully black
  col = max(col, vec3(0.03, 0.02, 0.04));

  // FIX: was col *= (0.5 + sub * 1.2) — with sub≈0 this halved everything
  // Now floor at 0.7 so image stays visible without audio
  col *= (0.7 + sub * 0.5);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
});
