import type {
  Frame,
  MetricContext,
  MetricComputation,
  MetricDef,
} from "../types.js";
import {
  angleAt,
  chainYAtX,
  distPts,
  dx,
  dy,
  mid,
  pt,
  pupils,
} from "../landmarks/accessors.js";
import {
  GLABELLA,
  JAW_SYM_PAIRS,
  LABIALE_INF,
  LABIALE_SUP,
  L_ALARE,
  L_BROW_INF,
  L_CANTHUS_LAT,
  L_CANTHUS_MED,
  L_CHEILION,
  L_GONION,
  L_LID_INF,
  L_LID_INF2,
  L_LID_SUP,
  L_LID_SUP2,
  L_RAMUS,
  L_TEMPLE,
  L_ZYGION,
  MANDIBLE_CONTOUR,
  MENTON,
  MIDLINE,
  R_ALARE,
  R_BROW_INF,
  R_CANTHUS_LAT,
  R_CANTHUS_MED,
  R_CHEILION,
  R_GONION,
  R_LID_INF,
  R_LID_INF2,
  R_LID_SUP,
  R_LID_SUP2,
  R_RAMUS,
  R_TEMPLE,
  R_ZYGION,
  STOMION_INF,
  STOMION_SUP,
  SUBLABIALE,
  SUBNASALE,
  SYM_PAIRS,
  TRICHION_PROXY,
} from "../landmarks/indices.js";
import { fitLinePCA } from "../math/fit.js";
import { BANDS } from "../scoring/bands.js";
import { subScore } from "../scoring/curve.js";
import { resolveBand } from "../scoring/bands.js";
import { median, sobelMagAt, sobelP90, toGray } from "../image/ops.js";

const RAD2DEG = 180 / Math.PI;

/** Trichion extrapolation factor: T = glabella + k·(pt10 − glabella). */
export const TRICHION_K = 1.8;

function ok(value: number, confidence = 1, detail?: Record<string, number | number[]>): MetricComputation {
  return { value, confidence, detail };
}

// ---- individual computations -------------------------------------------------

function canthalTilt(f: Frame): MetricComputation {
  const tiltR =
    Math.atan2(dy(f, R_CANTHUS_LAT, R_CANTHUS_MED), dx(f, R_CANTHUS_LAT, R_CANTHUS_MED)) *
    RAD2DEG;
  const tiltL =
    Math.atan2(dy(f, L_CANTHUS_LAT, L_CANTHUS_MED), dx(f, L_CANTHUS_LAT, L_CANTHUS_MED)) *
    RAD2DEG;
  return ok((tiltR + tiltL) / 2, 1, { tiltR, tiltL });
}

function eyeSeparationRatio(f: Frame): MetricComputation {
  const { right, left } = pupils(f);
  return ok(distPts(right, left) / dx(f, R_ZYGION, L_ZYGION));
}

function eyeSymmetry(f: Frame): MetricComputation {
  const wR = dx(f, R_CANTHUS_LAT, R_CANTHUS_MED);
  const wL = dx(f, L_CANTHUS_MED, L_CANTHUS_LAT);
  const fissure = Math.min(wR, wL) / Math.max(wR, wL);

  const hR = dy(f, R_LID_SUP, R_LID_INF);
  const hL = dy(f, L_LID_SUP, L_LID_INF);
  const lid = Math.min(hR, hL) / Math.max(hR, hL);

  const tR =
    Math.atan2(dy(f, R_CANTHUS_LAT, R_CANTHUS_MED), wR) * RAD2DEG;
  const tL =
    Math.atan2(dy(f, L_CANTHUS_LAT, L_CANTHUS_MED), wL) * RAD2DEG;
  const tilt = clamp01(1 - Math.abs(tL - tR) / 12);

  const { right, left } = pupils(f);
  const level = clamp01(1 - Math.abs(left.y - right.y) / (0.06 * f.scale));

  return ok(((fissure + lid + tilt + level) / 4) * 100);
}

