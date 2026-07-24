import type {
  AreaKey,
  GateReport,
  MetricResult,
  ScanInput,
  ScanResult,
} from "./types.js";
import { buildFrame } from "./normalize.js";
import { runGates } from "./gates/index.js";
import { METRICS } from "./metrics/registry.js";
import { resolveBand } from "./scoring/bands.js";
import { round1, subScore, verdictOf } from "./scoring/curve.js";
import { aggregate } from "./scoring/aggregate.js";

export const ENGINE_VERSION = "0.1.0";

const EMPTY_AREAS: Record<AreaKey, { score: null; confidence: number }> = {
  symmetry: { score: null, confidence: 0 },
  eyeArea: { score: null, confidence: 0 },
  midface: { score: null, confidence: 0 },
  jawline: { score: null, confidence: 0 },
};

/**
 * The engine's single entry point. Deterministic: identical input produces a
 * byte-identical result. No DOM, no I/O, no randomness, no clock.
 */
export function analyze(input: ScanInput): ScanResult {
  const sex = input.sex ?? "neutral";
  const bandProfile = input.bandProfile ?? "faceharmony-parity";

  if (input.landmarks.length !== 468 && input.landmarks.length !== 478) {
    const gates: GateReport = {
      pass: false,
      blocking: [
        {
          code: "no-face",
          severity: "block",
          message: "No face detected.",
          retake: "Center your face in the frame with good lighting.",
        },
      ],
      warnings: [],
      confidenceMultiplier: 1,
      regionConfidence: {},
      jawEdgeSupport: null,
    };
    return {
      ok: false,
      gates,
      frame: null,
      metrics: [],
      areas: { ...EMPTY_AREAS },
      overall: null,
      tier: null,
      engineVersion: ENGINE_VERSION,
      bandProfile,
      sex,
    };
  }

  const { frame } = buildFrame(input);
  const gates = runGates(input, frame);

  if (!gates.pass) {
    return {
      ok: false,
      gates,
      frame,
      metrics: [],
      areas: { ...EMPTY_AREAS },
      overall: null,
      tier: null,
      engineVersion: ENGINE_VERSION,
      bandProfile,
      sex,
    };
  }

  const ctx = {
    image: input.image ?? null,
    gates,
    sex,
    hasIris: frame.hasIris,
  };

  const pitchUnknown = frame.pitchDeg === null;
  const metrics: MetricResult[] = [];
  const weights: Record<string, { area: AreaKey; weight: number }> = {};

  for (const def of METRICS) {
    const computed = def.compute(frame, ctx);
    if (computed === null) continue;
    let confidence = computed.confidence * gates.confidenceMultiplier;
    const regionCap = gates.regionConfidence[def.region];
    if (regionCap !== undefined) confidence = Math.min(confidence, regionCap);
    if (def.vertical && pitchUnknown) confidence = Math.min(confidence, 0.55);
    confidence = Math.max(0, Math.min(1, confidence));

    const band = resolveBand(def.bands[bandProfile], sex);
    const score = round1(subScore(computed.value, band));
    metrics.push({
      key: def.key,
      label: def.label,
      value: computed.value,
      unit: def.unit,
      band,
      score,
      verdict: verdictOf(score),
      confidence,
      flags: computed.flags ?? [],
      detail: computed.detail,
    });
    weights[def.key] = { area: def.area, weight: def.weight };
  }

  const agg = aggregate(metrics, weights);
  const refused = agg.overall === null;

  return {
    ok: !refused,
    gates: refused
      ? {
          ...gates,
          pass: false,
          blocking: [
            ...gates.blocking,
            {
              code: "insufficient-data",
              severity: "block",
              message: "Too much of the face couldn't be measured reliably.",
              retake: "Retake with even lighting, no occlusions, facing straight on.",
            },
          ],
        }
      : gates,
    frame,
    metrics,
    areas: agg.areas,
    overall: agg.overall,
    tier: agg.tier,
    engineVersion: ENGINE_VERSION,
    bandProfile,
    sex,
  };
}

// Public surface
export * from "./types.js";
export { buildFrame } from "./normalize.js";
export { runGates, eyeAspectRatio } from "./gates/index.js";
export { METRICS, TRICHION_K, computeJawEdgeSupport } from "./metrics/registry.js";
export { BANDS, resolveBand } from "./scoring/bands.js";
export { subScore, verdictOf, round1 } from "./scoring/curve.js";
export { AREA_WEIGHTS, AREA_LABELS, aggregate, tierOf } from "./scoring/aggregate.js";
export * as LANDMARKS from "./landmarks/indices.js";
export { CANONICAL_VERTS } from "./landmarks/canonical.js";
export { regionalResiduals } from "./procrustes.js";
export {
  estimatePose,
  eulerFromMatrix,
  isColumnMajor,
  yawAsymmetry,
  YAW_PROXY_TO_DEG,
} from "./pose.js";
