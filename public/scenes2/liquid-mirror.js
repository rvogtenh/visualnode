registerScene2({
  id: 'liquid-mirror',
  name: 'Liquid Mirror',
  glsl: `
    void main() {
      vec2 pn = uvN();
      vec2 p  = uv();

      float sub  = bands.x * 3.0;
      float mid  = bands.z * 2.5;
      float high = bands.w * 3.5;

      // Surface ripples from three offset sources
      float r1 = sin(length(p - vec2(0.3, 0.2)) * (6.0 + sub * 4.0) - time * (1.5 + sub * 2.0));
      float r2 = sin(length(p - vec2(-0.4, -0.1)) * (7.0 + mid * 5.0) - time * (1.8 + mid * 2.0));
      float r3 = sin(length(p + vec2(0.1, 0.35)) * (5.0 + high * 8.0) - time * (2.5 + high * 3.0));
      float surface = (r1 + r2 + r3) / 3.0 * 0.5 + 0.5;

      // Fine high-frequency surface texture
      surface += snoise(vec3(p * (4.0 + high * 6.0), time * 0.2)) * 0.15;
      surface = clamp(surface, 0.0, 1.0);

      // onset.x: wave compression burst — tighten ripple frequency
      float burstSub = sub + onset.x * 1.5;
      float br1 = sin(length(p - vec2(0.3, 0.2)) * (6.0 + burstSub * 4.0) - time * (1.5 + burstSub * 2.0));
      surface = mix(surface, (br1 * 0.5 + 0.5), onset.x * 0.4);

      // Cool blue-silver palette
      float hue = 0.55 + sub * 0.05;
      vec3 col = mix(vec3(0.02, 0.04, 0.08), hsv2rgb(vec3(hue, 0.5, 0.85)), surface);

      // Specular highlight on wave crests
      col += white * pow(surface, 8.0) * (0.3 + onset.w * 0.5);

      // Feedback with UV distortion along ripple gradient for mirror smear
      float dx = sin(length(p - vec2(0.3, 0.2)) * 6.0 - time * 1.5) * 0.002;
      float dy = sin(length(p - vec2(-0.4, -0.1)) * 7.0 - time * 1.8) * 0.002;
      vec2 smear = pn + vec2(dx, dy) * (1.0 + sub * 0.5);
      vec3 prev = texture2D(backbuffer, smear).rgb;
      col = mix(col, prev, 0.60);

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