function facialThirds(f: Frame): MetricComputation {
  const yG = pt(f, GLABELLA).y;
  const yT = yG + TRICHION_K * (pt(f, TRICHION_PROXY).y - yG);
  const u = yT - yG;
  const m = yG - pt(f, SUBNASALE).y;
  const l = pt(f, SUBNASALE).y - pt(f, MENTON).y;
  const total = u + m + l;
  const fr = [u / total, m / total, l / total];
  let maxDev = 0;
  for (const x of fr) maxDev = Math.max(maxDev, Math.abs(x - 1 / 3));
  // Trichion is estimated, not observed — confidence is capped.
  return {
    value: 1 - 3 * maxDev,
    confidence: 0.6,
    flags: ["estimated-trichion"],
    detail: { thirdsPct: fr.map((x) => x * 100) },
  };
}

function midLowerThird(f: Frame): MetricComputation {
  const m = pt(f, GLABELLA).y - pt(f, SUBNASALE).y;
  const l = pt(f, SUBNASALE).y - pt(f, MENTON).y;
  return ok(m / l);
}

function facialFifths(f: Frame): MetricComputation {
  const cols = [
    dx(f, R_TEMPLE, R_CANTHUS_LAT),
    dx(f, R_CANTHUS_LAT, R_CANTHUS_MED),
    dx(f, R_CANTHUS_MED, L_CANTHUS_MED),
    dx(f, L_CANTHUS_MED, L_CANTHUS_LAT),
    dx(f, L_CANTHUS_LAT, L_TEMPLE),
  ];
  const total = dx(f, R_TEMPLE, L_TEMPLE);
  const fr = cols.map((c) => c / total);
  let maxDev = 0;
  for (const x of fr) maxDev = Math.max(maxDev, Math.abs(x - 0.2));
  return {
    value: 1 - 5 * maxDev,
    confidence: 1,
    detail: { fifthsPct: fr.map((x) => x * 100) },
  };
}

function midfaceRatio(f: Frame): MetricComputation {
  const { right, left } = pupils(f);
  const pupilY = (right.y + left.y) / 2;
  return ok(Math.abs(pupilY - pt(f, LABIALE_SUP).y) / f.scale);
}

function fwhr(f: Frame): MetricComputation {
  const lidTop = Math.max(pt(f, R_LID_SUP).y, pt(f, L_LID_SUP).y);
  const height = lidTop - pt(f, LABIALE_SUP).y;
  return ok(dx(f, R_ZYGION, L_ZYGION) / height);
}

function jawToCheekbone(f: Frame): MetricComputation {
  return ok(dx(f, R_GONION, L_GONION) / dx(f, R_ZYGION, L_ZYGION));
}

function chinToPhiltrum(f: Frame): MetricComputation {
  const chin = dy(f, SUBLABIALE, MENTON);
  const philtrum = dy(f, SUBNASALE, LABIALE_SUP);
  return ok(chin / philtrum);
}

function lipRatio(f: Frame): MetricComputation {
  const lower = dy(f, STOMION_INF, LABIALE_INF);
  const upper = dy(f, LABIALE_SUP, STOMION_SUP);
  return ok(lower / upper);
}

function mouthToNoseWidth(f: Frame): MetricComputation {
  return ok(dx(f, R_CHEILION, L_CHEILION) / dx(f, R_ALARE, L_ALARE));
}

function eyeToMouthAngle(f: Frame): MetricComputation {
  const { right, left } = pupils(f);
  const pupilY = (right.y + left.y) / 2;
  const stomion = mid(f, STOMION_SUP, STOMION_INF);
  const height = pupilY - stomion.y;
  const value = 2 * Math.atan(f.scale / 2 / height) * RAD2DEG;
  return ok(value);
}

/** Resolve iris-center indices to canthus midpoints on the 468-pt model. */
function symPt(f: Frame, i: number) {
  if (!f.hasIris) {
    if (i === 468) return mid(f, 33, 133);
    if (i === 473) return mid(f, 362, 263);
  }
  return pt(f, i);
}

