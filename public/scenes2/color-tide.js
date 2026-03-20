registerScene2({
  id: 'color-tide',
  name: 'Color Tide',
  glsl: `
    void main() {
      vec2 p = uv();

      float sub  = bands.x * 3.0;
      float low  = bands.y * 2.5;
      float mid  = bands.z * 2.0;
      float high = bands.w * 3.0;

      // Two slow fbm fields at large scale
      float f1 = fbm(vec3(p * 0.8,       time * 0.05 + sub * 0.3), 3);
      float f2 = fbm(vec3(p * 0.6 + 2.3, time * 0.04 + low * 0.2), 3);

      // Three slowly drifting hues
      float hue1 = fract(time * 0.012 + sub  * 0.08);
      float hue2 = fract(hue1 + 0.33  + mid  * 0.05);
      float hue3 = fract(hue1 + 0.66  + high * 0.04);

      // Smooth three-way HSV blend
      vec3 col = mix(
        hsv2rgb(vec3(hue1, 0.7, 0.6)),
        hsv2rgb(vec3(hue2, 0.8, 0.8)),
        f1
      );
      col = mix(col, hsv2rgb(vec3(hue3, 0.6, 0.9)), f2 * 0.5);

      // onset.x: brief brightness pulse
      col += col * onset.x * 0.5;

      // Moderate feedback for smooth persistence
      vec3 prev = texture2D(backbuffer, uvN()).rgb;
      col = mix(col, prev, 0.65);

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
