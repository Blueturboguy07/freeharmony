import type {
  AreaKey,
  AreaResult,
  MetricResult,
  Tier,
} from "../types.js";
import { round1 } from "./curve.js";

/** Area weights. Symmetry is lowest: it is the most photo-artifact-prone. */
export const AREA_WEIGHTS: Record<AreaKey, number> = {
  symmetry: 0.18,
  eyeArea: 0.28,
  midface: 0.27,
  jawline: 0.27,
};

export const AREA_LABELS: Record<AreaKey, string> = {
  symmetry: "Symmetry",
  eyeArea: "Eye Area",
  midface: "Midface",
  jawline: "Jawline",
};

const MIN_AREA_CONFIDENCE = 0.5;

export interface Aggregated {
  areas: Record<AreaKey, AreaResult>;
  overall: number | null;
  tier: Tier | null;
}

export function tierOf(overall: number): Tier {
  if (overall >= 85) return "excellent";
  if (overall >= 70) return "good";
  if (overall >= 55) return "fair";
  return "needs-work";
}

/**
 * Confidence-weighted rollup: metric → area → overall.
 * Area with confidence < 0.5 goes null ("insufficient data"); if two or more
 * areas are null the caller should refuse the scan entirely.
 */
export function aggregate(
  metrics: MetricResult[],
  weights: Record<string, { area: AreaKey; weight: number }>,
): Aggregated {
  const areas = {} as Record<AreaKey, AreaResult>;
  for (const area of Object.keys(AREA_WEIGHTS) as AreaKey[]) {
    let effSum = 0;
    let scoreSum = 0;
    let weightSum = 0;
    for (const m of metrics) {
      const w = weights[m.key];
      if (!w || w.area !== area) continue;
      const eff = w.weight * m.confidence;
      effSum += eff;
      scoreSum += eff * m.score;
      weightSum += w.weight;
    }
    if (weightSum === 0) {
      areas[area] = { score: null, confidence: 0 };
      continue;
    }
    const conf = effSum / weightSum;
    areas[area] =
      conf < MIN_AREA_CONFIDENCE
        ? { score: null, confidence: conf }
        : { score: Math.round(scoreSum / effSum), confidence: conf };
  }

  const nullCount = (Object.values(areas) as AreaResult[]).filter(
    (a) => a.score === null,
  ).length;
  if (nullCount >= 2) {
    return { areas, overall: null, tier: null };
  }

  let num = 0;
  let den = 0;
  for (const area of Object.keys(areas) as AreaKey[]) {
    const a = areas[area];
    if (a.score === null) continue;
    const w = AREA_WEIGHTS[area] * a.confidence;
    num += w * a.score;
    den += w;
  }
  if (den === 0) return { areas, overall: null, tier: null };
  const overall = round1(num / den);
  return { areas, overall, tier: tierOf(overall) };
}
