import type { Frame, Pt, ScanInput } from "./types";
import { estimatePose, type PoseEstimate } from "./pose";
import {
  L_CANTHUS_LAT,
  L_CANTHUS_MED,
  L_IRIS_C,
  R_CANTHUS_LAT,
  R_CANTHUS_MED,
  R_IRIS_C,
} from "./landmarks/indices";

/**
 * Build the measurement frame from raw MediaPipe output. Ordered steps:
 *   0. de-mirror            (before everything — else anatomical L/R swap)
 *   1. Adjust Points overrides
 *   2. de-normalize to px   (before any angle math — normalized coords are
 *                            anisotropic on non-square images)
 *   3. flip y-up
 *   4. roll-correct about the pupil midpoint
 *   5. scale = post-rotation interpupillary distance
 */
export function buildFrame(input: ScanInput): { frame: Frame; pose: PoseEstimate } {
  const { imageWidth: w, imageHeight: h } = input;
  const hasIris = input.landmarks.length >= 478;

  // Steps 0–3
  const pts: Pt[] = new Array(input.landmarks.length);
  for (let i = 0; i < input.landmarks.length; i++) {
    const raw = input.landmarks[i]!;
    const o = input.overrides?.[i];
    let nx = o ? o.x : raw.x;
    let ny = o ? o.y : raw.y;
    const nz = raw.z;
    if (input.mirrored) nx = 1 - nx;
    pts[i] = { x: nx * w, y: h - ny * h, z: nz * w };
  }

  // Pose is estimated on the pre-roll-corrected pixel points (the transform
  // matrix, when present, already encodes roll).
  const pose = estimatePose(pts, input.transformationMatrix);

  // Step 4 — roll correction about the pupil midpoint.
  const pr = hasIris ? pts[R_IRIS_C]! : midOf(pts, R_CANTHUS_LAT, R_CANTHUS_MED);
  const pl = hasIris ? pts[L_IRIS_C]! : midOf(pts, L_CANTHUS_MED, L_CANTHUS_LAT);
  const theta = Math.atan2(pl.y - pr.y, pl.x - pr.x);
  const cx = (pr.x + pl.x) / 2;
  const cy = (pr.y + pl.y) / 2;
  const c = Math.cos(-theta);
  const s = Math.sin(-theta);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const ux = p.x - cx;
    const uy = p.y - cy;
    pts[i] = { x: cx + ux * c - uy * s, y: cy + ux * s + uy * c, z: p.z };
  }

  // Step 5 — scale (denominator only; points stay in pixels for image gates).
  const pr2 = hasIris ? pts[R_IRIS_C]! : midOf(pts, R_CANTHUS_LAT, R_CANTHUS_MED);
  const pl2 = hasIris ? pts[L_IRIS_C]! : midOf(pts, L_CANTHUS_MED, L_CANTHUS_LAT);
  const ddx = pl2.x - pr2.x;
  const ddy = pl2.y - pr2.y;
  const scale = Math.sqrt(ddx * ddx + ddy * ddy);

  const frame: Frame = {
    pts,
    scale,
    rollDeg: (theta * 180) / Math.PI,
    yawDeg: pose.yawDeg,
    pitchDeg: pose.pitchDeg,
    poseSource: pose.source,
    yawAsym: pose.yawAsym,
    imageWidth: w,
    imageHeight: h,
    hasIris,
  };
  return { frame, pose };
}

function midOf(pts: Pt[], a: number, b: number): Pt {
  const pa = pts[a]!;
  const pb = pts[b]!;
  return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2 };
}
