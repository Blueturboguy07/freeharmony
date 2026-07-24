"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteScan, loadScans, type StoredScan } from "@/lib/store";
import { ScoreRing } from "@/components/ScoreRing";

export default function ProgressPage() {
  const [scans, setScans] = useState<StoredScan[]>([]);

  useEffect(() => {
    setScans(loadScans());
  }, []);

  const scored = scans
    .filter((s) => s.result.overall !== null)
    .slice()
    .reverse(); // oldest → newest for the sparkline

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-2 hover:text-ink">
          ← Home
        </Link>
        <span className="label-caps">Your Progress</span>
        <span className="w-12" />
      </header>

      {scored.length >= 2 && (
        <div className="card p-5">
          <p className="label-caps mb-3">Harmony over time</p>
          <Sparkline values={scored.map((s) => s.result.overall!)} />
        </div>
      )}

      {scans.length === 0 ? (
        <div className="card p-8 text-center flex flex-col gap-4">
          <p className="text-ink-2">No scans on this device yet.</p>
          <Link href="/scan" className="gold-gradient self-center rounded-full px-6 py-3 text-sm uppercase tracking-[0.15em] font-semibold">
            First Scan
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-10">
          {scans.map((s) => (
            <div key={s.id} className="card flex items-center gap-4 px-4 py-3">
              {s.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.photo}
                  alt=""
                  className="h-14 w-14 rounded-xl object-cover"
                />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-surface-raised" />
              )}
              <div className="flex-1">
                <p className="numeral text-xl">
                  {s.result.overall !== null ? `${s.result.overall.toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-ink-3">
                  {new Date(s.createdAt).toLocaleString()}
                </p>
              </div>
              <Link href={`/results/${s.id}`} className="text-sm text-gold">
                Open
              </Link>
              <button
                onClick={() => {
                  deleteScan(s.id);
                  setScans(loadScans());
                }}
                className="text-sm text-ink-3 hover:text-danger"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const W = 300;
  const H = 64;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? W / 2 : (i / (values.length - 1)) * W;
    const y = H - ((v - min) / (max - min)) * H;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="#ead0a4"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => {
        const [x, y] = p.split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="3" fill="#c9a06b" />;
      })}
    </svg>
  );
}
