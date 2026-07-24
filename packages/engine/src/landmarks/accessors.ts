import type { Frame, Pt } from "../types";

/** Indexed access with a hard assert — a missing landmark is a caller bug. */
export function pt(f: Frame, i: number): Pt {
  const p = f.pts[i];
  if (!p) throw new Error(`landmark ${i} missing`);
  return p;
}

export function mid(f: Frame, a: number, b: number): Pt {
  const pa = pt(f, a);
  const pb = pt(f, b);
  return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2 };
}

/** |x_a - x_b| */
export function dx(f: Frame, a: number, b: number): number {
  return Math.abs(pt(f, a).x - pt(f, b).x);
}

/** Signed y_a - y_b (positive = a above b; frame is y-up). */
export function dy(f: Frame, a: number, b: number): number {
  return pt(f, a).y - pt(f, b).y;
}

export function dist(f: Frame, a: number, b: number): number {
  const pa = pt(f, a);
  const pb = pt(f, b);
  const ddx = pa.x - pb.x;
  const ddy = pa.y - pb.y;
  // Not Math.hypot: it is slower and not cross-engine bit-identical.
  return Math.sqrt(ddx * ddx + ddy * ddy);
}

export function distPts(a: Pt, b: Pt): number {
  const ddx = a.x - b.x;
  const ddy = a.y - b.y;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}

/** Angle at vertex v between rays v→a and v→b, in degrees [0, 180]. */
export function angleAt(f: Frame, v: number, a: number, b: number): number {
  const pv = pt(f, v);
  const pa = pt(f, a);
  const pb = pt(f, b);
  const ax = pa.x - pv.x;
  const ay = pa.y - pv.y;
  const bx = pb.x - pv.x;
  const by = pb.y - pv.y;
  const na = Math.sqrt(ax * ax + ay * ay);
  const nb = Math.sqrt(bx * bx + by * by);
  if (na === 0 || nb === 0) return 0;
  let c = (ax * bx + ay * by) / (na * nb);
  if (c > 1) c = 1;
  if (c < -1) c = -1;
  return (Math.acos(c) * 180) / Math.PI;
}

/** Iris-center pupils on the 478 model; canthus midpoints otherwise. */
export function pupils(f: Frame): { right: Pt; left: Pt } {
  if (f.hasIris) {
    return { right: pt(f, 468), left: pt(f, 473) };
  }
  return { right: mid(f, 33, 133), left: mid(f, 362, 263) };
}

/**
 * Linear interpolation of a landmark chain's y at a given x.
 * Falls back to the nearest endpoint when x is outside the chain's span.
 */
export function chainYAtX(f: Frame, chain: readonly number[], x: number): number {
  const pts = chain.map((i) => pt(f, i)).sort((a, b) => a.x - b.x);
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (x <= first.x) return first.y;
  if (x >= last.x) return last.y;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (x >= a.x && x <= b.x) {
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return last.y;
}
