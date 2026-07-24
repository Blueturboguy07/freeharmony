import type { FaceRegion, Frame } from "./types.js";
import { CANONICAL_VERTS } from "./landmarks/canonical.js";
import { REGION_SETS } from "./landmarks/indices.js";
import { applyUmeyama, umeyama } from "./math/fit.js";

export interface RegionResiduals {
  /** RMS residual per region, normalized by frame scale (IPD). */
  byRegion: Record<FaceRegion, number>;
  overall: number;
}

/**
 * Rigid-similarity fit of the observed 3D landmarks to the canonical model.
 * A region whose residual is large is being extrapolated, not observed —
 * glasses, hair, hand, mask. Residuals are normalized by IPD so thresholds
 * are resolution-independent.
 */
export function regionalResiduals(frame: Frame): RegionResiduals {
  const n = Math.min(frame.pts.length, CANONICAL_VERTS.length);
  const src: Array<readonly [number, number, number]> = new Array(n);
  const dst: Array<readonly [number, number, number]> = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = CANONICAL_VERTS[i]!;
    const p = frame.pts[i]!;
    src[i] = c;
    dst[i] = [p.x, p.y, p.z];
  }
  const fit = umeyama(src, dst);

  const S = Math.max(frame.scale, 1e-9);
  const regionAcc: Record<FaceRegion, { sum: number; n: number }> = {
    eyes: { sum: 0, n: 0 },
    nose: { sum: 0, n: 0 },
    mouth: { sum: 0, n: 0 },
    jaw: { sum: 0, n: 0 },
    brow: { sum: 0, n: 0 },
  };
  let allSum = 0;
  let allN = 0;

  const regionOf = new Map<number, FaceRegion>();
  for (const region of Object.keys(REGION_SETS) as FaceRegion[]) {
    for (const idx of REGION_SETS[region]) regionOf.set(idx, region);
  }

  for (let i = 0; i < n; i++) {
    const mapped = applyUmeyama(fit, CANONICAL_VERTS[i]!);
    const p = frame.pts[i]!;
    const dx = mapped[0] - p.x;
    const dy = mapped[1] - p.y;
    const dz = mapped[2] - p.z;
    const sq = dx * dx + dy * dy + dz * dz;
    allSum += sq;
    allN++;
    const region = regionOf.get(i);
    if (region) {
      regionAcc[region].sum += sq;
      regionAcc[region].n++;
    }
  }

  const byRegion = {} as Record<FaceRegion, number>;
  for (const region of Object.keys(regionAcc) as FaceRegion[]) {
    const { sum, n: rn } = regionAcc[region];
    byRegion[region] = rn > 0 ? Math.sqrt(sum / rn) / S : 0;
  }
  return { byRegion, overall: Math.sqrt(allSum / Math.max(allN, 1)) / S };
}
