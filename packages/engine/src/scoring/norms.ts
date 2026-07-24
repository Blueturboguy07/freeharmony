import normsData from "./norms.json";

interface NormTable {
  pcts: number[];
  p: number[];
  n: number;
  mean: number;
  sd: number;
}

interface OverallScoreStats {
  pcts: number[];
  p: number[];
  n: number;
  mean: number;
  median: number;
  sd: number;
}

const METRIC_NORMS: Record<string, NormTable> = (
  normsData as { metrics: Record<string, NormTable> }
).metrics;

const SCORE_STATS: { overall: OverallScoreStats } | null =
  (normsData as { scores?: { overall: OverallScoreStats } }).scores ?? null;

export const NORMS_META = (normsData as { meta: { source: string; faces: number } }).meta;

/**
 * Population percentile of a raw metric value, from the calibration corpus
 * (piecewise-linear over the stored percentile table). Returns null when no
 * corpus has been baked in. Deterministic: a static lookup, not a model.
 */
export function percentileOf(key: string, value: number): number | null {
  const t = METRIC_NORMS[key];
  if (!t || t.p.length < 2) return null;
  return interpolate(t.p, t.pcts, value);
}

function interpolate(p: number[], pcts: number[], value: number): number {
  if (value <= p[0]!) return pcts[0]!;
  if (value >= p[p.length - 1]!) return pcts[pcts.length - 1]!;
  for (let i = 0; i < p.length - 1; i++) {
    const lo = p[i]!;
    const hi = p[i + 1]!;
    if (value >= lo && value <= hi) {
      const t01 = hi === lo ? 0 : (value - lo) / (hi - lo);
      return Math.round(pcts[i]! + t01 * (pcts[i + 1]! - pcts[i]!));
    }
  }
  return pcts[pcts.length - 1]!;
}

/**
 * Population percentile of an overall harmony score (calibrated profile),
 * from the corpus score distribution. Null before score-space calibration.
 */
export function overallPercentileOf(overall: number): number | null {
  if (!SCORE_STATS) return null;
  const { p, pcts } = SCORE_STATS.overall;
  if (p.length < 2) return null;
  return interpolate(p, pcts, overall);
}

/**
 * Population-standardized overall score: a T-score centered on the corpus
 * (median face ⇒ 50, each 15 points ≈ one population SD), clamped to [1, 99].
 * This is the "how do I compare" number; the harmony % stays the
 * "how close to the aesthetic bands" number.
 */
export function standardizedOverall(overall: number): number | null {
  if (!SCORE_STATS) return null;
  const { mean, sd } = SCORE_STATS.overall;
  if (!(sd > 0)) return null;
  const t = 50 + 15 * ((overall - mean) / sd);
  return Math.round(Math.max(1, Math.min(99, t)) * 10) / 10;
}

export function overallScoreStats(): OverallScoreStats | null {
  return SCORE_STATS?.overall ?? null;
}
