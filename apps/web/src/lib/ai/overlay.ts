"use client";

import { LANDMARKS } from "@freeharmony/engine";
import type { StoredInput } from "../scan";

/**
 * Draw the measurement construction over the stored photo — the artifact that
 * lets a vision model catch misplaced landmarks ("the jaw point is on the
 * ear"). Returns a JPEG data URL at the photo's own size (≤768px).
 */
export async function buildAnnotatedOverlay(
  photoDataUrl: string,
  input: StoredInput,
  overrides?: Record<number, { x: number; y: number }>,
): Promise<string> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("photo decode failed"));
    img.src = photoDataUrl;
  });
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const P = (i: number): [number, number] => {
    const o = overrides?.[i];
    if (o) return [o.x * W, o.y * H];
    const p = input.landmarks[i]!;
    return [p.x * W, p.y * H];
  };

  ctx.strokeStyle = "#ead0a4";
  ctx.fillStyle = "#ead0a4";
  ctx.lineWidth = Math.max(1.2, W / 500);

  const line = (a: number, b: number) => {
    ctx.beginPath();
    ctx.moveTo(...P(a));
    ctx.lineTo(...P(b));
    ctx.stroke();
  };
  const chain = (idx: readonly number[]) => {
    ctx.beginPath();
    const [x0, y0] = P(idx[0]!);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < idx.length; i++) ctx.lineTo(...P(idx[i]!));
    ctx.stroke();
  };
  const dot = (i: number) => {
    const [x, y] = P(i);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, W / 250), 0, Math.PI * 2);
    ctx.fill();
  };

  const L = LANDMARKS;
  // Midline + mandible
  chain(L.MIDLINE);
  chain(L.MANDIBLE_CONTOUR);
  // Eye lines (canthal tilt) + pupil line
  line(L.R_CANTHUS_LAT, L.R_CANTHUS_MED);
  line(L.L_CANTHUS_MED, L.L_CANTHUS_LAT);
  line(L.R_IRIS_C, L.L_IRIS_C);
  // Width constructions
  line(L.R_ZYGION, L.L_ZYGION);
  line(L.R_GONION, L.L_GONION);
  line(L.R_ALARE, L.L_ALARE);
  line(L.R_CHEILION, L.L_CHEILION);
  // Vertical references
  line(L.GLABELLA, L.SUBNASALE);
  line(L.SUBNASALE, L.MENTON);
  // Eye→mouth apex
  line(L.R_IRIS_C, L.STOMION_SUP);
  line(L.L_IRIS_C, L.STOMION_SUP);

  for (const i of [
    L.R_CANTHUS_LAT, L.R_CANTHUS_MED, L.L_CANTHUS_MED, L.L_CANTHUS_LAT,
    L.R_IRIS_C, L.L_IRIS_C, L.R_ZYGION, L.L_ZYGION, L.R_GONION, L.L_GONION,
    L.R_ALARE, L.L_ALARE, L.R_CHEILION, L.L_CHEILION,
    L.GLABELLA, L.SUBNASALE, L.MENTON, L.LABIALE_SUP, L.STOMION_SUP,
    L.STOMION_INF, L.LABIALE_INF, L.SUBLABIALE,
  ]) {
    dot(i);
  }

  return c.toDataURL("image/jpeg", 0.85);
}

export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
