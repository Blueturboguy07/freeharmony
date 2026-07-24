// Side-profile analysis. MediaPipe's face mesh is trained on frontal faces
// and returns nothing usable at a true 90° profile, so this module takes a
// different path entirely: eight anchor points on the profile silhouette
// (auto-suggested, user-adjustable) and pure 2D geometry over them. Same
// determinism contract as the frontal engine: same anchors in, same numbers out.

import type { Band, Sex, Verdict } from "./types";
import { round1, subScore, verdictOf } from "./scoring/curve";

/** Normalized [0,1] coordinates on the side photo, y-down (image space). */
export interface ProfileAnchor {
  x: number;
  y: number;
}

export type ProfileAnchorKey =
  | "glabella"
  | "nasion"
  | "pronasale"
  | "subnasale"
  | "labialeSup"
  | "labialeInf"
  | "pogonion"
  | "menton";

export const PROFILE_ANCHOR_ORDER: ProfileAnchorKey[] = [
  "glabella",
  "nasion",
  "pronasale",
  "subnasale",
  "labialeSup",
  "labialeInf",
  "pogonion",
  "menton",
];

export const PROFILE_ANCHOR_LABELS: Record<ProfileAnchorKey, { label: string; hint: string }> = {
  glabella: { label: "Brow", hint: "the most forward point of the forehead between the brows" },
  nasion: { label: "Nose bridge", hint: "the deepest dip where the nose meets the forehead" },
  pronasale: { label: "Nose tip", hint: "the most forward point of the nose" },
  subnasale: { label: "Under nose", hint: "where the nose base meets the upper lip" },
  labialeSup: { label: "Upper lip", hint: "the most forward point of the upper lip" },
  labialeInf: { label: "Lower lip", hint: "the most forward point of the lower lip" },
  pogonion: { label: "Chin front", hint: "the most forward point of the chin" },
  menton: { label: "Chin bottom", hint: "the lowest point of the chin" },
};

export type ProfileAnchors = Record<ProfileAnchorKey, ProfileAnchor>;

export type ProfileMetricKey =
  | "nasofrontalAngle"
  | "nasolabialAngle"
  | "facialConvexity"
  | "eLineUpper"
  | "eLineLower";

export interface ProfileMetricResult {
  key: ProfileMetricKey;
  label: string;
  value: number;
  unit: "deg" | "ratio";
  band: Band;
  score: number;
  verdict: Verdict;
  /** Plain-language read of the value. */
  meaning: string;
}

// Reference bands from cephalometric/aesthetic conventions; CALIBRATE against
// a real corpus like the frontal bands.
const NASOFRONTAL: Band = { lo: 115, hi: 135, sLo: 10, sHi: 10 };
const NASOLABIAL_M: Band = { lo: 90, hi: 95, sLo: 9, sHi: 9 };
const NASOLABIAL_F: Band = { lo: 95, hi: 105, sLo: 9, sHi: 9 };
const CONVEXITY: Band = { lo: 165, hi: 175, sLo: 7, sHi: 7 };
/** E-line distances as fraction of pronasale→pogonion length; negative = behind the line. */
const ELINE_UPPER: Band = { lo: -0.1, hi: 0.0, sLo: 0.06, sHi: 0.05 };
const ELINE_LOWER: Band = { lo: -0.06, hi: 0.02, sLo: 0.06, sHi: 0.05 };

function angleAtDeg(v: ProfileAnchor, a: ProfileAnchor, b: ProfileAnchor): number {
  const ax = a.x - v.x;
  const ay = a.y - v.y;
  const bx = b.x - v.x;
  const by = b.y - v.y;
  const na = Math.sqrt(ax * ax + ay * ay);
  const nb = Math.sqrt(bx * bx + by * by);
  if (na === 0 || nb === 0) return 0;
  let c = (ax * bx + ay * by) / (na * nb);
  if (c > 1) c = 1;
  if (c < -1) c = -1;
  return (Math.acos(c) * 180) / Math.PI;
}

/**
 * Signed distance of `p` from the line a→b, normalized by |a→b|.
 * Positive = on the facing side (in front of the E-line), negative = behind.
 */
function signedLineDistance(
  p: ProfileAnchor,
  a: ProfileAnchor,
  b: ProfileAnchor,
  facing: 1 | -1,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return 0;
  // 2D cross product picks the side; in image coords (y-down) a point BEHIND
  // the nose→chin line of a right-facing profile yields a POSITIVE cross, so
  // negate to get the "positive = in front" convention. Verified by the
  // mirror-invariance and behind-line tests.
  const cross = dx * (p.y - a.y) - dy * (p.x - a.x);
  return (-facing * cross) / (len * len);
}