function pairSymmetryScore(
  f: Frame,
  pairs: ReadonlyArray<readonly [number, number, number]>,
): number {
  // Total-least-squares midline through the midline landmark chain.
  const xs: number[] = [];
  const ys: number[] = [];
  for (const i of MIDLINE) {
    const p = pt(f, i);
    xs.push(p.x);
    ys.push(p.y);
  }
  const line = fitLinePCA(xs, ys);
  let num = 0;
  let den = 0;
  for (const [a, b, w] of pairs) {
    const pa = symPt(f, a);
    const pb = symPt(f, b);
    const da = Math.abs((pa.x - line.cx) * line.nx + (pa.y - line.cy) * line.ny);
    const db = Math.abs((pb.x - line.cx) * line.nx + (pb.y - line.cy) * line.ny);
    const hz = Math.max(da, db) > 1e-9 ? Math.min(da, db) / Math.max(da, db) : 1;
    const vz = clamp01(1 - Math.abs(pa.y - pb.y) / (0.08 * f.scale));
    num += w * (0.65 * hz + 0.35 * vz);
    den += w;
  }
  return (num / den) * 100;
}

function overallSymmetry(f: Frame): MetricComputation {
  return ok(pairSymmetryScore(f, SYM_PAIRS));
}

function jawSymmetry(f: Frame): MetricComputation {
  return ok(pairSymmetryScore(f, JAW_SYM_PAIRS));
}

function jawAngularityValue(f: Frame): number {
  const right = angleAt(f, R_GONION, R_RAMUS, MENTON);
  const left = angleAt(f, L_GONION, L_RAMUS, MENTON);
  return (right + left) / 2;
}

function jawAngularity(f: Frame): MetricComputation {
  return ok(jawAngularityValue(f));
}

function jawlineDefinition(f: Frame, ctx: MetricContext): MetricComputation {
  // Angularity component: this metric's own sub-score under the active band.
  const angVal = jawAngularityValue(f);
  const angBand = resolveBand(BANDS.jawAngularity["faceharmony-parity"], ctx.sex);
  const angScore = subScore(angVal, angBand) / 100;

  const edge = ctx.gates.jawEdgeSupport;
  if (edge === null) {
    return { value: angScore, confidence: 0.5, flags: ["no-image"] };
  }
  return ok(0.55 * angScore + 0.45 * edge);
}

