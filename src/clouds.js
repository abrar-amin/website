import * as THREE from 'three';

// Neptune's high-altitude methane clouds: bright white streaks stretched east-west by the
// planet's zonal winds. Coverage is set to an active period like the 2000s-2010s (Keck/Hubble),
// when bright clouds were common at southern mid-latitudes (~20-50 S) and around 20-40 N;
// they have been much rarer since 2019.
//
// Winds use the standard fit to Voyager 2 cloud tracking (Sromovsky et al. 1993):
//   u(lat) = -398 + 0.188 lat^2 - 1.2e-5 lat^4   [m/s, lat in degrees]
// i.e. ~400 m/s retrograde (westward) at the equator, ~250 m/s prograde near 70 degrees.
// These are relative to the interior, so the mesh should spin with the planet's body.
//
// Advection is done "flow-map" style: two samples, each advected for at most one cycle,
// crossfaded so the shear never accumulates without bound.

const NEPTUNE_RADIUS_M = 24_764_000;

// Shared GLSL: 3D simplex noise and a 5-octave fractal sum, also used for the Sun's prominences.
export const NOISE_GLSL = /* glsl */ `
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
`;

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
  uniform float uTime;       // real seconds
  uniform float uTimeScale;  // simulated seconds per real second
  uniform float uCycle;      // real seconds each advected sample lives before being recycled
  uniform vec3 uSunDir;      // world space, normalized
  uniform float uOpacity;

  varying vec3 vLocal;
  varying vec3 vWorldNormal;

  const float PI = 3.14159265;
  const float RADIUS = ${NEPTUNE_RADIUS_M.toFixed(1)};

  ${NOISE_GLSL}
  // Angular speed (rad per real second, + = prograde/eastward) from the Voyager wind profile.
  float angularSpeed(float lat) {
    float d = degrees(lat);
    float u = -398.0 + 0.188 * d * d - 1.2e-5 * d * d * d * d;
    float fadeAtPole = smoothstep(1.48, 1.3, abs(lat)); // avoid the 1/cos blow-up at the pole
    return uTimeScale * u / (RADIUS * max(cos(lat), 0.05)) * fadeAtPole;
  }

  // Where bright clouds tend to form: broad mid-latitude bands in both hemispheres,
  // plus a fainter southern high-latitude band.
  float bandMask(float lat) {
    float d = degrees(lat);
    float north = exp(-pow((d - 30.0) / 14.0, 2.0));
    float south = exp(-pow((d + 35.0) / 17.0, 2.0));
    float polar = 0.7 * exp(-pow((d + 68.0) / 6.0, 2.0));
    return max(max(north, south), polar);
  }

  // Cloud density at surface point p after being advected for t real seconds.
  float density(vec3 p, float t, float seed) {
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.z, p.x);

    // Trace back along the zonal wind. Positive mesh spin decreases atan(z, x),
    // so eastward (prograde) motion is toward smaller lon.
    float lon0 = lon + angularSpeed(lat) * t;
    vec3 q = vec3(cos(lat) * cos(lon0), p.y, cos(lat) * sin(lon0));

    vec3 o = vec3(seed * 17.31, seed * 7.13, seed * 3.71);
    float evolve = t * 0.02;
    // Strongly stretched east-west: thin streaks rather than blobs.
    float streaks = fbm(q * vec3(3.0, 22.0, 3.0) + o + evolve);
    float clumps = fbm(q * 4.0 + o * 0.5);
    return streaks * mix(0.55, 1.0, clumps) * bandMask(lat);
  }

  void main() {
    float cycle = uTime / uCycle;
    float f1 = fract(cycle);
    float f2 = fract(cycle + 0.5);
    float w1 = 1.0 - abs(2.0 * f1 - 1.0);
    float w2 = 1.0 - w1;

    float d1 = density(vLocal, f1 * uCycle, floor(cycle));
    float d2 = density(vLocal, f2 * uCycle, floor(cycle + 0.5) + 50.0);
    float alpha = (smoothstep(0.36, 0.56, d1) * w1 + smoothstep(0.36, 0.56, d2) * w2) * uOpacity;

    float sunAngle = dot(normalize(vWorldNormal), uSunDir);
    float light = 0.12 + 0.95 * smoothstep(-0.1, 1.0, sunAngle);
    gl_FragColor = vec4(vec3(1.0) * light, alpha);
  }
`;

/**
 * @param {THREE.Vector3} sunDirection world-space direction toward the sun
 * @param {number} timeScale simulated seconds per real second
 */
export function createCloudMaterial(sunDirection, timeScale) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uTimeScale: { value: timeScale },
      uCycle: { value: 20 },
      uSunDir: { value: sunDirection.clone().normalize() },
      uOpacity: { value: 0.95 },
    },
  });
}
