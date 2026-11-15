// Light curve of Neptune crossing the Sun, as seen by a distant observer lying in
// Neptune's orbital plane (impact parameter b = 0, i.e. a central transit).
//
// Inputs:
//   Sun radius 695,700 km (IAU nominal), Neptune equatorial radius 24,764 km (1 bar).
//   Semi-major axis 30.07 AU, period 164.79 yr. The orbit is treated as circular and the
//   chord across the Sun as a straight line (the orbit's curvature over 1.4 million km is negligible).
//   Solar limb darkening at 550 nm, quadratic law I(mu) = 1 - u1(1 - mu) - u2(1 - mu)^2,
//   with u1 = 0.47, u2 = 0.23 (converted from Allen's Astrophysical Quantities, Cox 2000).
//
// The planet is ~3.6% of the Sun's radius, so the brightness behind it is taken as uniform
// (Mandel & Agol 2002 small-planet approximation); the covered area during ingress and
// egress is computed exactly from the overlap of the two disks.

const R_SUN_KM = 695_700;
const R_NEPTUNE_KM = 24_764;
const AU_KM = 149_597_870.7;
const A_KM = 30.07 * AU_KM;
const PERIOD_S = 164.79 * 365.25 * 86400;

const K = R_NEPTUNE_KM / R_SUN_KM; // radius ratio
const SPEED_RSUN_PER_S = (2 * Math.PI * A_KM) / PERIOD_S / R_SUN_KM;
const U1 = 0.47;
const U2 = 0.23;
const MEAN_INTENSITY = 1 - U1 / 3 - U2 / 6; // disk-averaged I(mu), so the unocculted Sun sums to 1

/** Full transit duration, first to fourth contact, in seconds. */
export const DURATION_S = (2 * (1 + K)) / SPEED_RSUN_PER_S;

/** @param {number} r distance from the Sun's center in solar radii */
function intensity(r) {
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
