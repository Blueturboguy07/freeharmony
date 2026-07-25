import { describe, expect, it } from "vitest";
import { LANDMARKS } from "@freeharmony/engine";
import {
  cropBoxAspect,
  cropImageStyle,
  faceSquareCrop,
  fromCrop,
  squareCropAround,
  toCrop,
  FULL_FRAME,
  type Crop,
} from "../src/lib/faceCrop";

/** 478 landmarks where the face oval occupies exactly the given box. */
function meshWithOval(box: { x0: number; y0: number; x1: number; y1: number }) {
  const pts = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const oval = LANDMARKS.FACE_OVAL;
  oval.forEach((i, n) => {
    // Walk the corners so the bounding box is exactly `box`.
    const t = n / (oval.length - 1);
    pts[i] = {
      x: n % 2 === 0 ? box.x0 : box.x1,
      y: t < 0.5 ? box.y0 : box.y1,
      z: 0,
    };
  });
  // Pin the extremes regardless of parity.
  pts[oval[0]!] = { x: box.x0, y: box.y0, z: 0 };
  pts[oval[1]!] = { x: box.x1, y: box.y1, z: 0 };
  return pts;
}

/** The crop covers the same number of pixels horizontally and vertically. */
function isSquare(crop: Crop, aspect: number): boolean {
  return Math.abs(crop.w * aspect - crop.h) < 1e-9;
}

const PORTRAIT = 9 / 16;
const LANDSCAPE = 16 / 9;

describe("squareCropAround", () => {
  it("is square in pixels for a portrait frame", () => {
    const mesh = meshWithOval({ x0: 0.3, y0: 0.3, x1: 0.7, y1: 0.55 });
    const crop = faceSquareCrop(mesh, PORTRAIT);
    expect(isSquare(crop, PORTRAIT)).toBe(true);
    expect(cropBoxAspect(crop, PORTRAIT)).toBeCloseTo(1, 9);
  });

  it("is square in pixels for a landscape frame", () => {
    const mesh = meshWithOval({ x0: 0.42, y0: 0.15, x1: 0.58, y1: 0.85 });
    const crop = faceSquareCrop(mesh, LANDSCAPE);
    expect(isSquare(crop, LANDSCAPE)).toBe(true);
  });

  it("puts the face in the middle", () => {
    const mesh = meshWithOval({ x0: 0.3, y0: 0.3, x1: 0.7, y1: 0.55 });
    const crop = faceSquareCrop(mesh, PORTRAIT);
    const centre = toCrop({ x: 0.5, y: 0.425 }, crop);
    expect(centre.x).toBeCloseTo(0.5, 6);
    expect(centre.y).toBeCloseTo(0.5, 6);
  });

  it("stays inside the image", () => {
    const cases = [
      { x0: 0.01, y0: 0.01, x1: 0.4, y1: 0.2 }, // hard against the top-left
      { x0: 0.6, y0: 0.8, x1: 0.99, y1: 0.99 }, // hard against the bottom-right
      { x0: 0.05, y0: 0.05, x1: 0.95, y1: 0.95 }, // face fills the frame
    ];
    for (const aspect of [PORTRAIT, 1, LANDSCAPE]) {
      for (const box of cases) {
        const crop = faceSquareCrop(meshWithOval(box), aspect);
        expect(isSquare(crop, aspect)).toBe(true);
        expect(crop.x).toBeGreaterThanOrEqual(0);
        expect(crop.y).toBeGreaterThanOrEqual(0);
        expect(crop.x + crop.w).toBeLessThanOrEqual(1 + 1e-9);
        expect(crop.y + crop.h).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("keeps the whole face visible", () => {
    const box = { x0: 0.2, y0: 0.12, x1: 0.8, y1: 0.62 };
    const crop = faceSquareCrop(meshWithOval(box), PORTRAIT);
    for (const p of [
      { x: box.x0, y: box.y0 },
      { x: box.x1, y: box.y1 },
      { x: box.x0, y: box.y1 },
      { x: box.x1, y: box.y0 },
    ]) {
      const v = toCrop(p, crop);
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.x).toBeLessThanOrEqual(1);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeLessThanOrEqual(1);
    }
  });

  it("falls back to the full frame without usable points", () => {
    expect(faceSquareCrop([], PORTRAIT)).toEqual(FULL_FRAME);
    expect(squareCropAround([{ x: NaN, y: 0.5 }], PORTRAIT)).toEqual(FULL_FRAME);
    expect(squareCropAround([{ x: 0.5, y: 0.5 }], 0)).toEqual(FULL_FRAME);
  });

  it("degenerates to a point-sized box without blowing up", () => {
    const crop = squareCropAround([{ x: 0.5, y: 0.5 }], PORTRAIT);
    expect(crop).toEqual(FULL_FRAME);
  });
});

describe("toCrop / fromCrop", () => {
  it("round-trip", () => {
    const crop = faceSquareCrop(
      meshWithOval({ x0: 0.25, y0: 0.2, x1: 0.75, y1: 0.6 }),
      PORTRAIT,
    );
    for (const p of [
      { x: 0.3, y: 0.3 },
      { x: 0.5, y: 0.42 },
      { x: 0.71, y: 0.55 },
    ]) {
      const back = fromCrop(toCrop(p, crop), crop);
      expect(back.x).toBeCloseTo(p.x, 12);
      expect(back.y).toBeCloseTo(p.y, 12);
    }
  });
});

describe("cropImageStyle", () => {
  it("scales the image uniformly", () => {
    const aspect = PORTRAIT;
    const crop = faceSquareCrop(
      meshWithOval({ x0: 0.3, y0: 0.3, x1: 0.7, y1: 0.55 }),
      aspect,
    );
    const style = cropImageStyle(crop);
    // Box is square, so a uniform scale means the rendered image keeps its
    // own aspect: width% / height% must equal the image's aspect.
    const w = parseFloat(String(style.width));
    const h = parseFloat(String(style.height));
    expect(w / h).toBeCloseTo(aspect, 9);
  });

  it("offsets so the crop's top-left lands at the box origin", () => {
    const crop: Crop = { x: 0.25, y: 0.1, w: 0.5, h: 0.4 };
    const style = cropImageStyle(crop);
    expect(parseFloat(String(style.left))).toBeCloseTo(-50, 9);
    expect(parseFloat(String(style.top))).toBeCloseTo(-25, 9);
  });
});
