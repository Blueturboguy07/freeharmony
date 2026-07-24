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
    return { result: gateFail, photo };
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
  };

  return { result: analyze(input), photo };
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
