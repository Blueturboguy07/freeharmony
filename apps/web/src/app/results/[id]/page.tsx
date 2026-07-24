"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  METRICS,
  round1,
  type MetricKey,
  type MetricResult,
  type ScanResult,
  type Tier,
} from "@freeharmony/engine";
import { AREA_LABELS, AREA_WEIGHTS } from "@freeharmony/engine";
import type { AreaKey } from "@freeharmony/engine";
import { reanalyze } from "@/lib/scan";
import { getScan, loadProfile, loadScans, saveScan, type StoredScan } from "@/lib/store";
import { ScoreRing } from "@/components/ScoreRing";

const TIER_LABEL: Record<Tier, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  "needs-work": "Needs Work",
};

const VERDICT_STYLE: Record<MetricResult["verdict"], { label: string; cls: string }> = {
  ideal: { label: "Ideal", cls: "text-ideal" },
  "near-ideal": { label: "Near Ideal", cls: "text-near" },
  "needs-work": { label: "Needs Work", cls: "text-work" },
};

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [scan, setScan] = useState<StoredScan | null | undefined>(undefined);
  const [selected, setSelected] = useState<MetricKey>("canthalTilt");
  const [adjusting, setAdjusting] = useState(false);
  const [draftOverrides, setDraftOverrides] = useState<Record<number, { x: number; y: number }>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setScan(getScan(id) ?? null);
  }, [id]);

  const result = scan?.result;
  const selectedDef = useMemo(
    () => METRICS.find((m) => m.key === selected) ?? METRICS[0]!,
    [selected],
  );
  const selectedMetric = result?.metrics.find((m) => m.key === selected);

  const applyOverrides = useCallback(async () => {
    if (!scan?.input) return;
    setBusy(true);
    try {
      const merged = { ...scan.overrides, ...draftOverrides };
      const profile = loadProfile();
      const next: ScanResult = await reanalyze(scan.input, scan.photo, profile.sex, merged);
      const updated: StoredScan = { ...scan, result: next, overrides: merged };
      saveScan(updated);
      // saveScan prepends; re-read the canonical copy to avoid duplicates
      const fresh = loadScans().find((s) => s.id === scan.id) ?? updated;
      setScan(fresh);
      setDraftOverrides({});
      setAdjusting(false);
    } finally {
      setBusy(false);
    }
  }, [scan, draftOverrides]);

  if (scan === undefined) {
    return <Shell title="Metrics Explorer"><p className="label-caps animate-pulse p-8 text-center">Loading…</p></Shell>;
  }
  if (scan === null || !result) {
    return (
      <Shell title="Metrics Explorer">
        <div className="card p-8 text-center flex flex-col gap-4">
          <p>This scan doesn&apos;t exist on this device.</p>
          <Link href="/scan" className="gold-gradient rounded-full px-6 py-3 text-sm font-semibold tracking-[0.15em] uppercase self-center">
            New Scan
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Metrics Explorer" shareScan={scan}>
      {/* Photo viewport with per-metric overlay */}
      <div className="card relative overflow-hidden">
        <PhotoOverlay
          photo={scan.photo}
          landmarks={scan.input?.landmarks ?? []}
          overlay={selectedDef.overlay}
          adjusting={adjusting}
          overrides={{ ...scan.overrides, ...draftOverrides }}
          onDrag={(idx, x, y) =>
            setDraftOverrides((prev) => ({ ...prev, [idx]: { x, y } }))
          }
        />
        {selectedMetric && (
          <div className="absolute bottom-3 left-3 rounded-chip bg-bg/80 backdrop-blur px-4 py-2 flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                selectedMetric.verdict === "ideal"
                  ? "bg-ideal"
                  : selectedMetric.verdict === "near-ideal"
                    ? "bg-near"
                    : "bg-work"
              }`}
            />
            <span className="label-caps">{selectedMetric.label}</span>
            <span className="numeral text-gold">{formatValue(selectedMetric)}</span>
          </div>
        )}
      </div>

      {/* Adjust points */}
      {scan.input && (
        <div className="flex gap-3">
          {!adjusting ? (
            <button
              onClick={() => setAdjusting(true)}
              className="card flex-1 py-3 text-sm tracking-[0.15em] uppercase text-ink-2 hover:text-ink"
            >
              ⊹ Adjust Points
            </button>
          ) : (
            <>
              <button
                onClick={() => void applyOverrides()}
                disabled={busy || Object.keys(draftOverrides).length === 0}
                className="gold-gradient flex-1 rounded-card py-3 text-sm font-semibold tracking-[0.15em] uppercase disabled:opacity-50"
              >
                {busy ? "Recomputing…" : "Save Points"}
              </button>
              <button
                onClick={() => {
                  setDraftOverrides({});
                  setAdjusting(false);
                }}
                className="card flex-1 py-3 text-sm tracking-[0.15em] uppercase text-ink-2"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
      {adjusting && (
        <p className="text-xs text-ink-3 -mt-2">
          Drag the gold points onto the correct spots for “{selectedDef.label}”,
          then save. The score recomputes with the same deterministic math.
        </p>
      )}

      {/* Overall harmony */}
      <div className="card flex items-center justify-between px-5 py-4">
        <div>
          <p className="label-caps">Overall Harmony</p>
          <p className="text-lg">{result.tier ? TIER_LABEL[result.tier] : "—"}</p>
        </div>
        <p className="numeral text-4xl">
          {result.overall?.toFixed(1)}
          <span className="text-xl text-ink-2">%</span>
        </p>
      </div>

      {/* Area sub-scores */}
      <div className="card grid grid-cols-4 gap-2 px-4 py-4">
        {(Object.keys(AREA_WEIGHTS) as AreaKey[]).map((area) => (
          <div key={area} className="flex flex-col items-center gap-1">
            <span className="numeral text-2xl">
              {result.areas[area].score ?? "—"}
            </span>
            <span className="text-[0.65rem] tracking-wider uppercase text-ink-2 text-center">
              {AREA_LABELS[area]}
            </span>
          </div>
        ))}
      </div>

      {/* Metric list */}
      <div className="flex flex-col gap-3 pb-10">
        {result.metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelected(m.key)}
            className={`card px-5 py-4 text-left transition-colors ${
              m.key === selected ? "border-gold/60" : "hover:border-line"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-medium">{m.label}</span>
              <span className="truncate text-xs text-ink-2">
                {bandText(m)}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="numeral text-2xl text-gold">{formatValue(m)}</span>
              <span className={`text-sm ${VERDICT_STYLE[m.verdict].cls}`}>
                {VERDICT_STYLE[m.verdict].label}
              </span>
              {m.confidence < 0.6 && (
                <span className="text-xs text-ink-3">low confidence</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </Shell>
  );
}

function Shell({
  title,
  children,
  shareScan,
}: {
  title: string;
  children: React.ReactNode;
  shareScan?: StoredScan;
}) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-2 hover:text-ink">
          ← Home
        </Link>
        <span className="label-caps">{title}</span>
        {shareScan ? <ShareButton scan={shareScan} /> : <span className="w-12" />}
      </header>
      {children}
    </main>
  );
}

function formatValue(m: MetricResult): string {
  if (m.unit === "deg") {
    const v = round1(m.value);
    return `${v > 0 && m.key === "canthalTilt" ? "+" : ""}${v.toFixed(1)}°`;
  }
  if (m.unit === "index") return round1(m.value).toFixed(1);
  return m.value.toFixed(2);
}

function bandText(m: MetricResult): string {
  const fmt = (v: number) =>
    m.unit === "deg" ? `${v}°` : m.unit === "index" ? `${v}` : v.toFixed(m.value >= 10 ? 0 : 3).replace(/0+$/, "").replace(/\.$/, "");
  return `${fmt(m.band.lo)} – ${fmt(m.band.hi)}`;
}

/** SVG landmark overlay on top of the scan photo. */
function PhotoOverlay({
  photo,
  landmarks,
  overlay,
  adjusting,
  overrides,
  onDrag,
}: {
  photo: string;
  landmarks: Array<{ x: number; y: number; z: number }>;
  overlay: { points: number[]; polylines: number[][] };
  adjusting: boolean;
  overrides: Record<number, { x: number; y: number }>;
  onDrag: (idx: number, x: number, y: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIdx = useRef<number | null>(null);

  const posOf = useCallback(
    (i: number): { x: number; y: number } | null => {
      const o = overrides[i];
      if (o) return o;
      const p = landmarks[i];
      return p ? { x: p.x, y: p.y } : null;
    },
    [landmarks, overrides],
  );

  const toNormalized = useCallback((e: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="Your scan" className="w-full" draggable={false} />
      {landmarks.length > 0 && (
        <svg
          ref={svgRef}
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full touch-none"
          onPointerMove={(e) => {
            if (dragIdx.current === null) return;
            const p = toNormalized(e);
            if (p) onDrag(dragIdx.current, p.x, p.y);
          }}
          onPointerUp={() => (dragIdx.current = null)}
          onPointerLeave={() => (dragIdx.current = null)}
        >
          {overlay.polylines.map((chain, ci) => {
            const pts = chain
              .map((i) => posOf(i))
              .filter((p): p is { x: number; y: number } => p !== null);
            if (pts.length < 2) return null;
            return (
              <polyline
                key={ci}
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#ead0a4"
                strokeWidth="0.004"
                strokeOpacity="0.9"
              />
            );
          })}
          {overlay.points.map((i) => {
            const p = posOf(i);
            if (!p) return null;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={adjusting ? 0.022 : 0.013} fill="none" stroke="#ead0a4" strokeWidth="0.006" />
                <circle cx={p.x} cy={p.y} r="0.004" fill="#ead0a4" />
                {adjusting && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="0.05"
                    fill="transparent"
                    className="cursor-grab"
                    onPointerDown={(e) => {
                      (e.target as Element).setPointerCapture(e.pointerId);
                      dragIdx.current = i;
                    }}
                  />
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** Compose a shareable score card and download it. */
function ShareButton({ scan }: { scan: StoredScan }) {
  const share = useCallback(async () => {
    const r = scan.result;
    if (r.overall === null) return;
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("decode"));
      img.src = scan.photo;
    });
    const W = 720;
    const H = Math.round((img.naturalHeight / img.naturalWidth) * W) + 180;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0c0a08";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H - 180);
    ctx.fillStyle = "#f2ede6";
    ctx.font = "600 22px Georgia, serif";
    ctx.fillText(`Harmony ${r.overall.toFixed(1)}%`, 28, H - 120);
    ctx.fillStyle = "#d8b888";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(
      `${r.tier ? TIER_LABEL[r.tier] : ""} · measured with open-source math`,
      28,
      H - 88,
    );
    ctx.fillStyle = "#8f8a82";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("freeharmony — every metric free, photos never leave your device", 28, H - 40);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "freeharmony-score.png";
    a.click();
  }, [scan]);

  return (
    <button onClick={() => void share()} className="text-sm text-ink-2 hover:text-ink">
      Share ↗
    </button>
  );
}
