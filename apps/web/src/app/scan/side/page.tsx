"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  analyzeProfile,
  defaultProfileAnchors,
  PROFILE_ANCHOR_LABELS,
  PROFILE_ANCHOR_ORDER,
  type ProfileAnchorKey,
  type ProfileAnchors,
} from "@freeharmony/engine";
import { downscaleToDataURL } from "@/lib/scan";
import { getScan, loadProfile, updateScan } from "@/lib/store";

export default function SideScanPage() {
  return (
    <Suspense fallback={null}>
      <SideScan />
    </Suspense>
  );
}

type Stage =
  | { kind: "idle" }
  | { kind: "camera"; countdown: number | null }
  | { kind: "camera-error"; message: string }
  | { kind: "place"; photo: string };

function SideScan() {
  const router = useRouter();
  const params = useSearchParams();
  const attachId = params.get("attach");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [anchors, setAnchors] = useState<ProfileAnchors>(defaultProfileAnchors());
  const [active, setActive] = useState<ProfileAnchorKey>("glabella");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStage({ kind: "camera", countdown: null });
    } catch {
      setStage({
        kind: "camera-error",
        message: "Camera blocked — upload a side photo instead.",
      });
    }
  }, []);

  // You can't watch the screen while facing 90° away from it, so capture
  // runs on a countdown.
  const beginCountdown = useCallback(() => {
    let n = 3;
    setStage({ kind: "camera", countdown: n });
    const iv = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setStage({ kind: "camera", countdown: n });
        return;
      }
      clearInterval(iv);
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      stopCamera();
      setStage({ kind: "place", photo: downscaleToDataURL(canvas, 768) });
    }, 1000);
  }, [stopCamera]);

  const onUpload = useCallback(async (file: File) => {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
    setStage({ kind: "place", photo: downscaleToDataURL(canvas, 768) });
  }, []);

  const save = useCallback(() => {
    if (stage.kind !== "place" || !attachId) return;
    const scan = getScan(attachId);
    if (!scan) return;
    const results = analyzeProfile(anchors, loadProfile().sex);
    updateScan(attachId, {
      side: { photo: stage.photo, anchors, results, at: Date.now() },
    });
    router.push(`/results/${attachId}#side`);
  }, [stage, anchors, attachId, router]);

  if (!attachId) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-10 text-center flex flex-col gap-4">
        <p className="text-ink-2">A side profile attaches to a front scan — run one first.</p>
        <Link href="/scan" className="gold-gradient self-center rounded-full px-6 py-3 text-sm uppercase tracking-[0.15em] font-semibold">
          Front Scan
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link href={`/results/${attachId}`} className="text-sm text-ink-2 hover:text-ink">
          ← Results
        </Link>
        <span className="label-caps">Side Profile</span>
        <span className="w-12" />
      </header>

      {stage.kind !== "place" ? (
        <>
          <div className="card relative overflow-hidden aspect-[4/5]">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover -scale-x-100"
              style={{ display: stage.kind === "camera" ? "block" : "none" }}
            />
            {stage.kind === "camera" && stage.countdown !== null && (
              <div className="absolute inset-0 grid place-items-center bg-bg/40">
                <span className="numeral text-7xl">{stage.countdown}</span>
              </div>
            )}
            {stage.kind !== "camera" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                {stage.kind === "camera-error" ? (
                  <p className="text-sm text-work">{stage.message}</p>
                ) : (
                  <>
                    <p className="font-display text-2xl">Turn fully sideways</p>
                    <p className="text-sm text-ink-2 max-w-[34ch]">
                      A true 90° profile, ear toward the camera, hair off the
                      forehead and jaw. A 3-second timer fires the capture so
                      you don&apos;t need to see the screen.
                    </p>
                  </>
                )}
                <button
                  onClick={() => void startCamera()}
                  className="gold-gradient rounded-full px-8 py-3 text-sm font-semibold tracking-[0.15em] uppercase"
                >
                  Start Camera
                </button>
                <label className="cursor-pointer text-sm text-gold underline underline-offset-4">
                  or upload a side photo
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
          </div>
          {stage.kind === "camera" && stage.countdown === null && (
            <button
              onClick={beginCountdown}
              className="gold-gradient rounded-full py-4 text-sm font-semibold tracking-[0.15em] uppercase"
            >
              Capture in 3…
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            Drag each gold point onto the feature —{" "}
            <span className="text-gold">
              {PROFILE_ANCHOR_LABELS[active].label.toLowerCase()}
            </span>
            : {PROFILE_ANCHOR_LABELS[active].hint}.
          </p>
          <AnchorEditor
            photo={stage.photo}
            anchors={anchors}
            active={active}
            onSelect={setActive}
            onMove={(key, x, y) =>
              setAnchors((prev) => ({ ...prev, [key]: { x, y } }))
            }
          />
          <div className="grid grid-cols-4 gap-1.5">
            {PROFILE_ANCHOR_ORDER.map((k) => (
              <button
                key={k}
                onClick={() => setActive(k)}
                className={`card px-1 py-2 text-[0.65rem] uppercase tracking-wide ${
                  active === k ? "border-gold/70 text-ink" : "text-ink-3"
                }`}
              >
                {PROFILE_ANCHOR_LABELS[k].label}
              </button>
            ))}
          </div>
          <button
            onClick={save}
            className="gold-gradient rounded-full py-4 text-sm font-semibold tracking-[0.15em] uppercase"
          >
            Analyze Profile
          </button>
          <p className="text-center text-xs text-ink-3">
            Side analysis uses these eight points and pure geometry — the face
            mesh can&apos;t see a true profile, so we don&apos;t pretend it can.
          </p>
        </>
      )}
    </main>
  );
}

function AnchorEditor({
  photo,
  anchors,
  active,
  onSelect,
  onMove,
}: {
  photo: string;
  anchors: ProfileAnchors;
  active: ProfileAnchorKey;
  onSelect: (k: ProfileAnchorKey) => void;
  onMove: (k: ProfileAnchorKey, x: number, y: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragKey = useRef<ProfileAnchorKey | null>(null);

  const toNorm = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  return (
    <div className="card relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="Side profile" className="w-full" draggable={false} />
      <svg
        ref={svgRef}
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full touch-none"
        onPointerMove={(e) => {
          if (!dragKey.current) return;
          const p = toNorm(e);
          onMove(dragKey.current, p.x, p.y);
        }}
        onPointerUp={() => (dragKey.current = null)}
        onPointerLeave={() => (dragKey.current = null)}
      >
        {/* E-line preview: nose tip → chin front */}
        <line
          x1={anchors.pronasale.x}
          y1={anchors.pronasale.y}
          x2={anchors.pogonion.x}
          y2={anchors.pogonion.y}
          stroke="#ead0a4"
          strokeOpacity="0.5"
          strokeWidth="0.004"
          strokeDasharray="0.02 0.012"
        />
        {PROFILE_ANCHOR_ORDER.map((k) => {
          const p = anchors[k];
          const isActive = k === active;
          return (
            <g key={k}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isActive ? 0.028 : 0.018}
                fill="none"
                stroke={isActive ? "#ead0a4" : "rgba(234,208,164,0.55)"}
                strokeWidth="0.006"
              />
              <circle cx={p.x} cy={p.y} r="0.005" fill="#ead0a4" />
              <circle
                cx={p.x}
                cy={p.y}
                r="0.06"
                fill="transparent"
                className="cursor-grab"
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture(e.pointerId);
                  dragKey.current = k;
                  onSelect(k);
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
