registerScene2({
  id: 'neon-grid',
  name: 'Neon Grid',
  glsl: `
    void main() {
      vec2 p = uv();

      float sub  = bands.x * 3.0;
      float low  = bands.y * 2.5;
      float mid  = bands.z * 2.5;
      float high = bands.w * 4.0;

      // Grid frequency driven by mid and high bands
      // onset.x: brief grid compression — boost freq on attack
      float freq = 4.0 + mid * 6.0 + high * 4.0 + onset.x * 8.0;

      // Horizontal and vertical lines with slow drift
      vec2 grid = fract(p * freq + time * vec2(0.05 + low * 0.1, 0.04 + sub * 0.1)) - 0.5;
      float lineH = 1.0 - smoothstep(0.0, 0.04 + high * 0.02, abs(grid.y));
      float lineV = 1.0 - smoothstep(0.0, 0.04 + high * 0.02, abs(grid.x));
      float lines = max(lineH, lineV);

      // Diagonal lines at 22.5 degrees, slightly fainter
      vec2 dgrid = fract(rotate(p, vec2(0.0), PI2 * 0.125) * (freq * 0.7)) - 0.5;
      float diag = (1.0 - smoothstep(0.0, 0.03, abs(dgrid.x))) * 0.4;

      float surface = max(lines, diag);

      // Neon hue from bass + time
      float hue = fract(time * 0.02 + sub * 0.12);
      vec3 col = mix(black, hsv2rgb(vec3(hue, 1.0, 1.0)), surface);

      // Soft bloom glow on lines
      col += hsv2rgb(vec3(hue, 0.6, 0.4)) * surface * surface * 1.5;

      // onset.w: white flash on lines
      col = mix(col, white, lines * onset.w * 0.6);

      // Light feedback — keep grid crisp
      vec3 prev = texture2D(backbuffer, uvN()).rgb;
      col = mix(col, prev, 0.35);

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
