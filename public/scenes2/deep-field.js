registerScene2({
  id: 'deep-field',
  name: 'Deep Field',
  glsl: `
    void main() {
      vec2 pn = uvN();
      vec2 p  = uv();

      float sub  = bands.x * 3.5;
      float mid  = bands.z * 2.5;
      float high = bands.w * 4.0;

      // Domain-warped nebula cloud
      float wx = snoise(vec3(p * 1.2, time * 0.04));
      float wy = snoise(vec3(p * 1.2 + 7.3, time * 0.04));
      vec2 wp = p + vec2(wx, wy) * (0.2 + sub * 0.3);
      float nebula = fbm(vec3(wp * 1.5, time * 0.03 + mid * 0.1), 3);

      // Sparse stars
      float star = step(0.994, fract(sin(dot(floor(p * 50.0 + time * 0.01), vec2(127.1, 311.7))) * 43758.5453));

      // Bright star clusters
      float cluster = step(0.985, fract(sin(dot(floor(p * 15.0), vec2(269.5, 183.3)) + time * 0.008) * 43758.5453));

      // Two-hue nebula: warm orange-red regions vs cool blue-violet
      float hueWarm = 0.05 + sub * 0.04;
      float hueCool = 0.62 + mid * 0.06;
      float blend = fbm(vec3(p * 0.8 + 5.0, time * 0.02), 3);
      vec3 nebCol = mix(
        hsv2rgb(vec3(hueWarm, 0.8, 0.5)),
        hsv2rgb(vec3(hueCool, 0.7, 0.6)),
        blend
      );

      // onset.x: nebula brightness burst
      vec3 col = nebCol * smoothstep(0.2, 0.9, nebula) * (0.5 + sub * 0.5 + onset.x * 0.6);

      // Stars
      col += white * star * (0.5 + high * 0.5);

      // Bright cluster glow
      col += hsv2rgb(vec3(hueCool, 0.5, 1.0)) * cluster * (0.8 + onset.w * 0.8);

      // Ensure minimum deep space darkness with faint blue tint
      col = max(col, vec3(0.0, 0.0, 0.01));

      // Heavy feedback — space evolves slowly
      vec3 prev = texture2D(backbuffer, pn).rgb;
      col = mix(col, prev, 0.72);

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
