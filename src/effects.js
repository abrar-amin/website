// Post-process looks for the Neptune scene. The scene renders off-screen in linear light,
// then one of these full-screen passes redraws it. All are flat-colour: no blur, bloom or glow.
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Shared by every pass. luminance() comes from three.js's shader prefix.
const COMMON = /* glsl */ `
  uniform sampler2D uScene;   // linear, high precision
  uniform vec2 uResolution;   // drawing buffer, in pixels
  varying vec2 vUv;

  vec3 sceneAt(vec2 px) { return texture2D(uScene, px / uResolution).rgb; }
  // Perceived lightness, 0..1 (display gamma), so thresholds are spread evenly to the eye
  float lightness(vec3 c) { return pow(clamp(luminance(c), 0.0, 1.0), 1.0 / 2.2); }
  // The colour's hue at full brightness, so glyphs and dots carry it while their size carries lightness
  vec3 hueOf(vec3 c) { return c / max(max(c.r, c.g), max(c.b, 1e-4)); }

  // 8x8 Bayer threshold in 0..1
  float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
  float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

  // Linear sRGB to OKLab (Bjorn Ottosson), where distances match perceived colour differences
  vec3 toOklab(vec3 c) {
    vec3 lms = mat3(
      0.4122214708, 0.2119034982, 0.0883024619,
      0.5363325363, 0.6806995451, 0.2817188376,
      0.0514459929, 0.1073969566, 0.6299787005) * c;
    lms = pow(max(lms, 0.0), vec3(1.0 / 3.0));
    return mat3(
      0.2104542553, 1.9779984951, 0.0259040371,
      0.7936177850, -2.4285922050, 0.7827717662,
      -0.0040720468, 0.4505937099, -0.8086757660) * lms;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`;

/** Linear sRGB to OKLab, matching the shader. @param {THREE.Color} c */
function toOklab(c) {
  const l = Math.cbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b);
  const m = Math.cbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b);
  const s = Math.cbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  return new THREE.Vector3(
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  );
}

/** Palette uniforms (OKLab for matching, linear RGB for drawing). @param {string[]} hexes */
function palette(hexes) {
  const colors = hexes.map((hex) => new THREE.Color(hex)); // Color converts sRGB hex to linear
  return {
    uInks: { value: colors.map(toOklab) },
    uInkColors: { value: colors.map((c) => new THREE.Vector3(c.r, c.g, c.b)) },
  };
}

const NEAREST_INK = (/** @type {number} */ n) => /* glsl */ `
  uniform vec3 uInks[${n}];
  uniform vec3 uInkColors[${n}];
  vec3 nearestInk(vec3 lab) {
    int best = 0;
    float bestDistance = 1e9;
    for (int i = 0; i < ${n}; i++) {
      vec3 d = lab - uInks[i];
      float distance = dot(d, d);
      if (distance < bestDistance) { bestDistance = distance; best = i; }
    }
    vec3 color = uInkColors[0];
    for (int i = 0; i < ${n}; i++) if (i == best) color = uInkColors[i];
    return color;
  }
`;

// Inks sampled from Voyager 2's Neptune imagery, plus one muted red for the prominences
const PLATE_INKS = ['#000000', '#0b1a3a', '#1f3f8f', '#3f6bd6', '#7fa3e8', '#e8eef5', '#7a3a32'];

// xterm's default 16 ANSI colours
const ANSI_16 = [
  '#000000', '#cd0000', '#00cd00', '#cdcd00', '#0000ee', '#cd00cd', '#00cdcd', '#e5e5e5',
  '#7f7f7f', '#ff0000', '#00ff00', '#ffff00', '#5c5cff', '#ff00ff', '#00ffff', '#ffffff',
];

// Character ramp for the ASCII look, sparse to dense
const ASCII_RAMP = ' .:-=+*#%@';

