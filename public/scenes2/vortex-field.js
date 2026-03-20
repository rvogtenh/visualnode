registerScene2({
  id: 'vortex-field',
  name: 'Vortex Field',
  glsl: `
    void main() {
      vec2 pn = uvN();
      vec2 p  = uv();

      float sub  = bands.x * 3.5;
      float mid  = bands.z * 2.5;
      float high = bands.w * 3.0;

      // Polar coordinates
      float r = length(p);
      float a = atan(p.y, p.x);

      // Two counter-rotating spiral layers
      float spiral1 = sin(a * (3.0 + mid * 3.0) + r * (4.0 + sub * 3.0) - time * (0.8 + sub * 1.5));
      float spiral2 = sin(a * (5.0 + high * 4.0) - r * (6.0 + mid * 4.0) + time * (1.2 + high * 2.0));

      // Domain warp with slow global rotation
      vec2 pw = rotate(p, vec2(0.0), time * 0.15 + sub * 0.5);
      float noise = fbm(vec3(pw * 2.0, time * 0.1), 3);

      float surface = (spiral1 * 0.4 + spiral2 * 0.4 + noise * 0.2) * 0.5 + 0.5;

      // Deep purple-magenta with bright arms; hue shifts outward
      float hue = fract(time * 0.025 + sub * 0.08 + r * 0.1);
      vec3 col = mix(black, hsv2rgb(vec3(hue, 0.9, 1.0)), smoothstep(0.3, 0.8, surface));

      // Centre glow driven by bass
      col += purple * (1.0 - smoothstep(0.0, 0.5, r)) * sub * 0.6;

      // onset.w: white arm flash
      col = mix(col, white, onset.w * smoothstep(0.3, 0.8, surface) * 0.5);

      // Feedback with tangential drift for swirl persistence
      vec2 drift = vec2(-p.y, p.x) * 0.003 / max(r, 0.1);
      vec3 prev = texture2D(backbuffer, pn + drift).rgb;
      col = mix(col, prev, 0.55);

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