/** Which way the profile faces: +1 if the nose points toward +x (image right). */
export function profileFacing(anchors: ProfileAnchors): 1 | -1 {
  const backline = (anchors.glabella.x + anchors.menton.x) / 2;
  return anchors.pronasale.x >= backline ? 1 : -1;
}

/**
 * Sensible starting anchor layout so the user drags points a short distance
 * instead of placing them from scratch. Assumes a right-facing profile
 * roughly centered in the frame.
 */
export function defaultProfileAnchors(): ProfileAnchors {
  return {
    glabella: { x: 0.62, y: 0.3 },
    nasion: { x: 0.6, y: 0.38 },
    pronasale: { x: 0.72, y: 0.48 },
    subnasale: { x: 0.63, y: 0.53 },
    labialeSup: { x: 0.64, y: 0.58 },
    labialeInf: { x: 0.63, y: 0.63 },
    pogonion: { x: 0.6, y: 0.72 },
    menton: { x: 0.55, y: 0.78 },
  };
}

export function analyzeProfile(anchors: ProfileAnchors, sex: Sex): ProfileMetricResult[] {
  const facing = profileFacing(anchors);
  const a = anchors;

  const nasofrontal = angleAtDeg(a.nasion, a.glabella, a.pronasale);
  const nasolabial = angleAtDeg(a.subnasale, a.pronasale, a.labialeSup);
  const convexity = angleAtDeg(a.subnasale, a.glabella, a.pogonion);
  const eUpper = signedLineDistance(a.labialeSup, a.pronasale, a.pogonion, facing);
  const eLower = signedLineDistance(a.labialeInf, a.pronasale, a.pogonion, facing);

  const nasolabialBand: Band =
    sex === "masculine"
      ? NASOLABIAL_M
      : sex === "feminine"
        ? NASOLABIAL_F
        : {
            lo: Math.min(NASOLABIAL_M.lo, NASOLABIAL_F.lo),
            hi: Math.max(NASOLABIAL_M.hi, NASOLABIAL_F.hi),
            sLo: 9,
            sHi: 9,
          };

  const rows: Array<{
    key: ProfileMetricKey;
    label: string;
    value: number;
    unit: "deg" | "ratio";
    band: Band;
    meaning: (v: number, b: Band) => string;
  }> = [
    {
      key: "nasofrontalAngle",
      label: "Nasofrontal angle",
      value: nasofrontal,
      unit: "deg",
      band: NASOFRONTAL,
      meaning: (v, b) =>
        v < b.lo
          ? "a deep-set nose bridge transition"
          : v > b.hi
            ? "a shallow forehead-to-nose transition"
            : "a well-defined forehead-to-nose transition",
    },
    {
      key: "nasolabialAngle",
      label: "Nasolabial angle",
      value: nasolabial,
      unit: "deg",
      band: nasolabialBand,
      meaning: (v, b) =>
        v < b.lo
          ? "the nose tip angles slightly downward"
          : v > b.hi
            ? "the nose tip angles slightly upward"
            : "the nose-to-lip angle sits in the balanced range",
    },
    {
      key: "facialConvexity",
      label: "Facial convexity",
      value: convexity,
      unit: "deg",
      band: CONVEXITY,
      meaning: (v, b) =>
        v < b.lo
          ? "a more convex profile — the lower face sits back relative to the forehead"
          : v > b.hi
            ? "a flatter-to-concave profile with a forward lower face"
            : "a straight, balanced profile line",
    },
    {
      key: "eLineUpper",
      label: "E-line · upper lip",
      value: eUpper,
      unit: "ratio",
      band: ELINE_UPPER,
      meaning: (v, b) =>
        v > b.hi
          ? "the upper lip sits ahead of the nose-chin line"
          : v < b.lo
            ? "the upper lip sits well behind the nose-chin line"
            : "the upper lip sits classically just behind the nose-chin line",
    },
    {
      key: "eLineLower",
      label: "E-line · lower lip",
      value: eLower,
      unit: "ratio",
      band: ELINE_LOWER,
      meaning: (v, b) =>
        v > b.hi
          ? "the lower lip sits ahead of the nose-chin line"
          : v < b.lo
            ? "the lower lip sits well behind the nose-chin line"
            : "the lower lip sits classically near the nose-chin line",
    },
  ];

  return rows.map((r) => {
    const score = round1(subScore(r.value, r.band));
    return {
      key: r.key,
      label: r.label,
      value: r.value,
      unit: r.unit,
      band: r.band,
      score,
      verdict: verdictOf(score),
      meaning: r.meaning(r.value, r.band),
    };
  });
}
