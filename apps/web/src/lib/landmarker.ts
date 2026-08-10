"use client";

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let instance: Promise<FaceLandmarker> | null = null;

type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

function createLandmarker(fileset: Fileset, delegate: "GPU" | "CPU") {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: "/mediapipe/face_landmarker.task",
      delegate,
    },
    runningMode: "IMAGE",
    // 2 so we can DETECT a second face and refuse, rather than silently
    // scoring whichever face the model liked more.
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: 0.5,
  });
}

/**
 * Lazy singleton FaceLandmarker. WASM + model are served from our own origin
 * (see scripts/prepare-assets.mjs) — no third-party requests at runtime.
 *
 * The GPU delegate is faster but needs a working WebGL2 context; some
 * browsers/devices (no hardware acceleration, certain sandboxed or embedded
 * webviews, some Linux GPU driver setups) fail to initialize it. Rather than
 * surface that as a dead "loading model…" forever, fall back to the CPU
 * delegate once before giving up — slower, but it works.
 */
export function getLandmarker(): Promise<FaceLandmarker> {
  if (!instance) {
    instance = (async () => {
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      try {
        return await createLandmarker(fileset, "GPU");
      } catch (gpuErr) {
        console.warn(
          "[freeharmony] GPU delegate failed to initialize, retrying on CPU",
          gpuErr,
        );
        return await createLandmarker(fileset, "CPU");
      }
    })().catch((err) => {
      instance = null; // allow retry (e.g. transient fetch failure, offline)
      throw err;
    });
  }
  return instance;
}
