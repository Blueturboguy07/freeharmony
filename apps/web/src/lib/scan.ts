"use client";

import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import {
  analyze,
  type Gate,
  type ScanInput,
  type ScanResult,
  type Sex,
} from "@freeharmony/engine";
import { getLandmarker } from "./landmarker";

export interface CapturedFrame {
  canvas: HTMLCanvasElement;
  /** True when the pixels themselves are mirrored (not just the preview). */
  mirrored: boolean;
}

function blendshapeMap(result: FaceLandmarkerResult): Record<string, number> {
  const out: Record<string, number> = {};
  const classifications = result.faceBlendshapes?.[0];
  if (classifications) {
    for (const c of classifications.categories) {
      out[c.categoryName] = c.score;
    }
  }
  return out;
}

function faceCountGate(count: number): Gate {
  return count === 0
    ? {
        code: "no-face",
        severity: "block",
        message: "No face detected.",
        retake: "Center your face in the frame with good lighting.",
      }
    : {
        code: "multiple-faces",
        severity: "block",
        message: "More than one face is in the frame.",
        retake: "Make sure only your face is visible, then retake.",
      };
}

export interface ScanOutcome {
  result: ScanResult;
  /** JPEG data URL, long edge ≤ 768px — for display, history, and AI calls. */
  photo: string;
  /** Everything needed to re-run analyze() later (Adjust Points, sex change) —
   *  minus the pixel buffer, which is rebuilt from `photo` on demand. */
  input: StoredInput | null;
}

export interface StoredInput {
  landmarks: ScanInput["landmarks"];
  mirrored: boolean;
  blendshapes?: Record<string, number>;
  transformationMatrix?: number[];
}

/**
 * Full client-side pipeline: landmark the captured frame, run the
 * deterministic engine, and downscale the photo for storage. Nothing here
 * performs any network I/O.
 */
export async function runScan(
  frame: CapturedFrame,
  sex: Sex,
): Promise<ScanOutcome> {
  const landmarker = await getLandmarker();
  const detection = landmarker.detect(frame.canvas);

  const photo = downscaleToDataURL(frame.canvas, 768);
  const faces = detection.faceLandmarks.length;

  if (faces !== 1) {
    const gateFail: ScanResult = {
      ok: false,
      gates: {
        pass: false,
        blocking: [faceCountGate(faces)],
        warnings: [],
        confidenceMultiplier: 1,
        regionConfidence: {},
        jawEdgeSupport: null,
      },
      frame: null,
      metrics: [],
      areas: {
        symmetry: { score: null, confidence: 0 },
        eyeArea: { score: null, confidence: 0 },
        midface: { score: null, confidence: 0 },
        jawline: { score: null, confidence: 0 },
      },
      overall: null,
      tier: null,
      engineVersion: "0.1.0",
      bandProfile: "faceharmony-parity",
      sex,
    };
    return { result: gateFail, photo, input: null };
  }

  const ctx = frame.canvas.getContext("2d", { willReadFrequently: true })!;
  const imageData = ctx.getImageData(0, 0, frame.canvas.width, frame.canvas.height);

  const input: ScanInput = {
    landmarks: detection.faceLandmarks[0]!,
    imageWidth: frame.canvas.width,
    imageHeight: frame.canvas.height,
    mirrored: frame.mirrored,
    blendshapes: blendshapeMap(detection),
    transformationMatrix: detection.facialTransformationMatrixes?.[0]?.data,
    image: {
      data: imageData.data,
      width: imageData.width,
      height: imageData.height,
    },
    sex,
    bandProfile: "calibrated",
  };

  const result = analyze(input);
  // Field-calibration breadcrumbs (harmless in prod, invaluable in bug reports).
  if (result.frame) {
    console.info(
      "[freeharmony] pose",
      {
        rollDeg: result.frame.rollDeg.toFixed(1),
        yawDeg: result.frame.yawDeg?.toFixed(1) ?? null,
        pitchDeg: result.frame.pitchDeg?.toFixed(1) ?? null,
        yawAsym: result.frame.yawAsym.toFixed(3),
        poseSource: result.frame.poseSource,
      },
      "gates",
      result.gates.blocking.map((g) => g.code),
      result.gates.warnings.map((g) => g.code),
    );
  }

  return {
    result,
    photo,
    input: {
      landmarks: input.landmarks,
      mirrored: frame.mirrored,
      blendshapes: input.blendshapes,
      transformationMatrix: input.transformationMatrix,
    },
  };
}

/**
 * Re-run the engine against the stored (downscaled) photo — used by Adjust
 * Points and profile changes. Metrics are scale-invariant, so analyzing at
 * 768px reproduces the original values.
 */
export async function reanalyze(
  stored: StoredInput,
  photoDataUrl: string,
  sex: Sex,
  overrides?: Record<number, { x: number; y: number }>,
): Promise<ScanResult> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("photo decode failed"));
    img.src = photoDataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return analyze({
    landmarks: stored.landmarks,
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    mirrored: stored.mirrored,
    blendshapes: stored.blendshapes,
    transformationMatrix: stored.transformationMatrix,
    image: { data: imageData.data, width: imageData.width, height: imageData.height },
    overrides,
    sex,
    bandProfile: "calibrated",
  });
}

export function downscaleToDataURL(
  source: HTMLCanvasElement,
  maxLongEdge: number,
): string {
  const long = Math.max(source.width, source.height);
  const scale = long > maxLongEdge ? maxLongEdge / long : 1;
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(source, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.85);
}
