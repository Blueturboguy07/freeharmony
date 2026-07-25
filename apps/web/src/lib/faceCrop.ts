import type { CSSProperties } from "react";
import { LANDMARKS } from "@freeharmony/engine";

/**
 * View-only square framing for scan photos.
 *
 * The stored photo keeps the camera's native aspect ratio — a portrait phone
 * frame is ~9:16, which renders taller than the viewport on the results page
 * and pushes every score below the fold. Re-encoding the stored photo would
 * desync the landmark overlay, the saved Adjust-Points overrides, and
 * reanalyze(), so the crop is applied purely at render time: CSS positions the
 * untouched <img> inside a square box, and toCrop/fromCrop move overlay
 * coordinates in and out of that window. Nothing the engine sees changes.
 */

export interface Crop {
  /** Left edge, as a fraction of image width. */
  x: number;
  /** Top edge, as a fraction of image height. */
  y: number;
  /** Window width, as a fraction of image width. */
  w: number;
  /** Window height, as a fraction of image height. */
  h: number;
}

/** The whole image — the fallback when there are no landmarks to centre on. */
export const FULL_FRAME: Crop = { x: 0, y: 0, w: 1, h: 1 };

/** The face spans this fraction of the square; the rest is breathing room. */
const FACE_FILL = 0.78;

/** Photo cards are capped to this so the scores stay above the fold. */
const MAX_PHOTO_REM = 22;
const MAX_PHOTO_VH = 44;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * The largest square that still fits inside the image, centred on `points`
 * with FACE_FILL headroom. `aspect` is the image's width/height: the window
 * has to be square in *pixels*, so its normalized width and height differ.
 */
export function squareCropAround(
  points: ReadonlyArray<{ x: number; y: number } | undefined>,
  aspect: number,
): Crop {
  if (!(aspect > 0)) return FULL_FRAME;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return FULL_FRAME;

  // Work in units where the image is `aspect` wide and 1 tall, so "square"
  // means square.
  const boxW = (maxX - minX) * aspect;
  const boxH = maxY - minY;
  const side = Math.min(
    Math.min(aspect, 1),
    Math.max(boxW, boxH) / FACE_FILL,
  );
  if (!(side > 0)) return FULL_FRAME;

  const cx = ((minX + maxX) / 2) * aspect;
  const cy = (minY + maxY) / 2;
  const x = clamp(cx - side / 2, 0, aspect - side);
  const y = clamp(cy - side / 2, 0, 1 - side);

  return { x: x / aspect, y, w: side / aspect, h: side };
}

/** Square window centred on the MediaPipe face oval. */
export function faceSquareCrop(
  landmarks: ReadonlyArray<{ x: number; y: number }>,
  aspect: number,
): Crop {
  if (landmarks.length === 0) return FULL_FRAME;
  return squareCropAround(
    LANDMARKS.FACE_OVAL.map((i) => landmarks[i]),
    aspect,
  );
}

/** Image-normalized point → crop-normalized point (for drawing overlays). */
export function toCrop(
  p: { x: number; y: number },
  c: Crop,
): { x: number; y: number } {
  return { x: (p.x - c.x) / c.w, y: (p.y - c.y) / c.h };
}

/** Crop-normalized point → image-normalized point (for pointer input). */
export function fromCrop(
  p: { x: number; y: number },
  c: Crop,
): { x: number; y: number } {
  return { x: c.x + p.x * c.w, y: c.y + p.y * c.h };
}

/** Aspect (w/h) of the box that renders `crop` without distortion. */
export function cropBoxAspect(crop: Crop, imageAspect: number): number {
  return (crop.w * imageAspect) / crop.h;
}

/**
 * Absolutely position the full image inside a `cropBoxAspect`-shaped box so
 * only `crop` shows. The scale factor is box/cropPixels in both axes, so
 * nothing stretches — unlike an object-cover crop, which would also move the
 * pixels out from under the SVG overlay.
 */
export function cropImageStyle(crop: Crop): CSSProperties {
  return {
    position: "absolute",
    width: `${100 / crop.w}%`,
    height: `${100 / crop.h}%`,
    left: `${(-crop.x / crop.w) * 100}%`,
    top: `${(-crop.y / crop.h) * 100}%`,
    maxWidth: "none",
  };
}

/**
 * Cap a photo card so a portrait shot can't push the scores below the fold.
 * The vh term is expressed as a width so the *rendered height* is what's
 * actually bounded, whatever the box's aspect.
 */
export function photoBoxStyle(boxAspect: number): CSSProperties {
  const vh = MAX_PHOTO_VH * (boxAspect > 0 ? boxAspect : 1);
  return { maxWidth: `min(${MAX_PHOTO_REM}rem, ${vh.toFixed(2)}vh)` };
}
