// Landmark index constants for MediaPipe Face Landmarker (468/478-pt topology).
// Naming is ANATOMICAL (subject-relative): R_* is the subject's right side,
// which appears on the IMAGE-LEFT in a non-mirrored photo. Verified against
// the canonical face model: index 33 sits at x = -4.446 (subject right).

/** Exact set of landmarks with x == 0 in the canonical model, superior → inferior. */
export const MIDLINE = [
  10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 11, 12, 13, 14,
  15, 16, 17, 18, 200, 199, 175, 152,
] as const;

/** Top of the mesh — NOT the hairline; see the trichion extrapolation in metrics. */
export const TRICHION_PROXY = 10;
export const GLABELLA = 9;
export const NASION = 168;
export const PRONASALE = 4;
export const SUBNASALE = 2;
export const LABIALE_SUP = 0;
export const STOMION_SUP = 13;
export const STOMION_INF = 14;
export const LABIALE_INF = 17;
export const SUBLABIALE = 18;
export const MENTON = 152;

// Eyes (anatomical)
export const R_CANTHUS_LAT = 33;
export const R_CANTHUS_MED = 133;
export const L_CANTHUS_MED = 362;
export const L_CANTHUS_LAT = 263;
export const R_LID_SUP = 159;
export const R_LID_INF = 145;
export const R_LID_SUP2 = 158;
export const R_LID_INF2 = 153;
export const L_LID_SUP = 386;
export const L_LID_INF = 374;
export const L_LID_SUP2 = 385;
export const L_LID_INF2 = 380;
export const R_IRIS_C = 468;
export const L_IRIS_C = 473;
export const R_IRIS_RING = [469, 470, 471, 472] as const;
export const L_IRIS_RING = [474, 475, 476, 477] as const;

// Widths — each an exact mirror pair in the canonical model.
// Zygion = 116/345 (x = ±6.465, on the cheekbones). Do NOT use 234/454:
// those sit 25mm behind the face plane at the pre-auricular region and
// measure head breadth, not bizygomatic width.
export const R_ZYGION = 116;
export const L_ZYGION = 345;
export const R_TEMPLE = 127;
export const L_TEMPLE = 356;
export const R_GONION = 172;
export const L_GONION = 397;
export const R_RAMUS = 58;
export const L_RAMUS = 288;
export const R_ALARE = 48;
export const L_ALARE = 278;
export const R_CHEILION = 61;
export const L_CHEILION = 291;
export const R_TRAGION = 234;
export const L_TRAGION = 454;

// Brows: chains from FACEMESH_*_EYEBROW, medial → lateral order not required.
export const R_BROW_SUP = [70, 63, 105, 66, 107] as const;
export const L_BROW_SUP = [300, 293, 334, 296, 336] as const;
export const R_BROW_INF = [46, 53, 52, 65, 55] as const;
export const L_BROW_INF = [276, 283, 282, 295, 285] as const;
export const R_BROW_PEAK = 105;
export const L_BROW_PEAK = 334;

export const MANDIBLE_CONTOUR = [
  172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397,
] as const;

export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109,
] as const;

/** [subjectRight, subjectLeft, weight] pairs for the overall symmetry index. */
export const SYM_PAIRS: ReadonlyArray<readonly [number, number, number]> = [
  [468, 473, 1.0],
  [61, 291, 1.0],
  [33, 263, 0.9],
  [133, 362, 0.9],
  [172, 397, 0.9],
  [116, 345, 0.8],
  [48, 278, 0.7],
  [105, 334, 0.6],
  [234, 454, 0.5],
  [127, 356, 0.4],
];

/** Jaw-only symmetry pairs (feeds the symmetry area's jaw component). */
export const JAW_SYM_PAIRS: ReadonlyArray<readonly [number, number, number]> = [
  [172, 397, 1.0],
  [58, 288, 0.8],
  [150, 379, 0.8],
  [136, 365, 0.6],
];

/** Landmark → region map used by the occlusion gate to cap metric confidence. */
export const REGION_SETS: Record<
  "eyes" | "nose" | "mouth" | "jaw" | "brow",
  readonly number[]
> = {
  eyes: [33, 133, 362, 263, 159, 145, 386, 374, 158, 153, 385, 380, 7, 163, 144, 154, 155, 173, 157, 160, 161, 246, 249, 390, 373, 381, 382, 384, 387, 388, 398, 466],
  nose: [4, 1, 2, 5, 6, 195, 197, 168, 48, 278, 98, 327, 94, 19],
  mouth: [0, 13, 14, 17, 61, 291, 78, 308, 37, 267, 84, 314, 87, 317, 82, 312],
  jaw: [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 58, 288, 18, 200, 199, 175],
  brow: [70, 63, 105, 66, 107, 300, 293, 334, 296, 336, 46, 53, 52, 65, 55, 276, 283, 282, 295, 285],
};
