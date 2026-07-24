// Deterministic geometry fits: PCA line (total least squares) and a
// Jacobi-based Umeyama similarity transform for the occlusion check.
// Only +,-,*,/ and sqrt/atan2/acos are used; no Math.hypot, no Math.pow.

export interface Line2 {
  /** A point on the line. */
  cx: number;
  cy: number;
  /** Unit direction. */
  dx: number;
  dy: number;
  /** Unit normal. */
  nx: number;
  ny: number;
}

/** Total-least-squares line through 2D points via the 2x2 covariance eigenvector. */
export function fitLinePCA(xs: number[], ys: number[]): Line2 {
  const n = xs.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i]!;
    my += ys[i]!;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const ux = xs[i]! - mx;
    const uy = ys[i]! - my;
    sxx += ux * ux;
    sxy += ux * uy;
    syy += uy * uy;
  }
  // Principal eigenvector of [[sxx,sxy],[sxy,syy]].
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  let dx: number;
  let dy: number;
  if (Math.abs(sxy) > 1e-12) {
    dx = l1 - syy;
    dy = sxy;
  } else if (sxx >= syy) {
    dx = 1;
    dy = 0;
  } else {
    dx = 0;
    dy = 1;
  }
  const norm = Math.sqrt(dx * dx + dy * dy);
  dx /= norm;
  dy /= norm;
  return { cx: mx, cy: my, dx, dy, nx: -dy, ny: dx };
}

export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

function matMul3(a: Mat3, b: Mat3): Mat3 {
  const r: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i]![j]! += a[i]![k]! * b[k]![j]!;
  return r;
}

function transpose3(a: Mat3): Mat3 {
  return [
    [a[0][0], a[1][0], a[2][0]],
    [a[0][1], a[1][1], a[2][1]],
    [a[0][2], a[1][2], a[2][2]],
  ];
}

function det3(a: Mat3): number {
  return (
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
  );
}

/** Cyclic Jacobi eigendecomposition of a symmetric 3x3. Returns {values, vectors(cols)}. */
function jacobiEigen3(m: Mat3): { values: [number, number, number]; vectors: Mat3 } {
  const a: Mat3 = [
    [m[0][0], m[0][1], m[0][2]],
    [m[1][0], m[1][1], m[1][2]],
    [m[2][0], m[2][1], m[2][2]],
  ];
  let v: Mat3 = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 30; sweep++) {
    let off = 0;
    for (let p = 0; p < 3; p++)
      for (let q = p + 1; q < 3; q++) off += a[p]![q]! * a[p]![q]!;
    if (off < 1e-22) break;
    for (let p = 0; p < 3; p++) {
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p]![q]!) < 1e-15) continue;
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * a[p]![q]!);
        const t =
          (theta >= 0 ? 1 : -1) /
          (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        // Rotate a
        const rot: Mat3 = [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ];
        rot[p]![p] = c;
        rot[q]![q] = c;
        rot[p]![q] = s;
        rot[q]![p] = -s;
        const rt = transpose3(rot);
        const an = matMul3(rt, matMul3(a, rot));
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) a[i]![j] = an[i]![j]!;
        v = matMul3(v, rot);
      }
    }
  }
  return { values: [a[0][0], a[1][1], a[2][2]], vectors: v };
}

export interface Umeyama {
  /** Rotation matrix mapping source → target. */
  r: Mat3;
  scale: number;
  /** Translation. */
  t: [number, number, number];
}

/**
 * Umeyama similarity fit (rotation + uniform scale + translation) mapping
 * `src` onto `dst`. Both are flat arrays of [x,y,z] triples, equal length.
 */
export function umeyama(
  src: ReadonlyArray<readonly [number, number, number]>,
  dst: ReadonlyArray<readonly [number, number, number]>,
): Umeyama {
  const n = src.length;
  const ms = [0, 0, 0];
  const md = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      ms[k]! += src[i]![k]!;
      md[k]! += dst[i]![k]!;
    }
  }
  for (let k = 0; k < 3; k++) {
    ms[k]! /= n;
    md[k]! /= n;
  }
  // Covariance dst·srcᵀ and source variance
  const cov: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  let varS = 0;
  for (let i = 0; i < n; i++) {
    const s = [src[i]![0]! - ms[0]!, src[i]![1]! - ms[1]!, src[i]![2]! - ms[2]!];
    const d = [dst[i]![0]! - md[0]!, dst[i]![1]! - md[1]!, dst[i]![2]! - md[2]!];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) cov[r]![c]! += d[r]! * s[c]!;
    varS += s[0]! * s[0]! + s[1]! * s[1]! + s[2]! * s[2]!;
  }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cov[r]![c]! /= n;
  varS /= n;

  // SVD of cov via eigendecomposition of covᵀ·cov.
  const ctc = matMul3(transpose3(cov), cov);
  const eig = jacobiEigen3(ctc);
  // Sort eigenpairs descending.
  const order = [0, 1, 2].sort((a, b) => eig.values[b]! - eig.values[a]!);
  const vMat: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const sv: number[] = [];
  for (let j = 0; j < 3; j++) {
    const src_j = order[j]!;
    sv.push(Math.sqrt(Math.max(0, eig.values[src_j]!)));
    for (let i = 0; i < 3; i++) vMat[i]![j] = eig.vectors[i]![src_j]!;
  }
  // U = cov · V · S⁻¹ (guard tiny singular values)
  const uMat: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let j = 0; j < 3; j++) {
    const s = sv[j]! > 1e-12 ? sv[j]! : 1e-12;
    for (let i = 0; i < 3; i++) {
      let acc = 0;
      for (let k = 0; k < 3; k++) acc += cov[i]![k]! * vMat[k]![j]!;
      uMat[i]![j] = acc / s;
    }
  }
  // Proper rotation: R = U · diag(1,1,d) · Vᵀ with d = sign(det(U·Vᵀ))
  const uvT = matMul3(uMat, transpose3(vMat));
  const d = det3(uvT) < 0 ? -1 : 1;
  const dMat: Mat3 = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, d],
  ];
  const r = matMul3(uMat, matMul3(dMat, transpose3(vMat)));
  const traceDS = sv[0]! + sv[1]! + d * sv[2]!;
  const scale = varS > 1e-12 ? traceDS / varS : 1;
  const t: [number, number, number] = [
    md[0]! - scale * (r[0][0] * ms[0]! + r[0][1] * ms[1]! + r[0][2] * ms[2]!),
    md[1]! - scale * (r[1][0] * ms[0]! + r[1][1] * ms[1]! + r[1][2] * ms[2]!),
    md[2]! - scale * (r[2][0] * ms[0]! + r[2][1] * ms[1]! + r[2][2] * ms[2]!),
  ];
  return { r, scale, t };
}

export function applyUmeyama(
  u: Umeyama,
  p: readonly [number, number, number],
): [number, number, number] {
  const { r, scale, t } = u;
  return [
    scale * (r[0][0] * p[0] + r[0][1] * p[1] + r[0][2] * p[2]) + t[0],
    scale * (r[1][0] * p[0] + r[1][1] * p[1] + r[1][2] * p[2]) + t[1],
    scale * (r[2][0] * p[0] + r[2][1] * p[1] + r[2][2] * p[2]) + t[2],
  ];
}
