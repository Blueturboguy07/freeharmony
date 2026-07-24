import normsData from "./norms.json";

interface NormTable {
  pcts: number[];
  p: number[];
  n: number;
  mean: number;
  sd: number;
}

const METRIC_NORMS: Record<string, NormTable> = (
  normsData as { metrics: Record<string, NormTable> }
).metrics;

export const NORMS_META = (normsData as { meta: { source: string; faces: number } }).meta;

/**
 * Population percentile of a raw metric value, from the calibration corpus
 * (piecewise-linear over the stored percentile table). Returns null when no
 * corpus has been baked in. Deterministic: a static lookup, not a model.
 */
export function percentileOf(key: string, value: number): number | null {
  const t = METRIC_NORMS[key];
  if (!t || t.p.length < 2) return null;
  const { p, pcts } = t;
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
  return null;
}
