registerScene2({
  id: 'aurora-wave',
  name: 'Aurora Wave',
  glsl: `
    void main() {
      vec2 pn = uvN();
      vec2 p  = uv();

      float sub  = bands.x * 3.0;
      float low  = bands.y * 2.5;
      float mid  = bands.z * 2.5;
      float high = bands.w * 3.5;

      // Concentrate aurora in upper 60% of screen
      float yFade = smoothstep(0.0, 0.6, 1.0 - pn.y);

      // Flowing horizontal ripple, modulated by mid band
      float ripple = snoise(vec3(
        p.x * (2.0 + mid * 3.0) + time * (0.15 + sub * 0.3),
        p.y * 1.5,
        time * 0.08
      ));

      // Main band shape via fbm, ripple-warped vertically
      float band = fbm(vec3(
        p.x * 1.5,
        p.y * (3.0 + low * 4.0) + ripple * 0.3 + time * 0.06,
        time * 0.05
      ), 3);

      float surface = band * yFade * (0.8 + sub * 0.4);

      // Three aurora hue layers: green-teal → cyan-blue → violet
      float hue1 = 0.38 + mid  * 0.05;
      float hue2 = 0.55 + high * 0.08;
      float hue3 = 0.75 + sub  * 0.10;

      vec3 col = mix(black, hsv2rgb(vec3(hue1, 0.8, 0.9)), smoothstep(0.10, 0.50, surface));
      col = mix(col, hsv2rgb(vec3(hue2, 0.7, 1.0)), smoothstep(0.40, 0.75, surface));
      col = mix(col, hsv2rgb(vec3(hue3, 0.9, 0.8)), smoothstep(0.65, 0.95, surface) * high);

      // onset.w: shimmer burst via additional snoise layer
      float shimmer = snoise(vec3(p * 6.0, time * 0.5)) * 0.5 + 0.5;
      col += col * shimmer * onset.w * 0.8;

      // Stars in the lower/non-aurora areas
      float star = step(0.998, fract(sin(dot(floor(pn * 80.0), vec2(127.1, 311.7))) * 43758.5));
      col += vec3(star * (1.0 - yFade) * 0.6);

      // Moderate feedback with slight upward drift
      vec2 drift = vec2(0.0, -0.002);
      vec3 prev = texture2D(backbuffer, uvN() + drift).rgb;
      col = mix(col, prev, 0.60);

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
