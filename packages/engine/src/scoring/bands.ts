import type { Band, BandSet, MetricKey, Sex } from "../types";

/**
 * Ideal bands per metric, per profile.
 *
 * 'faceharmony-parity' — the bands observed in the source app's own UI
 *   (see research UI-SPEC §2.2). Ship default: parity is the product goal.
 * 'literature' — bands from the aesthetics/orthodontic literature digest.
 *   These use DIFFERENT measurement conventions for some metrics (notably
 *   jaw-to-cheekbone) and must never be blended with parity values.
 *
 * Two parity bands are known to sit ~one band-width off the canonical-average
 * face (lipRatio, eyeSeparationRatio) — kept for parity, re-anchor later via
 * the calibrate harness.
 */
export const BANDS: Record<MetricKey, Record<"faceharmony-parity" | "literature", BandSet>> = {
  canthalTilt: {
    "faceharmony-parity": { lo: 1, hi: 7, sLo: 4, sHi: 4 },
    literature: { lo: 2, hi: 6, sLo: 4, sHi: 4 },
  },
  eyeSeparationRatio: {
    "faceharmony-parity": { lo: 0.443, hi: 0.474 },
    literature: { lo: 0.45, hi: 0.48 },
  },
  eyeSymmetry: {
    "faceharmony-parity": { lo: 92, hi: 100, sLo: 9 },
    literature: { lo: 92, hi: 100, sLo: 9 },
  },
  facialThirds: {
    "faceharmony-parity": { lo: 0.9, hi: 1, sLo: 0.1 },
    literature: { lo: 0.9, hi: 1, sLo: 0.1 },
  },
  midLowerThird: {
    "faceharmony-parity": { lo: 0.92, hi: 1.08 },
    literature: { lo: 0.92, hi: 1.08 },
  },
  facialFifths: {
    "faceharmony-parity": { lo: 0.85, hi: 1, sLo: 0.13 },
    literature: { lo: 0.85, hi: 1, sLo: 0.13 },
  },
  midfaceRatio: {
    "faceharmony-parity": { lo: 0.94, hi: 1, sLo: 0.06, sHi: 0.06 },
    literature: { lo: 0.94, hi: 1, sLo: 0.06, sHi: 0.06 },
  },
  fwhr: {
    "faceharmony-parity": {
      masculine: { lo: 1.8, hi: 2.05, sLo: 0.18, sHi: 0.18 },
      feminine: { lo: 1.65, hi: 1.9, sLo: 0.18, sHi: 0.18 },
    },
    literature: {
      masculine: { lo: 1.8, hi: 2.0, sLo: 0.18, sHi: 0.18 },
      feminine: { lo: 1.65, hi: 1.9, sLo: 0.18, sHi: 0.18 },
    },
  },
  jawToCheekbone: {
    "faceharmony-parity": {
      masculine: { lo: 0.855, hi: 0.92 },
      feminine: { lo: 0.8, hi: 0.875 },
    },
    // Literature convention uses a different denominator — genuinely a
    // different quantity. Never blend with the parity band.
    literature: {
      masculine: { lo: 0.7, hi: 0.8 },
      feminine: { lo: 0.68, hi: 0.78 },
    },
  },
  chinToPhiltrum: {
    "faceharmony-parity": { lo: 2.05, hi: 2.55 },
    literature: { lo: 2.0, hi: 2.4 },
  },
  lipRatio: {
    "faceharmony-parity": { lo: 1.5, hi: 1.8, sLo: 0.3, sHi: 0.25 },
    // Preference studies now often favor ~1:1 — the low side is forgiving.
    literature: { lo: 1.0, hi: 1.6, sLo: 0.35, sHi: 0.25 },
  },
  mouthToNoseWidth: {
    "faceharmony-parity": { lo: 1.38, hi: 1.53 },
    literature: { lo: 1.38, hi: 1.53 },
  },
  eyeToMouthAngle: {
    "faceharmony-parity": { lo: 45, hi: 49, sLo: 2, sHi: 2 },
    literature: { lo: 45, hi: 49, sLo: 2, sHi: 2 },
  },
  overallSymmetry: {
    "faceharmony-parity": { lo: 88, hi: 100, sLo: 10 },
    literature: { lo: 88, hi: 100, sLo: 10 },
  },
  jawSymmetry: {
    "faceharmony-parity": { lo: 88, hi: 100, sLo: 10 },
    literature: { lo: 88, hi: 100, sLo: 10 },
  },
  jawAngularity: {
    "faceharmony-parity": {
      masculine: { lo: 122, hi: 145, sLo: 14, sHi: 14 },
      feminine: { lo: 130, hi: 152, sLo: 14, sHi: 14 },
    },
    literature: {
      masculine: { lo: 122, hi: 145, sLo: 14, sHi: 14 },
      feminine: { lo: 130, hi: 152, sLo: 14, sHi: 14 },
    },
  },
  jawlineDefinition: {
    "faceharmony-parity": { lo: 0.62, hi: 1, sLo: 0.28 },
    literature: { lo: 0.62, hi: 1, sLo: 0.28 },
  },
  browPosition: {
    "faceharmony-parity": {
      masculine: { lo: 0.2, hi: 0.28 },
      feminine: { lo: 0.26, hi: 0.36 },
    },
    literature: {
      masculine: { lo: 0.2, hi: 0.28 },
      feminine: { lo: 0.26, hi: 0.36 },
    },
  },
};

/**
 * Resolve a possibly-dimorphic band for the given sex.
 * Neutral = the UNION of both bands, deliberately generous: declining to
 * declare a sex costs the user nothing.
 */
export function resolveBand(bs: BandSet, sex: Sex): Band {
  if (!("masculine" in bs)) return bs;
  if (sex === "masculine") return bs.masculine;
  if (sex === "feminine") return bs.feminine;
  const m = bs.masculine;
  const f = bs.feminine;
  const mHalf = (m.hi - m.lo) / 2;
  const fHalf = (f.hi - f.lo) / 2;
  return {
    lo: Math.min(m.lo, f.lo),
    hi: Math.max(m.hi, f.hi),
    sLo: ((m.sLo ?? mHalf) + (f.sLo ?? fHalf)) / 2,
    sHi: ((m.sHi ?? mHalf) + (f.sHi ?? fHalf)) / 2,
  };
}
