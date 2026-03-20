// ORBITAL RINGS
// Concentric rings rotating at audio-reactive speeds.
// Bass compresses rings toward centre; high energy spreads them.
// Onset events send a ring-burst ripple outward.
// Angular feedback drift creates a spinning trail.

registerScene({
  id: 'orbital-rings',
  name: 'Orbital Rings',
  glsl: `
void main() {
  vec2 p  = uv();
  vec2 pn = uvN();

  float sub  = bands.x * 3.5;
  float low  = bands.y * 3.0;
  float mid  = bands.z * 2.5;
  float high = bands.w * 3.5;

  float energy = (sub + low + mid + high) * 0.25;
  float r     = length(p);
  float angle = atan(p.y, p.x);  // -PI..PI

  // Primary ring layer — bass compresses, angle modulated by highs
  float rmod = r * (4.0 + mid * 6.0 + sub * 0.3)
             + time * (0.3 + sub * 1.5)
             + angle * (0.5 + high * 1.0);

  // onset.x: sudden ring burst
  rmod += onset.x * 3.0;

  float ring = sin(rmod * 6.2832) * 0.5 + 0.5;

  // Secondary ring layer — faster, thinner, counter-rotating
  float rmod2 = r * (8.0 + high * 10.0)
              - time * (0.5 + mid * 2.0)
              + angle * (0.3 + sub * 0.5);
  float ring2 = sin(rmod2 * 6.2832) * 0.5 + 0.5;

  // Sharpen rings: push toward 0/1 for crisper bands
  ring  = smoothstep(0.30, 0.70, ring);
  ring2 = smoothstep(0.35, 0.65, ring2);

  float surface = ring * 0.60 + ring2 * 0.40;

  // Hue: rotates with time + bass, varies radially
  float hue = fract(time * 0.025 + sub * 0.10 + r * 0.15);
  // Secondary layer offset toward cooler hue
  float hue2 = fract(hue + 0.20 + high * 0.08);

  vec3 colRing1 = hsv2rgb(vec3(hue,  0.88, ring  * (0.7 + sub * 0.5)));
  vec3 colRing2 = hsv2rgb(vec3(hue2, 0.75, ring2 * (0.6 + high * 0.6)));
  vec3 col = mix(colRing2, colRing1, ring);

  // Centre glow on bass peaks
  float centreGlow = exp(-r * (4.0 - sub * 2.0));
  col = mix(col, orange, centreGlow * sub * 0.7);

  // High onset: white ring flash at current radial position
  col = mix(col, white, onset.w * ring2 * 0.70);

  // Feedback — drift along angular (tangential) direction
  vec2 tangent = vec2(-sin(angle), cos(angle));
  vec2 drift = tangent * (0.004 + sub * 0.008);
  vec4 prev = texture2D(backbuffer, pn + drift);
  col = mix(prev.rgb * (0.65 - energy * 0.08), col, 0.42 + mid * 0.22);

  // Vignette
  vec2 vc = pn - 0.5;
  float vign = 1.0 - dot(vc, vc) * 1.25;
  col *= vign;

  col = max(col, vec3(0.01, 0.01, 0.02));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
});