// Original 16x16 pixel-art blocks for the tile mosaic, drawn procedurally from Neptune's palette.
// Each has a base colour, a few speckle colours, and a pattern.
const TILE_SIZE = 16;
const TILES = [
  { pattern: 'speckle', colors: ['#14244f', '#0e1a3c', '#1b2f63', '#0a1430'] }, // deep atmosphere
  { pattern: 'bands', colors: ['#2a4fa8', '#23458f', '#3459b8', '#1f3f80'] },   // blue cloud bands
  { pattern: 'cracks', colors: ['#5d86dc', '#4d75c9', '#7da0e6', '#3f63b0'] },  // pale ice
  { pattern: 'clumps', colors: ['#dfe7f2', '#c8d4e6', '#f2f5fa', '#aebfd8'] },  // methane cloud
  { pattern: 'speckle', colors: ['#f4ead8', '#efe0c4', '#fbf4e8', '#e3cfae'] }, // sunlit surface
  { pattern: 'clumps', colors: ['#a2463a', '#8a3a30', '#b85646', '#6e2e27'] },  // prominence
];

/** Small seeded PRNG so the blocks look the same on every load. @param {number} seed */
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws the block strip and measures each block's mean linear colour. */
function tileAtlas() {
  const N = TILE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = N * TILES.length;
  canvas.height = N;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const rand = mulberry32(2026);
  TILES.forEach(({ pattern, colors }, t) => {
    const [base, dark, light, deep] = colors;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = rand();
      let color = base;
      if (pattern === 'speckle') color = r < 0.18 ? dark : r < 0.3 ? light : r < 0.36 ? deep : base;
      if (pattern === 'bands') color = (y + (r < 0.2 ? 1 : 0)) % 5 === 0 ? dark : (y % 5 === 2 && r < 0.5) ? light : r < 0.08 ? deep : base;
      if (pattern === 'cracks') color = (x + y) % 7 === 0 && r < 0.8 ? deep : (x * 3 + y) % 11 === 0 && r < 0.6 ? dark : r < 0.15 ? light : base;
      if (pattern === 'clumps') {
        const cx = Math.sin(x * 0.9 + t) + Math.cos(y * 0.7 - t);
        color = cx > 1.1 ? light : cx < -1.1 ? dark : r < 0.07 ? deep : base;
      }
      // Bevel: lit top-left edge, shadowed bottom-right edge, so each reads as a block
      if (x === 0 || y === 0) color = light;
      if (x === N - 1 || y === N - 1) color = deep;
      ctx.fillStyle = color;
      ctx.fillRect(t * N + x, y, 1, 1);
    }
  });
  const pixels = ctx.getImageData(0, 0, canvas.width, N).data;
  const means = TILES.map((_, t) => {
    const sum = new THREE.Color(0, 0, 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * canvas.width + t * N + x) * 4;
      sum.add(new THREE.Color().setRGB(pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255, THREE.SRGBColorSpace));
    }
    return sum.multiplyScalar(1 / (N * N));
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return { texture, means };
}

// Real block textures (public/textures/block) for the block mosaic: opaque, static, untinted 16x16
// full-cube faces. Mostly blues, plus darks for the night side, whites for the Sun and stars,
// and reds for the prominences.
const BLOCK_TEXTURES = [
  // dark
  'black_concrete', 'coal_block', 'black_wool',
  'gray_concrete', 'gray_wool', 'deepslate', 'cyan_terracotta',
  // blue
  'deepslate_lapis_ore', 'lapis_block', 'blue_concrete', 'blue_wool', 'blue_concrete_powder',
  'light_blue_terracotta', 'dark_prismarine', 'warped_wart_block', 'cyan_concrete', 'cyan_wool',
  'light_blue_concrete', 'light_blue_wool', 'light_blue_concrete_powder', 'packed_ice', 'blue_ice',
  // grey and white
  'stone', 'light_gray_wool', 'smooth_stone', 'white_concrete', 'calcite', 'white_wool',
  'quartz_block_side', 'snow',
  // warm
  'end_stone', 'sandstone_top', 'white_terracotta', 'gold_block', 'yellow_wool', 'orange_wool',
  'red_nether_bricks', 'nether_wart_block', 'red_concrete', 'red_terracotta', 'red_wool',
];
const BLOCK_SIZE = 16; // texels per texture side
const BLOCK_TEXEL = 1; // screen (drawing buffer) pixels per texel: whole numbers keep nearest-neighbour scaling exact

