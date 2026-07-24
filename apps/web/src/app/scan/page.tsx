"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Gate } from "@freeharmony/engine";
import { runScan } from "@/lib/scan";
import { getLandmarker } from "@/lib/landmarker";
import { loadProfile, newScanId, saveScan } from "@/lib/store";

type Status =
  | { kind: "idle" }
  | { kind: "starting-camera" }
  | { kind: "camera-ready" }
  | { kind: "camera-error"; message: string }
  | { kind: "analyzing" }
  | { kind: "gate-failed"; gates: Gate[] };

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [modelReady, setModelReady] = useState(false);

  // Warm the landmarker while the user positions themselves.
  useEffect(() => {
    let cancelled = false;
    getLandmarker()
      .then(() => !cancelled && setModelReady(true))
      .catch(() => !cancelled && setModelReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = useCallback(async () => {
    setStatus({ kind: "starting-camera" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus({ kind: "camera-ready" });
    } catch {
      setStatus({
        kind: "camera-error",
        message:
          "Camera access was blocked. You can allow it in your browser's site settings, or upload a photo instead.",
      });
    }
  }, []);

  const analyzeCanvas = useCallback(
    async (canvas: HTMLCanvasElement) => {
      setStatus({ kind: "analyzing" });
      try {
        const profile = loadProfile();
        const { result, photo } = await runScan(
          { canvas, mirrored: false },
          profile.sex,
        );
        if (!result.ok) {
          setStatus({ kind: "gate-failed", gates: result.gates.blocking });
          return;
        }
        const id = newScanId();
        saveScan({ id, createdAt: Date.now(), result, photo });
        stopCamera();
        router.push(`/results/${id}`);
      } catch (err) {
        setStatus({
          kind: "camera-error",
          message: `Analysis failed: ${err instanceof Error ? err.message : "unknown error"}`,
        });
      }
    },
    [router, stopCamera],
  );

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    // Draw the RAW (unmirrored) camera pixels; only the preview is mirrored.
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    void analyzeCanvas(canvas);
  }, [analyzeCanvas]);

  const onUpload = useCallback(
    async (file: File) => {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      bitmap.close();
      void analyzeCanvas(canvas);
    },
    [analyzeCanvas],
  );

  const cameraOn = status.kind === "camera-ready" || status.kind === "analyzing";

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-ink-2 hover:text-ink text-sm">
          ← Back
        </Link>
        <span className="label-caps">Face Scan</span>
        <span className="w-12" />
      </header>

      <div className="card relative overflow-hidden aspect-[4/5]">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover -scale-x-100"
          style={{ display: cameraOn ? "block" : "none" }}
        />
        {cameraOn && <GoldenGuide />}
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            {status.kind === "camera-error" ? (
              <p className="text-sm text-work">{status.message}</p>
            ) : (
              <>
                <p className="font-display text-2xl">Ready to measure?</p>
                <p className="text-sm text-ink-2">
                  Face the camera straight on, eyes level, neutral expression,
                  soft even light. Everything runs on your device.
                </p>
              </>
            )}
            <button
              onClick={() => void startCamera()}
              className="gold-gradient rounded-full px-8 py-3 text-sm font-semibold tracking-[0.15em] uppercase"
              disabled={status.kind === "starting-camera"}
            >
              {status.kind === "starting-camera" ? "Starting…" : "Start Camera"}
            </button>
            <label className="cursor-pointer text-sm text-gold underline underline-offset-4">
              or upload a photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                }}
              />
            </label>
          </div>
        )}
        {status.kind === "analyzing" && (
          <div className="absolute inset-0 bg-bg/70 flex items-center justify-center">
            <p className="label-caps animate-pulse">Measuring…</p>
          </div>
        )}
      </div>

      {status.kind === "gate-failed" && (
        <div className="card border-work/40 p-5 flex flex-col gap-3">
          <p className="label-caps text-work">Couldn&apos;t measure this photo</p>
          {status.gates.map((g) => (
            <div key={g.code}>
              <p className="text-sm">{g.message}</p>
              <p className="text-sm text-ink-2">{g.retake}</p>
            </div>
          ))}
          <p className="text-xs text-ink-3">
            We refuse photos we can&apos;t measure honestly instead of guessing —
            that&apos;s the whole point.
          </p>
        </div>
      )}

      {cameraOn && status.kind !== "analyzing" && (
        <button
          onClick={capture}
          disabled={!modelReady}
          className="gold-gradient rounded-full py-4 text-sm font-semibold tracking-[0.15em] uppercase disabled:opacity-50"
        >
          {modelReady ? "Capture" : "Loading model…"}
        </button>
      )}

      <p className="text-center text-xs text-ink-3">
        Photos are processed entirely in your browser and stored only on this
        device.
      </p>
    </main>
  );
}

/** Golden-ratio positioning guide drawn over the live preview. */
function GoldenGuide() {
  return (
    <svg
      viewBox="0 0 100 125"
      className="absolute inset-0 h-full w-full opacity-40 pointer-events-none"
      preserveAspectRatio="none"
    >
      <g stroke="#ead0a4" strokeWidth="0.3" fill="none">
        <ellipse cx="50" cy="58" rx="24" ry="34" />
        <line x1="50" y1="10" x2="50" y2="115" />
        <line x1="26" y1="45" x2="74" y2="45" />
        <line x1="26" y1="70" x2="74" y2="70" />
        <line x1="26" y1="88" x2="74" y2="88" />
      </g>
    </svg>
  );
}
