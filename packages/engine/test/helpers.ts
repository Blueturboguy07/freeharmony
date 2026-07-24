import { CANONICAL_VERTS } from "../src/landmarks/canonical.js";
import type { Pt, ScanInput } from "../src/types.js";

// Synthetic frame: 1024×1280 px viewing a 20×25 cm window → isotropic
// 51.2 px/cm, IPD ≈ 323 px. MediaPipe-style normalized coords (y-down).
export const FRAME_W = 1024;
export const FRAME_H = 1280;
const W_CM = 20;
const H_CM = 25;

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [Vec3, Vec3, Vec3];

export const IDENTITY_16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const d2r = (deg: number) => (deg * Math.PI) / 180;

export function rotXYZ(yawDeg: number, pitchDeg: number, rollDeg: number): Mat3 {
  const a = d2r(pitchDeg);
  const b = d2r(yawDeg);
  const g = d2r(rollDeg);
  const rx: Mat3 = [
    [1, 0, 0],
    [0, Math.cos(a), -Math.sin(a)],
    [0, Math.sin(a), Math.cos(a)],
  ];
  const ry: Mat3 = [
    [Math.cos(b), 0, Math.sin(b)],
    [0, 1, 0],
    [-Math.sin(b), 0, Math.cos(b)],
  ];
  const rz: Mat3 = [
    [Math.cos(g), -Math.sin(g), 0],
    [Math.sin(g), Math.cos(g), 0],
    [0, 0, 1],
  ];
  // R = Rz · Ry · Rx
  return mul(rz, mul(ry, rx));
}

function mul(a: Mat3, b: Mat3): Mat3 {
  const out: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) out[i]![j]! += a[i]![k]! * b[k]![j]!;
  return out as unknown as Mat3;
}

export function applyR(r: Mat3, v: Vec3): Vec3 {
  return [
    r[0][0] * v[0] + r[0][1] * v[1] + r[0][2] * v[2],
    r[1][0] * v[0] + r[1][1] * v[1] + r[1][2] * v[2],
    r[2][0] * v[0] + r[2][1] * v[1] + r[2][2] * v[2],
  ];
}

/** Flatten a rotation into a column-major 4x4 with a nonzero translation. */
export function toColMajor16(r: Mat3, t: Vec3 = [0, 0, -30]): number[] {
  return [
    r[0][0], r[1][0], r[2][0], 0,
    r[0][1], r[1][1], r[2][1], 0,
    r[0][2], r[1][2], r[2][2], 0,
    t[0], t[1], t[2], 1,
  ];
}

/**
 * Orthographic projection of (optionally rotated) canonical vertices into
 * MediaPipe-style normalized coordinates.
 */
export function projectCanonical(r?: Mat3): Pt[] {
  return CANONICAL_VERTS.map((v) => {
    const p = r ? applyR(r, v) : v;
    return {
      x: 0.5 + p[0] / W_CM,
      y: 0.5 - p[1] / H_CM,
      z: p[2] / W_CM,
    };
  });
}

export function canonicalInput(overrides?: Partial<ScanInput>): ScanInput {
  return {
    landmarks: projectCanonical(),
    imageWidth: FRAME_W,
    imageHeight: FRAME_H,
    mirrored: false,
    transformationMatrix: IDENTITY_16,
    ...overrides,
  };
}

export function metricValue(
  result: ReturnType<typeof import("../src/index.js").analyze>,
  key: string,
): number {
  const m = result.metrics.find((x) => x.key === key);
  if (!m) throw new Error(`metric ${key} missing from result`);
  return m.value;
}
