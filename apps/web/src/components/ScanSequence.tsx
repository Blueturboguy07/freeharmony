"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pt, ScanResult } from "@freeharmony/engine";
import { LANDMARKS } from "@freeharmony/engine";

/**
 * Staged biometric-scan reveal. The actual computation finished before this
 * mounts (<1s); this choreographs the reveal so the work is legible:
 *   A  0–900ms    acquiring — scanline sweeps, corner reticle
 *   B  900–2600   landmarking — 478 dots land in 8 anatomical clusters,
 *                 constellation paths draw on
 *   C  2600–4300  computing — real metric vocabulary cycles, values
 *                 scramble-resolve to the true numbers
 *   D  4300–5600  reveal — score ring draws, odometer count-up, landing pulse
 * Honesty rule: every number shown is the real computed value — the staging
 * is theatrical, the data is not.
 * Repeat scans compress to ~2.2s; prefers-reduced-motion collapses to ~1s
 * of opacity-only fades (status text kept — it carries the trust, not motion).
 */

const TOTAL = 5600;
const PHASE_B = 900;
const PHASE_C = 2600;
const PHASE_D = 4300;

// Ordered rings/chains from the public MediaPipe topology, curated down to
// ~10 constellation paths (the full tessellation is noise at this size).
const RIGHT_EYE_RING = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
const LEFT_EYE_RING = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263];
const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61];
const NOSE_BRIDGE = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 2];

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

const STATUS_STEPS = [
  "Mapping facial proportions",
  "Measuring canthal tilt",
  "Computing symmetry index",
  "Cross-referencing ideal bands",
  "Finalizing harmony index",
];

const SCRAMBLE_CHARS = "0123456789";

interface RowSpec {
  label: string;
  value: string;
}

