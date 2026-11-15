import { TIME_SCALE } from './timescale.js';

// Light curve of Earth crossing the Sun, as seen from Neptune (the page's camera rides with Neptune).
// Assumes a central transit (impact parameter b = 0). Real ones are rare: Earth's orbit is tilted
// 1.77 degrees to Neptune's, so Earth usually passes above or below the Sun's tiny disk.
//
// Geometry at inferior conjunction (Earth between the Sun and Neptune), with circular orbits:
//   Sun radius 695,700 km (IAU nominal), Earth radius 6,371 km (mean).
//   Earth at 1 AU, Neptune at 30.07 AU; periods 1 yr and 164.79 yr.
//   Everything is measured as angles on Neptune's sky, in units of the Sun's angular radius.
//   Earth is 1 AU nearer than the Sun, so it looks 3.4% bigger relative to the Sun than its true size ratio.
//   Its speed across the disk is Earth's angular motion minus the Sun's, both seen from a moving Neptune.
//   Solar limb darkening at 550 nm, quadratic law I(mu) = 1 - u1(1 - mu) - u2(1 - mu)^2,
//   with u1 = 0.47, u2 = 0.23 (converted from Allen's Astrophysical Quantities, Cox 2000).
//
// Earth is under 1% of the Sun's radius, so the brightness behind it is taken as uniform
// (Mandel & Agol 2002 small-planet approximation); the covered area during ingress and
// egress is computed exactly from the overlap of the two disks.

const R_SUN_KM = 695_700;
const R_EARTH_KM = 6_371;
const AU_KM = 149_597_870.7;
const YEAR_S = 365.25 * 86400;
const NEPTUNE_AU = 30.07;
const NEPTUNE_PERIOD_YR = 164.79;

const sunDistance = NEPTUNE_AU * AU_KM; // Neptune to Sun
const earthDistance = (NEPTUNE_AU - 1) * AU_KM; // Neptune to Earth
const earthSpeed = (2 * Math.PI * AU_KM) / YEAR_S; // km/s
const neptuneSpeed = (2 * Math.PI * sunDistance) / (NEPTUNE_PERIOD_YR * YEAR_S);
const sunAngularRadius = R_SUN_KM / sunDistance; // rad

/** Earth's angular radius as a fraction of the Sun's, seen from Neptune. */
export const K = R_EARTH_KM / earthDistance / sunAngularRadius;
/** Earth's speed across the Sun's face, in solar radii per second. */
export const SPEED_RSUN_PER_S =
  ((earthSpeed - neptuneSpeed) / earthDistance + neptuneSpeed / sunDistance) / sunAngularRadius;
export const U1 = 0.47;
export const U2 = 0.23;
const MEAN_INTENSITY = 1 - U1 / 3 - U2 / 6; // disk-averaged I(mu), so the unocculted Sun sums to 1

/** Full transit duration, first to fourth contact, in seconds. */
export const DURATION_S = (2 * (1 + K)) / SPEED_RSUN_PER_S;

/** @param {number} r distance from the Sun's center in solar radii */
export function intensity(r) {
  const mu = Math.sqrt(Math.max(0, 1 - r * r));
  return 1 - U1 * (1 - mu) - U2 * (1 - mu) ** 2;
}

/**
 * Area where a disk of radius k centered at distance z overlaps the unit disk.
 * @param {number} z
 * @param {number} k
 */
function overlapArea(z, k) {
  if (z >= 1 + k) return 0;
  if (z <= 1 - k) return Math.PI * k * k;
  const a = Math.acos((z * z + k * k - 1) / (2 * z * k));
  const b = Math.acos((z * z + 1 - k * k) / (2 * z));
  return k * k * a + b - 0.5 * Math.sqrt((-z + k + 1) * (z + k - 1) * (z - k + 1) * (z + k + 1));
}

/**
 * Relative flux of the Sun at time t from mid-transit.
 * @param {number} t seconds
 */
export function flux(t) {
  const z = Math.abs(t) * SPEED_RSUN_PER_S;
  const area = overlapArea(z, K);
  if (area === 0) return 1;
  // During ingress/egress, sample the limb brightness at the middle of the covered sliver.
  const r = z <= 1 - K ? z : (z - K + 1) / 2;
  return 1 - (area * intensity(r)) / (Math.PI * MEAN_INTENSITY);
}

// Shared playback clock, so the light curve and the transit view show the same moment.
// The window runs from -WINDOW_HOURS to +WINDOW_HOURS around mid-transit and loops,
// at the page's one-Neptune-day-per-minute speed-up.
export const WINDOW_HOURS = 10;
const SWEEP_MS = ((2 * WINDOW_HOURS * 3600) / TIME_SCALE) * 1000;
const clockStart = performance.now() - SWEEP_MS / 2; // open at mid-transit

/** Fraction of the way through the window, 0 to 1. */
export function windowPhase(now = performance.now()) {
  return ((now - clockStart) % SWEEP_MS) / SWEEP_MS;
}

/** Hours from mid-transit at the current moment. */
export const hoursNow = (now = performance.now()) => -WINDOW_HOURS + 2 * WINDOW_HOURS * windowPhase(now);
