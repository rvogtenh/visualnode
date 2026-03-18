// GLSL helper library — The Force compatible
// Prepended to every fragment shader by the engine.

window.GLSL_HELPERS = `
precision highp float;

uniform float     time;
uniform vec2      resolution;
uniform vec4      bands;        // x=bass(20-120Hz), y=low(120-500Hz), z=mid(500-4kHz), w=high(4k-20kHz)
uniform sampler2D backbuffer;

// ---- Constants -----------------------------------------------
const float PI  = 3.14159265358979323846;
const float PI2 = 6.28318530717958647692;

// ---- Colors --------------------------------------------------
const vec3 black  = vec3(0.0);
const vec3 white  = vec3(1.0);
const vec3 red    = vec3(1.0, 0.0, 0.0);
const vec3 green  = vec3(0.0, 1.0, 0.0);
const vec3 blue   = vec3(0.05, 0.1, 0.9);
const vec3 teal   = vec3(0.0, 0.75, 0.75);
const vec3 purple = vec3(0.5, 0.0, 1.0);
const vec3 orange = vec3(1.0, 0.45, 0.0);
const vec3 yellow = vec3(1.0, 1.0, 0.0);
const vec3 cyan   = vec3(0.0, 0.9, 1.0);
const vec3 pink   = vec3(1.0, 0.1, 0.6);

// ---- Coordinate helpers (The Force compatible) ---------------
vec2 uv() {
  return (gl_FragCoord.xy - resolution * 0.5) / min(resolution.x, resolution.y) * 2.0;
}
vec2 uvN() {
  return gl_FragCoord.xy / resolution;
}

// ---- Rotate --------------------------------------------------
vec2 rotate(vec2 p, vec2 center, float angle) {
  float s = sin(angle); float c = cos(angle);
  p -= center;
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c) + center;
}

// ---- HSV → RGB -----------------------------------------------
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// ---- 3D Simplex Noise (Stefan Gustavson) ---------------------
vec3 _mod289v3(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 _mod289v4(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 _permute(vec4 x){ return _mod289v4(((x*34.0)+1.0)*x); }
vec4 _taylorInvSqrt(vec4 r){ return 1.79284291400159-0.85373472095314*r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = _mod289v3(i);
  vec4 p = _permute(_permute(_permute(
    i.z + vec4(0.0,i1.z,i2.z,1.0))
    + i.y + vec4(0.0,i1.y,i2.y,1.0))
    + i.x + vec4(0.0,i1.x,i2.x,1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0*floor(p*ns.z*ns.z);
  vec4 x_ = floor(j*ns.z);
  vec4 y_ = floor(j - 7.0*x_);
  vec4 x = x_*ns.x + ns.yyyy;
  vec4 y = y_*ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = _taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m*m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

// ---- FBM (fractal brownian motion, 6 octaves max) ------------
float fbm(vec3 p, int octaves) {
  float v = 0.0, a = 0.5;
  vec3  sh = vec3(100.3, 200.7, 50.1);
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += a * (snoise(p) * 0.5 + 0.5);
    p  = p * 2.0 + sh;
    a *= 0.5;
  }
  return v;
}

// ---- Voronoi — returns vec2(minDist, cellId) -----------------
vec2 voronoi(vec3 p) {
  vec3 b = floor(p);
  vec3 f = fract(p);
  float md = 8.0; float id = 0.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 nb = b + vec3(float(x), float(y), float(z));
    vec3 rp = vec3(
      fract(sin(dot(nb, vec3(127.1, 311.7,  74.3))) * 43758.5),
      fract(sin(dot(nb, vec3(269.5, 183.3, 246.1))) * 43758.5),
      fract(sin(dot(nb, vec3( 74.3, 246.1, 183.3))) * 43758.5)
    );
    vec3 r = vec3(float(x), float(y), float(z)) + rp - f;
    float d = dot(r, r);
    if (d < md) { md = d; id = fract(sin(dot(nb, vec3(3.1,7.3,2.7)))*43758.5); }
  }
  return vec2(clamp(sqrt(md), 0.0, 1.0), id);
}

// ---- RMF (Ridged Multifractal, 5 octaves max) ----------------
float rmf(vec2 p, int octaves) {
  float v = 0.0, a = 0.5, w = 1.0;
  vec2  sh = vec2(100.3, 200.7);
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    float n = 1.0 - abs(snoise(vec3(p, 0.0)));
    n = n * n * w;
    v += n * a;
    w  = clamp(n * 2.0, 0.0, 1.0);
    p  = p * 2.17 + sh;
    a *= 0.5;
  }
  return clamp(v, 0.0, 1.0);
}
`;
