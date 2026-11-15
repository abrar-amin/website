import * as THREE from 'three';

// Procedural cloud deck driven by a simple model of solar heating:
//  - Zonal winds (super-rotation) whose speed varies with latitude, with jets at mid-latitudes.
//    The shear between latitudes stretches features into bands and chevrons.
//  - Slow poleward drift at the cloud tops (Hadley circulation: air heated at the equator rises
//    and flows toward the poles).
//  - Convection tied to sunlight: near the subsolar point, heated air churns into puffy cells.
//    Toward the terminator and night side, clouds relax into smooth wind-sheared streaks.
//
// Advection is done "flow-map" style: two samples, each advected for at most one cycle,
// crossfaded so the shear never accumulates without bound.

const vertexShader = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vWorldNormal;

  void main() {
    vLocal = normalize(position);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;     // world space, normalized
  uniform float uOpacity;
  uniform float uWind;      // base zonal angular speed (rad/s)
  uniform float uCycle;     // seconds each advected sample lives before being recycled

  varying vec3 vLocal;
  varying vec3 vWorldNormal;

  const float PI = 3.14159265;

  // 3D simplex noise by Ian McEwan & Stefan Gustavson (Ashima Arts), MIT License.
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
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
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // Fractal noise in roughly [0, 1].
  float fbm(vec3 p) {
    float sum = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += snoise(p) * amp;
      p *= 2.03;
      amp *= 0.5;
    }
    return sum * 0.5 + 0.5;
  }

  // Zonal angular speed by latitude: faster jets around +-45 degrees.
  float zonalSpeed(float lat) {
    float s = abs(lat) / (0.5 * PI);
    return uWind * (1.0 + 0.6 * 4.0 * s * (1.0 - s));
  }

  // Cloud density at surface point p after being advected for t seconds.
  float density(vec3 p, float t, float heat, float seed) {
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.z, p.x);

    // Trace back to where this air came from: east-west by the zonal wind,
    // and from closer to the equator by the poleward Hadley drift.
    float lon0 = lon - zonalSpeed(lat) * t;
    float lat0 = lat - 0.006 * t * sin(2.0 * lat);
    vec3 q = vec3(cos(lat0) * cos(lon0), sin(lat0), cos(lat0) * sin(lon0));

    vec3 o = vec3(seed * 17.31, seed * 7.13, seed * 3.71);
    float boil = t * (0.01 + 0.06 * heat);  // hotter air churns faster

    float streaks = fbm(q * vec3(2.0, 9.0, 2.0) + o + boil);   // stretched east-west
    float cells = fbm(q * 6.0 + o + boil * 2.0);                // convective cells
    float large = fbm(q * 1.5 + o * 0.5);

    return mix(streaks, cells, smoothstep(0.25, 0.9, heat)) * 0.65 + large * 0.35;
  }

  void main() {
    vec3 n = normalize(vWorldNormal);
    float sunAngle = dot(n, uSunDir);
    float heat = clamp(sunAngle, 0.0, 1.0);

    // Two crossfaded samples: each is recycled with a new seed while its weight is zero.
    float cycle = uTime / uCycle;
    float f1 = fract(cycle);
    float f2 = fract(cycle + 0.5);
    float w1 = 1.0 - abs(2.0 * f1 - 1.0);
    float w2 = 1.0 - w1;

    float d1 = density(vLocal, f1 * uCycle, heat, floor(cycle));
    float d2 = density(vLocal, f2 * uCycle, heat, floor(cycle + 0.5) + 50.0);

    // Variance-preserving blend so contrast doesn't dip mid-crossfade.
    float d = 0.5 + ((d1 - 0.5) * w1 + (d2 - 0.5) * w2) / sqrt(w1 * w1 + w2 * w2);

    float alpha = smoothstep(0.42, 0.72, d) * uOpacity;
    float light = 0.2 + 0.9 * smoothstep(-0.15, 1.0, sunAngle);
    vec3 color = vec3(1.0, 0.96, 0.88) * light * mix(0.85, 1.05, d);

    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * @param {THREE.Vector3} sunDirection world-space direction toward the sun
 */
export function createCloudMaterial(sunDirection) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDirection.clone().normalize() },
      uOpacity: { value: 0.85 },
      uWind: { value: 0.05 },
      uCycle: { value: 30 },
    },
  });
}