/** Loads the block textures into one strip and measures each block's mean linear colour, in OKLab. */
function blockAtlas() {
  const N = BLOCK_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = N * BLOCK_TEXTURES.length;
  canvas.height = N;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const labs = BLOCK_TEXTURES.map(() => new THREE.Vector3());
  const ready = { value: 0 };
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
  Promise.all(
    BLOCK_TEXTURES.map((name, i) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { ctx.drawImage(image, 0, 0, N, N, i * N, 0, N, N); resolve(null); };
      image.onerror = reject;
      image.src = `/textures/block/${name}.png`;
    }))
  ).then(() => {
    const pixels = ctx.getImageData(0, 0, canvas.width, N).data;
    BLOCK_TEXTURES.forEach((_, b) => {
      const sum = new THREE.Color(0, 0, 0);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = (y * canvas.width + b * N + x) * 4;
        sum.add(new THREE.Color().setRGB(pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255, THREE.SRGBColorSpace));
      }
      labs[b].copy(toOklab(sum.multiplyScalar(1 / (N * N))));
    });
    texture.needsUpdate = true;
    ready.value = 1;
  }, (error) => console.warn('block textures failed to load', error));
  return { uBlocks: { value: texture }, uBlockLab: { value: labs }, uReady: ready };
}

/**
 * Glyph strip for the ASCII look, drawn in the page's font once it has loaded.
 * @param {string} ramp
 */