function browPosition(f: Frame): MetricComputation {
  const { right, left } = pupils(f);
  const browR = chainYAtX(f, R_BROW_INF, right.x);
  const browL = chainYAtX(f, L_BROW_INF, left.x);
  const hR = (browR - pt(f, R_LID_SUP).y) / f.scale;
  const hL = (browL - pt(f, L_LID_SUP).y) / f.scale;
  return ok((hR + hL) / 2);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Jaw edge-support: deterministic pixel evidence that the mandibular border
 * exists in the image. Sampled along the mandible polyline; each sample takes
 * the stronger Sobel response at ±4·S/100 px along the outward normal,
 * normalized by the face ROI's p90 gradient. Exposed here for the gate layer.
 */
export function computeJawEdgeSupport(
  f: Frame,
  imageGray: ReturnType<typeof toGray>,
): number {
  // Note: frame pts are roll-corrected while the image is not. Rotate the
  // sample positions back by +roll about the pupil midpoint to land on pixels.
  const theta = (f.rollDeg * Math.PI) / 180;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const { right, left } = pupils(f);
  const cx = (right.x + left.x) / 2;
  const cy = (right.y + left.y) / 2;
  const toImage = (x: number, y: number): [number, number] => {
    const ux = x - cx;
    const uy = y - cy;
    const rx = cx + ux * c - uy * s;
    const ry = cy + ux * s + uy * c;
    return [rx, f.imageHeight - ry]; // back to y-down image space
  };

  // Face centroid for outward-normal orientation.
  let fcx = 0;
  let fcy = 0;
  for (const i of MIDLINE) {
    const p = pt(f, i);
    fcx += p.x;
    fcy += p.y;
  }
  fcx /= MIDLINE.length;
  fcy /= MIDLINE.length;

  const contour = MANDIBLE_CONTOUR.map((i) => pt(f, i));
  const p90 = Math.max(sobelP90(imageGray), 1e-6);
  const offset = (4 * f.scale) / 100;
  const samples: number[] = [];
  const N = 24;
  // Arc-length parameterization of the polyline.
  const segLens: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < contour.length - 1; i++) {
    const l = distPts(contour[i]!, contour[i + 1]!);
    segLens.push(l);
    totalLen += l;
  }
  for (let k = 0; k < N; k++) {
    const target = (totalLen * (k + 0.5)) / N;
    let acc = 0;
    let seg = 0;
    while (seg < segLens.length - 1 && acc + segLens[seg]! < target) {
      acc += segLens[seg]!;
      seg++;
    }
    const a = contour[seg]!;
    const b = contour[seg + 1]!;
    const t = segLens[seg]! > 1e-9 ? (target - acc) / segLens[seg]! : 0;
    const px = a.x + t * (b.x - a.x);
    const py = a.y + t * (b.y - a.y);
    // Tangent → normal, oriented away from the face centroid.
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const tl = Math.sqrt(tx * tx + ty * ty) || 1;
    let nx = -ty / tl;
    let ny = tx / tl;
    if ((px - fcx) * nx + (py - fcy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const [x1, y1] = toImage(px + nx * offset, py + ny * offset);
    const [x2, y2] = toImage(px - nx * offset, py - ny * offset);
    const m = Math.max(sobelMagAt(imageGray, x1, y1), sobelMagAt(imageGray, x2, y2));
    samples.push(clamp01(m / p90));
  }
  return median(samples);
}

// ---- registry ----------------------------------------------------------------

export const METRICS: MetricDef[] = [
  {
    key: "canthalTilt",
    label: "Canthal tilt",
    unit: "deg",
    area: "eyeArea",
    weight: 0.35,
    dimorphic: false,
    bands: BANDS.canthalTilt,
    region: "eyes",
    overlay: {
      points: [R_CANTHUS_LAT, R_CANTHUS_MED, L_CANTHUS_MED, L_CANTHUS_LAT],
      polylines: [
        [R_CANTHUS_LAT, R_CANTHUS_MED],
        [L_CANTHUS_MED, L_CANTHUS_LAT],
      ],
    },
    compute: (f) => canthalTilt(f),
  },
  {
    key: "eyeSeparationRatio",
    label: "Eye separation ratio",
    unit: "ratio",
    area: "eyeArea",
    weight: 0.25,
    dimorphic: false,
    bands: BANDS.eyeSeparationRatio,
    region: "eyes",
    overlay: {
      points: [468, 473, R_ZYGION, L_ZYGION],
      polylines: [[468, 473]],
      guides: [{ kind: "polyline", points: [R_ZYGION, L_ZYGION] }],
    },
    compute: (f) => eyeSeparationRatio(f),
  },
  {
    key: "eyeSymmetry",
    label: "Eye symmetry",
    unit: "index",
    area: "symmetry",
    weight: 0.2,
    dimorphic: false,
    bands: BANDS.eyeSymmetry,
    region: "eyes",
    overlay: {
      points: [R_CANTHUS_LAT, R_CANTHUS_MED, L_CANTHUS_MED, L_CANTHUS_LAT, R_LID_SUP, R_LID_INF, L_LID_SUP, L_LID_INF],
      polylines: [],
    },
    compute: (f) => eyeSymmetry(f),
  },
  {
    key: "facialThirds",
    label: "Facial thirds",
    unit: "index",
    area: "midface",
    weight: 0.06,
    dimorphic: false,
    bands: BANDS.facialThirds,
    region: "nose",
    vertical: true,
    overlay: {
      points: [TRICHION_PROXY, GLABELLA, SUBNASALE, MENTON],
      polylines: [],
      guides: [
        { kind: "hline", points: [GLABELLA] },
        { kind: "hline", points: [SUBNASALE] },
        { kind: "hline", points: [MENTON] },
      ],
    },
    compute: (f) => facialThirds(f),
  },
  {
    key: "midLowerThird",
    label: "Mid-to-lower third ratio",
    unit: "ratio",
    area: "midface",
    weight: 0.14,
    dimorphic: false,
    bands: BANDS.midLowerThird,
    region: "nose",
    vertical: true,
    overlay: {
      points: [GLABELLA, SUBNASALE, MENTON],
      polylines: [
        [GLABELLA, SUBNASALE],
        [SUBNASALE, MENTON],
      ],
    },
    compute: (f) => midLowerThird(f),
  },
  {
    key: "facialFifths",
    label: "Facial fifths",
    unit: "index",
    area: "eyeArea",
    weight: 0.15,
    dimorphic: false,
    bands: BANDS.facialFifths,
    region: "eyes",
    overlay: {
      points: [R_TEMPLE, R_CANTHUS_LAT, R_CANTHUS_MED, L_CANTHUS_MED, L_CANTHUS_LAT, L_TEMPLE],
      polylines: [],
      guides: [
        { kind: "vline", points: [R_TEMPLE] },
        { kind: "vline", points: [R_CANTHUS_LAT] },
        { kind: "vline", points: [R_CANTHUS_MED] },
        { kind: "vline", points: [L_CANTHUS_MED] },
        { kind: "vline", points: [L_CANTHUS_LAT] },
        { kind: "vline", points: [L_TEMPLE] },
      ],
    },
    compute: (f) => facialFifths(f),
  },
  {
    key: "midfaceRatio",
    label: "Midface ratio",
    unit: "ratio",
    area: "midface",
    weight: 0.3,
    dimorphic: false,
    bands: BANDS.midfaceRatio,
    region: "nose",
    vertical: true,
    overlay: {
      points: [468, 473, LABIALE_SUP],
      polylines: [[468, 473]],
    },
    compute: (f) => midfaceRatio(f),
  },
  {
    key: "fwhr",
    label: "Width-to-height ratio",
    unit: "ratio",
    area: "midface",
    weight: 0.22,
    dimorphic: true,
    bands: BANDS.fwhr,
    region: "nose",
    vertical: true,
    overlay: {
      points: [R_ZYGION, L_ZYGION, R_LID_SUP, LABIALE_SUP],
      polylines: [[R_ZYGION, L_ZYGION]],
    },
    compute: (f) => fwhr(f),
  },
  {
    key: "jawToCheekbone",
    label: "Jaw-to-cheekbone width",
    unit: "ratio",
    area: "jawline",
    weight: 0.35,
    dimorphic: true,
    bands: BANDS.jawToCheekbone,
    region: "jaw",
    overlay: {
      points: [R_GONION, L_GONION, R_ZYGION, L_ZYGION],
      polylines: [
        [R_GONION, L_GONION],
        [R_ZYGION, L_ZYGION],
      ],
    },
    compute: (f) => jawToCheekbone(f),
  },
  {
    key: "chinToPhiltrum",
    label: "Chin-to-philtrum ratio",
    unit: "ratio",
    area: "jawline",
    weight: 0.25,
    dimorphic: false,
    bands: BANDS.chinToPhiltrum,
    region: "mouth",
    vertical: true,
    overlay: {
      points: [SUBNASALE, LABIALE_SUP, SUBLABIALE, MENTON],
      polylines: [
        [SUBNASALE, LABIALE_SUP],
        [SUBLABIALE, MENTON],
      ],
    },
    compute: (f) => chinToPhiltrum(f),
  },
  {
    key: "lipRatio",
    label: "Lip ratio",
    unit: "ratio",
    area: "midface",
    weight: 0.12,
    dimorphic: false,
    bands: BANDS.lipRatio,
    region: "mouth",
    vertical: true,
    overlay: {
      points: [LABIALE_SUP, STOMION_SUP, STOMION_INF, LABIALE_INF],
      polylines: [[LABIALE_SUP, STOMION_SUP, STOMION_INF, LABIALE_INF]],
    },
    compute: (f) => lipRatio(f),
  },
  {
    key: "mouthToNoseWidth",
    label: "Mouth-to-nose width",
    unit: "ratio",
    area: "midface",
    weight: 0.16,
    dimorphic: false,
    bands: BANDS.mouthToNoseWidth,
    region: "mouth",
    overlay: {
      points: [R_CHEILION, L_CHEILION, R_ALARE, L_ALARE],
      polylines: [
        [R_CHEILION, L_CHEILION],
        [R_ALARE, L_ALARE],
      ],
    },
    compute: (f) => mouthToNoseWidth(f),
  },
  {
    key: "eyeToMouthAngle",
    label: "Eye-to-mouth angle",
    unit: "deg",
    area: "eyeArea",
    weight: 0.15,
    dimorphic: false,
    bands: BANDS.eyeToMouthAngle,
    region: "mouth",
    vertical: true,
    overlay: {
      points: [468, 473, STOMION_SUP],
      polylines: [
        [468, STOMION_SUP],
        [473, STOMION_SUP],
      ],
    },
    compute: (f) => eyeToMouthAngle(f),
  },
  {
    key: "overallSymmetry",
    label: "Overall symmetry",
    unit: "index",
    area: "symmetry",
    weight: 0.65,
    dimorphic: false,
    bands: BANDS.overallSymmetry,
    region: "nose",
    overlay: {
      points: SYM_PAIRS.flatMap(([a, b]) => [a, b]),
      polylines: [[...MIDLINE]],
    },
    compute: (f) => overallSymmetry(f),
  },
  {
    key: "jawSymmetry",
    label: "Jaw symmetry",
    unit: "index",
    area: "symmetry",
    weight: 0.15,
    dimorphic: false,
    bands: BANDS.jawSymmetry,
    region: "jaw",
    overlay: {
      points: JAW_SYM_PAIRS.flatMap(([a, b]) => [a, b]),
      polylines: [[...MANDIBLE_CONTOUR]],
    },
    compute: (f) => jawSymmetry(f),
  },
  {
    key: "jawAngularity",
    label: "Jaw angularity",
    unit: "deg",
    area: "jawline",
    weight: 0.2,
    dimorphic: true,
    bands: BANDS.jawAngularity,
    region: "jaw",
    overlay: {
      points: [R_RAMUS, R_GONION, L_GONION, L_RAMUS, MENTON],
      polylines: [
        [R_RAMUS, R_GONION, MENTON],
        [L_RAMUS, L_GONION, MENTON],
      ],
    },
    compute: (f) => jawAngularity(f),
  },
  {
    key: "jawlineDefinition",
    label: "Jawline definition",
    unit: "index",
    area: "jawline",
    weight: 0.2,
    dimorphic: false,
    bands: BANDS.jawlineDefinition,
    region: "jaw",
    needsImage: true,
    overlay: {
      points: [],
      polylines: [[...MANDIBLE_CONTOUR]],
    },
    compute: (f, ctx) => jawlineDefinition(f, ctx),
  },
  {
    key: "browPosition",
    label: "Brow position",
    unit: "ratio",
    area: "eyeArea",
    weight: 0.1,
    dimorphic: true,
    bands: BANDS.browPosition,
    region: "brow",
    overlay: {
      points: [...R_BROW_INF, ...L_BROW_INF, R_LID_SUP, L_LID_SUP],
      polylines: [],
    },
    compute: (f) => browPosition(f),
  },
];

export { L_LID_INF2, L_LID_SUP2, R_LID_INF2, R_LID_SUP2 };
