<script>
  import { onMount } from 'svelte';
  import { flux } from './transit.js';
  import { TIME_SCALE } from './timescale.js';

  // Plot window and resolution. Each braille character is a 2x4 grid of dots.
  const HOURS = 45; // shown on each side of mid-transit
  const COLS = 60;
  const ROWS = 7;
  const DOTS_X = COLS * 2;
  const DOTS_Y = ROWS * 4;
  const DEPTH_MAX_PPM = 1650; // bottom of the plot
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
  const ticks = [-40, -20, 0, 20, 40].map((h) => ({
    text: h > 0 ? `+${h}h` : `${h}h`,
    left: ((h + HOURS) / (2 * HOURS)) * 100,
  }));

  // The traced part brightens as time sweeps across, at the same speed-up as the planet's spin.
  const SWEEP_S = (2 * HOURS * 3600) / TIME_SCALE;
  let cursor = COLS;

  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now();
    const id = setInterval(() => {
      const phase = (((performance.now() - start) / 1000) % SWEEP_S) / SWEEP_S;
      cursor = Math.round(phase * COLS);
    }, 500);
    return () => clearInterval(id);
  });
</script>

<figure aria-label="Light curve of Neptune passing in front of the Sun, seen edge-on: the Sun dims by up to 1574 parts per million over 74 hours">
  <div class="plot">
    <pre aria-hidden="true">{#each rows as row}<span>{row.slice(0, cursor)}</span><span class="dim">{row.slice(cursor)}</span>
{/each}</pre>
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
