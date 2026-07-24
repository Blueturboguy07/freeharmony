"use client";

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let instance: Promise<FaceLandmarker> | null = null;

/**
 * Lazy singleton FaceLandmarker. WASM + model are served from our own origin
 * (see scripts/prepare-assets.mjs) — no third-party requests at runtime.
 */
export function getLandmarker(): Promise<FaceLandmarker> {
  if (!instance) {
    instance = (async () => {
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/mediapipe/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        // 2 so we can DETECT a second face and refuse, rather than silently
        // scoring whichever face the model liked more.
        numFaces: 2,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5,
      });
    })().catch((err) => {
      instance = null; // allow retry (e.g. GPU delegate failed, transient fetch)
      throw err;
    });
  }
  return instance;
}
