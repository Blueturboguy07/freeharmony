import type { ImageLike } from "../types.js";

/** Grayscale plane with dimensions. All ops integer or exact-float only. */
export interface GrayPlane {
  g: Float64Array;
  width: number;
  height: number;
}

/** BT.601 integer luma: (77R + 150G + 29B) >> 8 — exact and deterministic. */
export function toGray(img: ImageLike): GrayPlane {
  const { data, width, height } = img;
  const g = new Float64Array(width * height);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = (77 * data[p]! + 150 * data[p + 1]! + 29 * data[p + 2]!) >> 8;
  }
  return { g, width, height };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clampRect(r: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(width - 1, Math.round(r.x)));
  const y = Math.max(0, Math.min(height - 1, Math.round(r.y)));
  const w = Math.max(1, Math.min(width - x, Math.round(r.w)));
  const h = Math.max(1, Math.min(height - y, Math.round(r.h)));
  return { x, y, w, h };
}

export function cropGray(src: GrayPlane, r: Rect): GrayPlane {
  const g = new Float64Array(r.w * r.h);
  for (let row = 0; row < r.h; row++) {
    const srcOff = (r.y + row) * src.width + r.x;
    for (let col = 0; col < r.w; col++) g[row * r.w + col] = src.g[srcOff + col]!;
  }
  return { g, width: r.w, height: r.h };
}

/** Deterministic area-average downsample to at most `target` on the long edge. */
export function boxDownsample(src: GrayPlane, target: number): GrayPlane {
  const long = Math.max(src.width, src.height);
  if (long <= target) return src;
  const factor = Math.ceil(long / target);
  const w = Math.max(1, Math.floor(src.width / factor));
  const h = Math.max(1, Math.floor(src.height / factor));
  const g = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let dy = 0; dy < factor; dy++) {
        const row = (y * factor + dy) * src.width + x * factor;
        for (let dxx = 0; dxx < factor; dxx++) acc += src.g[row + dxx]!;
      }
      g[y * w + x] = acc / (factor * factor);
    }
  }
  return { g, width: w, height: h };
}

export function variance(p: GrayPlane): number {
  const n = p.g.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += p.g[i]!;
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const d = p.g[i]! - mean;
    v += d * d;
  }
  return v / n;
}

/**
 * Contrast-normalized sharpness: variance of the 3x3 Laplacian over the face
 * ROI, divided by the plane's own variance. Raw Laplacian variance fails on
 * low-contrast-but-sharp photos; this doesn't.
 */
export function laplacianSharpness(p: GrayPlane): number {
  const { g, width: w, height: h } = p;
  if (w < 3 || h < 3) return 0;
  let mean = 0;
  let count = 0;
  const lap = new Float64Array((w - 2) * (h - 2));
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const v =
        g[(y - 1) * w + x]! +
        g[(y + 1) * w + x]! +
        g[y * w + x - 1]! +
        g[y * w + x + 1]! -
        4 * g[y * w + x]!;
      lap[count] = v;
      mean += v;
      count++;
    }
  }
  mean /= count;
  let lv = 0;
  for (let i = 0; i < count; i++) {
    const d = lap[i]! - mean;
    lv += d * d;
  }
  lv /= count;
  return lv / Math.max(variance(p), 1);
}

/** Fraction of pixels clipped to near-black or near-white. */
export function clippedFraction(p: GrayPlane): number {
  let clipped = 0;
  for (let i = 0; i < p.g.length; i++) {
    const v = p.g[i]!;
    if (v <= 6 || v >= 249) clipped++;
  }
  return clipped / p.g.length;
}

/** Sobel gradient magnitude at integer (x, y); 0 outside valid bounds. */
export function sobelMagAt(p: GrayPlane, x: number, y: number): number {
  const { g, width: w, height: h } = p;
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 1 || yi < 1 || xi >= w - 1 || yi >= h - 1) return 0;
  const i = yi * w + xi;
  const gx =
    -g[i - w - 1]! - 2 * g[i - 1]! - g[i + w - 1]! +
    g[i - w + 1]! + 2 * g[i + 1]! + g[i + w + 1]!;
  const gy =
    -g[i - w - 1]! - 2 * g[i - w]! - g[i - w + 1]! +
    g[i + w - 1]! + 2 * g[i + w]! + g[i + w + 1]!;
  return Math.sqrt(gx * gx + gy * gy);
}

/** Approximate p90 of Sobel magnitude over a plane, sampled on a stride grid. */
export function sobelP90(p: GrayPlane): number {
  const { width: w, height: h } = p;
  const stride = Math.max(1, Math.floor(Math.min(w, h) / 64));
  const mags: number[] = [];
  for (let y = 1; y < h - 1; y += stride) {
    for (let x = 1; x < w - 1; x += stride) {
      mags.push(sobelMagAt(p, x, y));
    }
  }
  mags.sort((a, b) => a - b);
  const idx = Math.min(mags.length - 1, Math.floor(mags.length * 0.9));
  return mags[idx] ?? 0;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
