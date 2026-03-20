registerScene2({
  id: 'petal-bloom',
  name: 'Petal Bloom',
  glsl: `
    void main() {
      vec2 pn = uvN();
      vec2 p  = uv();

      float sub  = bands.x * 3.0;
      float low  = bands.y * 2.5;
      float mid  = bands.z * 2.0;
      float high = bands.w * 3.5;

      // Polar coordinates
      float r = length(p);
      float a = atan(p.y, p.x);

      // Primary petals — mid drives fold count (5 to 7)
      float k = 5.0 + floor(mid * 3.0);
      float petal = cos(a * k + time * (0.2 + sub * 0.4)) * 0.5 + 0.5;
      // onset.x expands the bloom threshold outward
      float bloom = smoothstep(0.0, petal * (0.5 + sub * 0.3) + 0.1, 0.7 + onset.x * 0.4 - r);

      // Secondary ring of finer petals
      float k2 = k * 2.0;
      float petal2 = cos(a * k2 - time * (0.3 + high * 0.5)) * 0.5 + 0.5;
      float bloom2 = smoothstep(0.0, petal2 * 0.25, 0.45 - r) * step(0.2, r);

      float surface = bloom * 0.65 + bloom2 * 0.35;

      // Warm organic palette — hue rotates slowly around the petal ring
      float hue = fract(time * 0.015 + sub * 0.06 + a / PI2 * 0.15);
      vec3 col = mix(black, hsv2rgb(vec3(hue, 0.75, 0.9)), surface);

      // Bright centre that pulses on bass onset
      col = mix(col, white, (1.0 - smoothstep(0.0, 0.15, r)) * (0.3 + onset.x * 0.5));

      // Feedback with gentle rotational drift
      vec2 drift = vec2(-p.y, p.x) * 0.002;
      vec3 prev = texture2D(backbuffer, pn + drift).rgb;
      col = mix(col, prev, 0.50);

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