function glyphAtlas(ramp) {
  const W = 32, H = 64; // per glyph, oversampled
  const canvas = document.createElement('canvas');
  canvas.width = W * [...ramp].length;
  canvas.height = H;
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const draw = () => {
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = `500 ${H * 0.8}px "Geist Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [...ramp].forEach((ch, i) => ctx.fillText(ch, W * (i + 0.5), H * 0.52));
    texture.needsUpdate = true;
  };
  draw();
  document.fonts?.load(`500 16px "Geist Mono"`).then(draw);
  return texture;
}

/**
 * A look made of monospace character cells: each cell's lightness picks a glyph from the ramp.
 * @param {{ name: string, note: string, ramp: string, exposure: number, color: string }} o
 *   color: GLSL expression using c (cell colour), l (lightness) and ink (glyph coverage)
 * @returns {Effect}
 */
function glyphEffect({ name, note, ramp, exposure, color }) {
  const glyphs = [...ramp].length;
  return {
    name,
    note,
    uniforms: () => ({
      uAtlas: { value: glyphAtlas(ramp) },
      uCell: { value: new THREE.Vector2(7, 13) },
      uExposure: { value: exposure },
    }),
    fragment: /* glsl */ `
      ${COMMON}
      uniform sampler2D uAtlas;
      uniform vec2 uCell;
      uniform float uExposure;
      const float GLYPHS = ${glyphs.toFixed(1)};
      void main() {
        vec2 cell = floor(gl_FragCoord.xy / uCell);
        vec2 local = fract(gl_FragCoord.xy / uCell);
        // Average a few samples so thin features (stars, the rim) still register
        vec3 c = vec3(0.0);
        for (int i = 0; i < 2; i++) for (int j = 0; j < 2; j++)
          c += sceneAt((cell + vec2(0.25 + 0.5 * float(i), 0.25 + 0.5 * float(j))) * uCell);
        c *= 0.25 * uExposure;
        float l = lightness(c);
        float index = min(floor(l * GLYPHS), GLYPHS - 1.0);
        float ink = texture2D(uAtlas, vec2((index + local.x) / GLYPHS, local.y)).r;
        gl_FragColor = vec4(${color}, 1.0);
        #include <colorspace_fragment>
      }
    `,
  };
}

/**
 * @typedef {{ name: string, note: string, fragment: string, uniforms?: () => Record<string, THREE.IUniform>, pixelated?: boolean }} Effect
 *   pixelated: the browser scales the canvas up to the screen nearest-neighbour instead of smoothing it
 * @type {Effect[]}
 */
export const EFFECTS = [
  {
    name: 'raw',
    note: 'the render as-is',
    fragment: /* glsl */ `
      ${COMMON}
      void main() {
        gl_FragColor = vec4(texture2D(uScene, vUv).rgb, 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'plate',
    note: '7 Voyager inks + grain',
    uniforms: () => palette(PLATE_INKS),
    fragment: /* glsl */ `
      ${COMMON}
      ${NEAREST_INK(PLATE_INKS.length)}
      void main() {
        vec3 lab = toOklab(texture2D(uScene, vUv).rgb);
        lab.x += (hash(gl_FragCoord.xy) - 0.5) * 0.07;
        gl_FragColor = vec4(nearestInk(lab), 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  glyphEffect({
    name: 'ascii',
    note: 'Geist Mono glyph ramp',
    ramp: ASCII_RAMP,
    exposure: 1.8,
    color: 'hueOf(c) * ink',
  }),
  glyphEffect({
    name: 'blocks',
    note: 'shade characters, like a TUI',
    ramp: ' ░▒▓█',
    exposure: 3.2,
    color: 'hueOf(c) * ink',
  }),
  glyphEffect({
    name: 'hexdump',
    note: 'each cell prints its lightness, 0-f',
    ramp: '0123456789abcdef',
    exposure: 1.6,
    // Empty space stays a quiet field of zeros; brighter cells print in the scene's colour
    color: 'ink * mix(vec3(0.010, 0.013, 0.020), hueOf(c), smoothstep(0.0, 0.5, l))',
  }),
  {
    name: 'braille',
    note: '2x4 dot cells, ordered threshold',
    uniforms: () => ({ uPitch: { value: 4.0 }, uGap: { value: 2.0 } }),
    fragment: /* glsl */ `
      ${COMMON}
      uniform float uPitch; // dot spacing within a character
      uniform float uGap;   // extra space between characters
      void main() {
        vec2 cellSize = vec2(2.0, 4.0) * uPitch + uGap;
        vec2 cell = floor(gl_FragCoord.xy / cellSize);
        vec2 local = gl_FragCoord.xy - cell * cellSize;
        vec2 dotIndex = floor(local / uPitch);
        if (dotIndex.x > 1.0 || dotIndex.y > 3.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        vec2 dotCenter = cell * cellSize + (dotIndex + 0.5) * uPitch;
        vec3 c = sceneAt(dotCenter);
        vec2 grid = cell * vec2(2.0, 4.0) + dotIndex;
        float on = step(bayer4(grid) * 0.92 + 0.04, lightness(c * 1.8));
        float r = length(gl_FragCoord.xy - dotCenter);
        float disc = 1.0 - smoothstep(uPitch * 0.32, uPitch * 0.32 + 1.0, r);
        gl_FragColor = vec4(mix(vec3(0.82, 0.87, 0.94), hueOf(c), 0.5) * on * disc, 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'dither',
    note: '1-bit, 8x8 Bayer, 2px pixels',
    uniforms: () => ({
      uPixel: { value: 2.0 },
      uDark: { value: new THREE.Color('#000000') },
      uLight: { value: new THREE.Color('#c9d6ea') },
    }),
    fragment: /* glsl */ `
      ${COMMON}
      uniform float uPixel;
      uniform vec3 uDark;
      uniform vec3 uLight;
      void main() {
        vec2 p = floor(gl_FragCoord.xy / uPixel);
        float l = lightness(1.6 * sceneAt((p + 0.5) * uPixel));
        gl_FragColor = vec4(mix(uDark, uLight, step(bayer8(p) + 0.5 / 64.0, l)), 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'halftone',
    note: '45 degree dot screen',
    uniforms: () => ({ uCell: { value: 7.0 } }),
    fragment: /* glsl */ `
      ${COMMON}
      uniform float uCell;
      void main() {
        const float A = 0.7853982; // 45 degrees
        mat2 rot = mat2(cos(A), sin(A), -sin(A), cos(A));
        vec2 q = rot * gl_FragCoord.xy / uCell;
        vec2 center = (floor(q) + 0.5);
        vec3 c = sceneAt(transpose(rot) * center * uCell);
        // Dot area proportional to lightness
        float radius = sqrt(lightness(c)) * 0.62;
        float d = length(q - center);
        float aa = 1.0 / uCell;
        float disc = 1.0 - smoothstep(radius - aa, radius + aa, d);
        gl_FragColor = vec4(hueOf(c) * disc, 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'ansi',
    note: 'half-block cells, xterm 16 colours',
    uniforms: () => ({ ...palette(ANSI_16), uCell: { value: new THREE.Vector2(6, 12) } }),
    fragment: /* glsl */ `
      ${COMMON}
      ${NEAREST_INK(ANSI_16.length)}
      uniform vec2 uCell;
      void main() {
        // Each character cell shows two square pixels (upper and lower half block)
        vec2 block = vec2(uCell.x, uCell.y * 0.5);
        vec2 p = floor(gl_FragCoord.xy / block);
        vec3 c = sceneAt((p + 0.5) * block);
        // Boost before matching: Neptune is dark, and xterm has few dark colours
        vec3 lab = toOklab(c * 2.2);
        lab.x += (bayer4(p) - 0.5) * 0.12;
        gl_FragColor = vec4(nearestInk(lab), 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'contour',
    note: 'isolines of lightness',
    uniforms: () => ({ uLevels: { value: 14.0 } }),
    fragment: /* glsl */ `
      ${COMMON}
      uniform float uLevels;
      void main() {
        vec3 c = texture2D(uScene, vUv).rgb;
        float v = lightness(c) * uLevels;
        float distanceToLine = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-4);
        float line = 1.0 - clamp(distanceToLine - 0.5, 0.0, 1.0);
        gl_FragColor = vec4(hueOf(c) * line * step(0.5 / uLevels, lightness(c) + 0.02), 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'phosphor',
    note: 'amber mono terminal, 4 levels, scan gaps',
    uniforms: () => ({ uInk: { value: new THREE.Color('#ffb000') } }),
    fragment: /* glsl */ `
      ${COMMON}
      uniform vec3 uInk;
      void main() {
        vec2 p = floor(gl_FragCoord.xy / 3.0);
        float l = lightness(3.0 * sceneAt((p + 0.5) * 3.0));
        float level = floor(clamp(l * 3.0 + bayer4(p) - 0.5, 0.0, 3.0)) / 3.0;
        float scanGap = step(2.0, mod(gl_FragCoord.y, 3.0)); // every third row dark
        gl_FragColor = vec4(uInk * level * level * (1.0 - scanGap), 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'edges',
    note: 'Sobel outlines on 32px graph paper',
    uniforms: () => ({ uGrid: { value: new THREE.Color('#141a24') } }),
    fragment: /* glsl */ `
      ${COMMON}
      uniform vec3 uGrid;
      float L(vec2 px) { return lightness(1.6 * sceneAt(px)); }
      void main() {
        vec2 p = gl_FragCoord.xy;
        float tl = L(p + vec2(-1, 1)), t = L(p + vec2(0, 1)), tr = L(p + vec2(1, 1));
        float l = L(p + vec2(-1, 0)), r = L(p + vec2(1, 0));
        float bl = L(p + vec2(-1, -1)), b = L(p + vec2(0, -1)), br = L(p + vec2(1, -1));
        float gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
        float gy = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);
        float edge = step(0.22, length(vec2(gx, gy)));
        vec2 g = mod(p, 32.0);
        float grid = step(g.x, 1.0) + step(g.y, 1.0) > 0.0 ? 1.0 : 0.0;
        vec3 ink = mix(vec3(0.85, 0.9, 1.0), hueOf(sceneAt(p)), 0.4);
        gl_FragColor = vec4(edge > 0.0 ? ink : uGrid * grid, 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'hatch',
    note: 'pen-plotter crosshatching',
    fragment: /* glsl */ `
      ${COMMON}
      float hatch(vec2 p, vec2 dir, float spacing) {
        return step(mod(dot(p, normalize(dir)), spacing), 1.0);
      }
      void main() {
        vec2 p = gl_FragCoord.xy;
        vec3 c = sceneAt(p);
        float l = lightness(1.7 * c);
        // On black, light is drawn: each brighter band adds another direction of strokes
        float ink = 0.0;
        if (l > 0.12) ink = max(ink, hatch(p, vec2(1, 1), 7.0));
        if (l > 0.32) ink = max(ink, hatch(p, vec2(1, -1), 7.0));
        if (l > 0.52) ink = max(ink, hatch(p, vec2(1, 0), 5.0));
        if (l > 0.72) ink = max(ink, hatch(p, vec2(0, 1), 4.0));
        gl_FragColor = vec4(mix(vec3(0.85, 0.9, 1.0), hueOf(c), 0.45) * ink, 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'pixel',
    note: '4px pixels, plate inks, ordered dither',
    uniforms: () => palette(PLATE_INKS),
    fragment: /* glsl */ `
      ${COMMON}
      ${NEAREST_INK(PLATE_INKS.length)}
      void main() {
        vec2 p = floor(gl_FragCoord.xy / 4.0);
        vec3 lab = toOklab(sceneAt((p + 0.5) * 4.0));
        lab.x += (bayer4(p) - 0.5) * 0.1;
        gl_FragColor = vec4(nearestInk(lab), 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'stipple',
    note: '1px dots, interleaved-gradient noise',
    fragment: /* glsl */ `
      ${COMMON}
      void main() {
        vec2 p = gl_FragCoord.xy;
        vec3 c = sceneAt(p);
        // Jimenez's interleaved gradient noise: even, grain-free threshold without a texture
        float threshold = fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
        float on = step(threshold, lightness(1.6 * c));
        gl_FragColor = vec4(mix(vec3(0.85, 0.9, 1.0), hueOf(c), 0.5) * on, 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'minecraft',
    pixelated: true,
    note: '16px pixel-art block mosaic',
    uniforms: () => {
      const { texture, means } = tileAtlas();
      return {
        uTiles: { value: texture },
        uTileLab: { value: means.map(toOklab) },
        uTileLum: { value: means.map((c) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722) },
      };
    },
    fragment: /* glsl */ `
      ${COMMON}
      uniform sampler2D uTiles;
      uniform vec3 uTileLab[${TILES.length}];
      uniform float uTileLum[${TILES.length}];
      const float SIZE = ${TILE_SIZE.toFixed(1)};
      const float COUNT = ${TILES.length.toFixed(1)};
      void main() {
        vec2 cell = floor(gl_FragCoord.xy / SIZE);
        vec2 texel = floor(mod(gl_FragCoord.xy, SIZE));
        vec3 c = vec3(0.0);
        for (int i = 0; i < 2; i++) for (int j = 0; j < 2; j++)
          c += sceneAt((cell + vec2(0.25 + 0.5 * float(i), 0.25 + 0.5 * float(j))) * SIZE);
        c *= 0.25;
        if (lightness(c) < 0.06) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } // empty space
        // Pick the block by colour, ignoring brightness (brightness becomes the block's lighting)
        vec3 lab = toOklab(c);
        int best = 0;
        float bestDistance = 1e9;
        for (int i = 0; i < ${TILES.length}; i++) {
          vec2 d = lab.yz - uTileLab[i].yz;
          float distance = dot(d, d) + 0.15 * pow(lab.x - uTileLab[i].x, 2.0);
          if (distance < bestDistance) { bestDistance = distance; best = i; }
        }
        // Light each block in four flat steps, like blocks lit face by face
        float shade = luminance(c) / max(uTileLum[best], 1e-3);
        shade = clamp(ceil(shade * 4.0) / 4.0, 0.25, 1.5);
        vec2 uv = (vec2(float(best) * SIZE, 0.0) + texel + 0.5) / vec2(SIZE * COUNT, SIZE);
        gl_FragColor = vec4(texture2D(uTiles, uv).rgb * shade, 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
  {
    name: 'block',
    pixelated: true,
    note: `${BLOCK_TEXTURES.length} block textures, matched by mean colour`,
    uniforms: blockAtlas,
    fragment: /* glsl */ `
      ${COMMON}
      uniform sampler2D uBlocks;
      uniform vec3 uBlockLab[${BLOCK_TEXTURES.length}];
      uniform float uReady;
      const float SIZE = ${(BLOCK_SIZE * BLOCK_TEXEL).toFixed(1)}; // cell, in screen pixels
      const float COUNT = ${BLOCK_TEXTURES.length.toFixed(1)};
      void main() {
        vec2 cell = floor(gl_FragCoord.xy / SIZE);
        vec3 c = vec3(0.0);
        for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++)
          c += sceneAt((cell + (vec2(float(i), float(j)) + 0.5) / 3.0) * SIZE);
        c *= 4.5 / 9.0; // Neptune is dark next to most blocks
        // Each cell is the block whose average colour is nearest, with a small ordered nudge
        // in lightness so smooth gradients alternate between neighbouring blocks instead of banding
        vec3 lab = toOklab(c);
        lab.x += (bayer4(cell) - 0.5) * 0.03;
        int best = 0;
        float bestDistance = 1e9;
        for (int i = 0; i < ${BLOCK_TEXTURES.length}; i++) {
          vec3 d = lab - uBlockLab[i];
          // Hue counts more than lightness: Neptune is dark, and most dark blocks are grey
          float distance = d.x * d.x + 6.0 * dot(d.yz, d.yz);
          if (distance < bestDistance) { bestDistance = distance; best = i; }
        }
        // (the canvas texture is flipped on upload, so texel rows already run bottom-up like the screen)
        vec2 texel = floor(mod(gl_FragCoord.xy, SIZE) / ${BLOCK_TEXEL.toFixed(1)});
        vec2 uv = (vec2(float(best) * ${BLOCK_SIZE.toFixed(1)}, 0.0) + texel + 0.5) / vec2(${BLOCK_SIZE.toFixed(1)} * COUNT, ${BLOCK_SIZE.toFixed(1)});
        vec3 color = texture2D(uBlocks, uv).rgb;
        if (lightness(c) < 0.05) color = vec3(0.0); // empty space
        if (uReady < 0.5) color = texture2D(uScene, vUv).rgb; // textures still loading
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  },
];

/**
 * Builds the material for one effect.
 * @param {Effect} effect
 * @param {THREE.Texture} sceneTexture
 * @param {THREE.Vector2} resolution  shared, updated on resize
 */
export function createEffectMaterial(effect, sceneTexture, resolution) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: effect.fragment,
    uniforms: {
      uScene: { value: sceneTexture },
      uResolution: { value: resolution },
      ...(effect.uniforms?.() ?? {}),
    },
    depthTest: false,
    depthWrite: false,
  });
}
