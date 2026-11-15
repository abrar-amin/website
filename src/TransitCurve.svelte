<script>
  import { onMount } from 'svelte';
  import { flux, WINDOW_HOURS, windowPhase } from './transit.js';

  // Plot window and resolution. Each braille character is a 2x4 grid of dots.
  const HOURS = WINDOW_HOURS; // shown on each side of mid-transit
  const COLS = 60;
  const ROWS = 7;
  const DOTS_X = COLS * 2;
  const DOTS_Y = ROWS * 4;
  const DEPTH_MAX_PPM = 120; // bottom of the plot
  const BLANK = 0x2800; // empty braille cell; used instead of spaces so every cell has the same width
  const DOT_BITS = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]]; // [row][col]

  const dipPpm = (/** @type {number} */ hours) => (1 - flux(hours * 3600)) * 1e6;

  const cells = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  /** @type {number | null} */
  let prevY = null;
  for (let x = 0; x < DOTS_X; x++) {
    const hours = -HOURS + (2 * HOURS * x) / (DOTS_X - 1);
    const y = Math.round((dipPpm(hours) / DEPTH_MAX_PPM) * (DOTS_Y - 1));
    // Fill vertically to the previous point so ingress and egress stay connected
    const [from, to] = prevY === null ? [y, y] : [Math.min(y, prevY), Math.max(y, prevY)];
    for (let yy = from; yy <= to; yy++) cells[yy >> 2][x >> 1] |= DOT_BITS[yy & 3][x & 1];
    prevY = y;
  }
  const rows = cells.map((row) => row.map((bits) => String.fromCharCode(BLANK + bits)).join(''));

  // Axis labels are placed by percentage so they line up whatever font draws the braille.
  const ticks = [-8, -4, 0, 4, 8].map((h) => ({
    text: h > 0 ? `+${h}h` : `${h}h`,
    left: ((h + HOURS) / (2 * HOURS)) * 100,
  }));

  // 9x9 pixel Earth: ocean, land, and polar ice, in flat colours
  const EARTH_SPRITE = [
    '...www...',
    '..oogoo..',
    '.ogggooo.',
    'oogggooog',
    'oooggoogg',
    'ooooooggo',
    '.oooooog.',
    '..ooooo..',
    '...www...',
  ];
  const EARTH_COLORS = { o: '#2b5cab', g: '#4c8b3f', w: '#f2f2f2' };
  const earthPixels = EARTH_SPRITE.flatMap((line, y) =>
    [...line].flatMap((ch, x) => (ch in EARTH_COLORS ? [{ x, y, fill: EARTH_COLORS[/** @type {'o' | 'g' | 'w'} */ (ch)] }] : []))
  );

  // A pixel Earth rides along the curve at the current moment, on the clock shared with the 3D scene;
  // the part of the curve already traced is brighter. Without motion, Earth sits at mid-transit.
  let phase = 0.5;
  let cursor = COLS;

  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    /** @type {number} */
    let frameId;
    function tick() {
      frameId = requestAnimationFrame(tick);
      phase = windowPhase();
      cursor = Math.round(phase * COLS);
    }
    tick();
    return () => cancelAnimationFrame(frameId);
  });

  // Placed by percentage, like the axis labels, so it lines up whatever font draws the braille.
  $: earthLeft = phase * 100;
  $: earthTop = ((dipPpm(-HOURS + 2 * HOURS * phase) / DEPTH_MAX_PPM) * (DOTS_Y - 1) + 0.5) / DOTS_Y * 100;
</script>

<figure aria-label="Light curve of Earth passing in front of the Sun, seen from Neptune: the Sun dims by up to 111 parts per million over 13 hours">
  <div class="plot">
    <div class="curve">
      <pre aria-hidden="true">{#each rows as row}<span>{row.slice(0, cursor)}</span><span class="dim">{row.slice(cursor)}</span>
{/each}</pre>
      <svg class="earth" aria-hidden="true" viewBox="-1 -1 11 11" shape-rendering="crispEdges" style="left: {earthLeft}%; top: {earthTop}%">
        <rect x="-1" y="-1" width="11" height="11" fill="#000" />
        {#each earthPixels as p}<rect x={p.x} y={p.y} width="1" height="1" fill={p.fill} />{/each}
      </svg>
    </div>
    <div class="axis" aria-hidden="true">
      {#each ticks as tick}<span style="left: {tick.left}%">{tick.text}</span>{/each}
    </div>
  </div>
</figure>

<style>
  figure {
    margin: 0;
  }

  .plot {
    display: inline-block;
  }

  pre {
    margin: 0;
    color: #fff;
    font-family: 'Apple Braille', 'Segoe UI Symbol', 'DejaVu Sans Mono', monospace;
    line-height: 1.2;
  }

  .curve {
    position: relative;
  }

  /* 3 screen pixels per sprite pixel; the black border hides the line right under it */
  .earth {
    position: absolute;
    width: 33px;
    height: 33px;
    transform: translate(-50%, -50%);
  }

  .dim {
    color: #555;
  }

  .axis {
    position: relative;
    height: 1.5em;
    margin-top: 0.75em;
    color: #6b6b6b;
  }

  .axis span {
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
  }
</style>