export function ScanSequence({
  photo,
  landmarks,
  result,
  onDone,
}: {
  photo: string;
  landmarks: Pt[];
  result: ScanResult;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const doneRef = useRef(false);
  const buzzedRef = useRef({ c: false, d: false });

  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const repeat = useMemo(
    () =>
      typeof window !== "undefined" &&
      sessionStorage.getItem("fh.scanAnimSeen") === "1",
    [],
  );
  // Reduced motion: ~1s opacity-only. Repeat scan: compressed ~2.2s.
  const speed = reduced ? 5.2 : repeat ? 2.5 : 1;

  const rows: RowSpec[] = useMemo(() => {
    const wanted = [
      "overallSymmetry",
      "canthalTilt",
      "midLowerThird",
      "jawAngularity",
      "midfaceRatio",
      "eyeSeparationRatio",
    ];
    return wanted
      .map((k) => result.metrics.find((m) => m.key === k))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .map((m) => ({
        label: m.label,
        value:
          m.unit === "deg"
            ? `${m.value.toFixed(1)}°`
            : m.unit === "index"
              ? m.value.toFixed(1)
              : m.value.toFixed(2),
      }));
  }, [result]);

  // Per-dot cluster assignment with deterministic jitter.
  const dots = useMemo(() => {
    if (landmarks.length === 0) return [];
    const L = LANDMARKS;
    const used = new Set<number>();
    const clusters: number[][] = [];
    const add = (idx: readonly number[]) => {
      clusters.push(idx.filter((i) => i < landmarks.length && !used.has(i)));
      for (const i of idx) used.add(i);
    };
    add(L.FACE_OVAL);
    add([...L.R_BROW_SUP, ...L.R_BROW_INF, ...L.L_BROW_SUP, ...L.L_BROW_INF]);
    add([...RIGHT_EYE_RING, ...LEFT_EYE_RING, 468, 473]);
    add([...NOSE_BRIDGE, L.R_ALARE, L.L_ALARE, 98, 327]);
    add(LIPS_OUTER);
    // Remaining mesh split into 3 vertical bands (forehead → mid → lower).
    const rest: number[] = [];
    for (let i = 0; i < landmarks.length; i++) if (!used.has(i)) rest.push(i);
    rest.sort((a, b) => landmarks[a]!.y - landmarks[b]!.y);
    const third = Math.ceil(rest.length / 3);
    clusters.push(rest.slice(0, third), rest.slice(third, 2 * third), rest.slice(2 * third));

    const CLUSTER_SPAN = (PHASE_C - PHASE_B) / clusters.length; // ≈212ms
    const out: Array<{ i: number; x: number; y: number; start: number }> = [];
    clusters.forEach((cluster, ci) => {
      cluster.forEach((i, j) => {
        // Deterministic jitter from index — no Math.random, replayable.
        const jitter = ((i * 2654435761) >>> 16) % 60;
        out.push({
          i,
          x: landmarks[i]!.x,
          y: landmarks[i]!.y,
          start: PHASE_B + ci * CLUSTER_SPAN + (j % 8) * 6 + jitter,
        });
      });
    });
    return out;
  }, [landmarks]);

  const paths = useMemo(() => {
    if (landmarks.length === 0) return [];
    const L = LANDMARKS;
    const mk = (idx: readonly number[], start: number) => ({
      d:
        "M " +
        idx
          .filter((i) => i < landmarks.length)
          .map((i) => `${(landmarks[i]!.x * 100).toFixed(2)},${(landmarks[i]!.y * 100).toFixed(2)}`)
          .join(" L "),
      start,
    });
    return [
      mk([...L.FACE_OVAL, L.FACE_OVAL[0]!], PHASE_B + 200),
      mk(L.R_BROW_SUP, PHASE_B + 420),
      mk(L.L_BROW_SUP, PHASE_B + 420),
      mk(RIGHT_EYE_RING, PHASE_B + 640),
      mk(LEFT_EYE_RING, PHASE_B + 640),
      mk(NOSE_BRIDGE, PHASE_B + 860),
      mk(LIPS_OUTER, PHASE_B + 1080),
      mk(L.MANDIBLE_CONTOUR, PHASE_B + 1300),
    ];
  }, [landmarks]);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = photo;
  }, [photo]);

  // The one clock. Everything derives from elapsed — frame drops can't
  // desync phases, and speed multipliers just scale time.
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const e = (now - t0) * speed;
      setElapsed(e);
      if (e >= PHASE_C && !buzzedRef.current.c) {
        buzzedRef.current.c = true;
        navigator.vibrate?.(12);
      }
      if (e >= PHASE_D + 900 && !buzzedRef.current.d) {
        buzzedRef.current.d = true;
        navigator.vibrate?.(15);
      }
      if (e >= TOTAL + 500 && !doneRef.current) {
        doneRef.current = true;
        sessionStorage.setItem("fh.scanAnimSeen", "1");
        onDone();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed, onDone]);

  // Canvas: photo treatment + landmark dots.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !img) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;

    // Photo: desaturated + dim during acquisition, restored during landmarking.
    const restore = clamp01((elapsed - PHASE_B) / 500);
    ctx.filter = `saturate(${0.7 + 0.3 * restore}) brightness(${0.62 + 0.38 * restore})`;
    ctx.drawImage(img, 0, 0, W, H);
    ctx.filter = "none";

    if (reduced) return; // dots/scanline are motion — skip entirely

    // Dots (phase B onward, ghosting in phase D).
    const ghost = elapsed > PHASE_D ? 1 - 0.85 * clamp01((elapsed - PHASE_D) / 300) : 1;
    ctx.save();
    ctx.shadowColor = "rgba(234, 208, 164, 0.9)";
    for (const dot of dots) {
      const t = clamp01((elapsed - dot.start) / 180);
      if (t <= 0) continue;
      const pop = easeOutBack(t);
      const r = (W / 340) * pop;
      ctx.globalAlpha = t * ghost;
      ctx.shadowBlur = 6 * pop;
      ctx.fillStyle = "#ead0a4";
      ctx.beginPath();
      ctx.arc(dot.x * W, dot.y * H, Math.max(r, 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }, [elapsed, img, dots, reduced]);

  const inA = elapsed < PHASE_B;
  const statusIdx = Math.min(
    STATUS_STEPS.length - 1,
    Math.floor(((elapsed - PHASE_C) / (PHASE_D - PHASE_C)) * STATUS_STEPS.length),
  );
  const ringT = clamp01((elapsed - PHASE_D) / 900);
  const ringEased = easeOutQuint(ringT);
  const overall = result.overall ?? 0;
  const shownScore = overall * ringEased;
  const landed = ringT >= 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg px-5">
      <div
        ref={wrapRef}
        className="relative w-full max-w-sm overflow-hidden rounded-card border border-line"
        style={{ aspectRatio: "4 / 5" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* Corner reticle + scanline (phase A) */}
        {!reduced && inA && (
          <>
            <Reticle />
            <div
              className="pointer-events-none absolute inset-x-0 h-10 fh-scanline"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, rgba(234,208,164,0.75) 45%, rgba(234,208,164,0.75) 55%, transparent)",
                filter: "blur(2px)",
              }}
            />
          </>
        )}

        {/* Constellation paths (phase B+, ghosted in D) */}
        {!reduced && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ opacity: elapsed > PHASE_D ? 0.15 : 0.85 }}
          >
            {paths.map((p, i) => {
              const t = clamp01((elapsed - p.start) / 380);
              if (t <= 0) return null;
              return (
                <path
                  key={i}
                  d={p.d}
                  fill="none"
                  stroke="#ead0a4"
                  strokeWidth="0.35"
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset={1 - easeOutQuint(t)}
                  vectorEffect="non-scaling-stroke"
                  style={{ strokeWidth: 1.2 }}
                />
              );
            })}
          </svg>
        )}

        {/* Score ring (phase D) */}
        {elapsed >= PHASE_D && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-bg/55 backdrop-blur-[2px]"
            style={{ opacity: clamp01((elapsed - PHASE_D) / 250) }}
          >
            <div
              className="relative"
              style={{
                transform: landed ? "scale(1)" : undefined,
                animation: landed ? "fh-land 240ms cubic-bezier(0.16,1,0.3,1)" : undefined,
              }}
            >
              <svg width="168" height="168" className="-rotate-90">
                <circle cx="84" cy="84" r="74" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                <circle
                  cx="84"
                  cy="84"
                  r="74"
                  fill="none"
                  stroke="url(#seqGold)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray="100"
                  strokeDashoffset={100 - shownScore}
                  style={landed ? { filter: "drop-shadow(0 0 10px rgba(234,208,164,0.6))" } : undefined}
                />
                <defs>
                  <linearGradient id="seqGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ead0a4" />
                    <stop offset="100%" stopColor="#c9a06b" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="numeral text-4xl">{shownScore.toFixed(1)}</span>
                <span className="label-caps">harmony</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status + computing rows */}
      <div className="mt-6 w-full max-w-sm">
        <p
          key={elapsed < PHASE_C ? (inA ? "acq" : "lmk") : `s${statusIdx}`}
          className="fh-status text-center font-mono text-[0.7rem] uppercase tracking-[0.25em] text-ink-2"
        >
          {elapsed < PHASE_B
            ? "Acquiring image"
            : elapsed < PHASE_C
              ? "Locating 478 landmarks"
              : elapsed < PHASE_D
                ? STATUS_STEPS[statusIdx]
                : landed
                  ? "Complete"
                  : "Resolving harmony index"}
        </p>

        {elapsed >= PHASE_C && elapsed < PHASE_D + 250 && (
          <div className="mt-4 flex flex-col gap-1.5">
            {rows.map((row, i) => (
              <ScrambleRow
                key={row.label}
                label={row.label}
                value={row.value}
                t={clamp01((elapsed - (PHASE_C + 120 + i * 170)) / 460)}
                reduced={reduced}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function Reticle() {
  const corner = "absolute h-7 w-7 border-gold-hi/70";
  return (
    <div className="pointer-events-none absolute inset-3 opacity-60">
      <span className={`${corner} left-0 top-0 border-l-2 border-t-2 rounded-tl-md`} />
      <span className={`${corner} right-0 top-0 border-r-2 border-t-2 rounded-tr-md`} />
      <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md`} />
      <span className={`${corner} bottom-0 right-0 border-b-2 border-r-2 rounded-br-md`} />
    </div>
  );
}

/** Value resolves via decelerating digit-scramble; underline tick syncs to lock. */
function ScrambleRow({
  label,
  value,
  t,
  reduced,
}: {
  label: string;
  value: string;
  t: number;
  reduced: boolean;
}) {
  if (t <= 0) return <div className="h-6" />;
  let shown = value;
  if (!reduced && t < 1) {
    // Deterministic scramble: digits swap based on quantized time so the
    // rate visibly decelerates into the lock.
    const step = Math.floor(t * 14);
    shown = value
      .split("")
      .map((ch, i) => {
        if (!/[0-9]/.test(ch)) return ch;
        const settled = t > 0.55 + (i / value.length) * 0.4;
        if (settled) return ch;
        return SCRAMBLE_CHARS[(step * 7 + i * 13) % 10];
      })
      .join("");
  }
  return (
    <div className="flex items-baseline justify-between" style={{ opacity: Math.min(1, t * 3) }}>
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-ink-3">{label}</span>
      <span className="relative">
        <span className={`numeral text-sm ${t >= 1 ? "text-gold" : "text-ink-2"}`}>{shown}</span>
        <span
          className="absolute -bottom-0.5 left-0 h-px bg-gold/50"
          style={{ width: `${easeOutQuint(clamp01(t * 1.2)) * 100}%` }}
        />
      </span>
    </div>
  );
}
