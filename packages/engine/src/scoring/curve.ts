import type { Band, Verdict } from "../types";

const CURVE_P = 1.6;
const LN2 = 0.6931471805599453;

/**
 * Band falloff curve: flat 100 inside [lo, hi]; outside, decays as
 * 100·exp(−ln2·d^1.6) where d is the distance beyond the edge measured in
 * falloff-scales (default s = half the band width). Score is exactly 50 at
 * d = 1, C¹-continuous at the band edge, asymptotic to 0.
 *
 * This single curve + the verdict thresholds below reproduce all seven of the
 * source app's published value→verdict pairs (see engine tests).
 */
export function subScore(v: number, b: Band): number {
  const half = Math.max((b.hi - b.lo) / 2, 1e-9);
  const sLo = b.sLo ?? half;
  const sHi = b.sHi ?? half;
  const d = v < b.lo ? (b.lo - v) / sLo : v > b.hi ? (v - b.hi) / sHi : 0;
  if (d === 0) return 100;
  return 100 * Math.exp(-LN2 * Math.pow(d, CURVE_P));
}

export function verdictOf(score: number): Verdict {
  if (score >= 100) return "ideal";
  if (score >= 65) return "near-ideal";
  return "needs-work";
}

/** Round to one decimal, deterministically. */
export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
