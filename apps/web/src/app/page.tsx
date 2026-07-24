"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AreaKey } from "@freeharmony/engine";
import { AREA_LABELS } from "@freeharmony/engine";
import { loadProfile, loadScans, type StoredScan } from "@/lib/store";
import { ScoreRing } from "@/components/ScoreRing";

const AREA_ORDER: AreaKey[] = ["symmetry", "jawline", "midface", "eyeArea"];

export default function Home() {
  const router = useRouter();
  const [last, setLast] = useState<StoredScan | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const profile = loadProfile();
    if (!profile.onboarded) {
      router.replace("/welcome");
      return;
    }
    const scans = loadScans();
    setCount(scans.length);
    setLast(scans.find((s) => s.result.overall !== null) ?? null);
  }, [router]);

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl">FreeHarmony</h1>
        <Link href="/settings" className="text-sm text-ink-2 hover:text-ink">
          Settings
        </Link>
      </header>

      {/* Hero scan card */}
      <section className="card relative overflow-hidden p-6 flex flex-col gap-4">
        <GoldenSpiral className="absolute -right-10 -top-10 h-64 w-64 opacity-[0.07]" />
        <h2 className="font-display text-[1.7rem] leading-tight max-w-[16ch]">
          Measure your facial harmony
        </h2>
        <p className="text-sm text-ink-2 max-w-[36ch]">
          Real landmark geometry, fully in your browser. Every metric free —
          no paywall, no fake scores, no photos leaving your device.
        </p>
        <Link
          href="/scan"
          className="gold-gradient self-start rounded-full px-8 py-3.5 text-sm font-semibold tracking-[0.15em] uppercase"
        >
          ◉ Start Scan
        </Link>
      </section>

      {/* Last score */}
      {last && last.result.overall !== null && (
        <Link href={`/results/${last.id}`} className="card px-5 py-4 flex items-center gap-4 hover:border-gold/40 transition-colors">
          <ScoreRing score={last.result.overall} decimals={1} size={64} />
          <div className="flex-1">
            <p className="label-caps mb-1">Last Harmony Score</p>
            <div className="grid grid-cols-4 gap-2">
              {AREA_ORDER.map((a) => (
                <div key={a}>
                  <p className="numeral text-lg">{last.result.areas[a].score ?? "—"}</p>
                  <p className="text-[0.6rem] uppercase tracking-wider text-ink-2">
                    {AREA_LABELS[a]}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <span className="text-ink-3">›</span>
        </Link>
      )}

      {/* Improvement plan */}
      {last && (
        <Link href={`/plan/${last.id}`} className="card px-5 py-4 flex items-center gap-4 hover:border-gold/40 transition-colors">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold">✦</div>
          <div className="flex-1">
            <p className="font-medium">Your improvement plan</p>
            <p className="text-sm text-ink-2">What to work on, in priority order</p>
          </div>
          <span className="text-ink-3">›</span>
        </Link>
      )}

      {/* Progress */}
      <Link href="/progress" className="card px-5 py-4 flex items-center gap-4 hover:border-gold/40 transition-colors">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold">↗</div>
        <div className="flex-1">
          <p className="font-medium">Your progress</p>
          <p className="text-sm text-ink-2">
            {count === 0 ? "No scans yet" : `${count} scan${count === 1 ? "" : "s"} on this device`}
          </p>
        </div>
        <span className="text-ink-3">›</span>
      </Link>

      {/* Leaderboard */}
      <Link href="/leaderboard" className="card px-5 py-4 flex items-center gap-4 hover:border-gold/40 transition-colors">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold">♛</div>
        <div className="flex-1">
          <p className="font-medium">Leaderboard</p>
          <p className="text-sm text-ink-2">Opt-in, scores only — never photos</p>
        </div>
        <span className="text-ink-3">›</span>
      </Link>

      <p className="mt-2 text-center text-xs text-ink-3">
        Free and open source (AGPL-3.0). Scores are photo-based estimates for
        self-improvement, not clinical measurements.
      </p>
    </main>
  );
}

/** Original golden-spiral motif, drawn from quarter-arcs. */
function GoldenSpiral({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="#ead0a4" strokeWidth="0.5">
      <rect x="2" y="2" width="96" height="96" />
      <line x1="61.3" y1="2" x2="61.3" y2="98" />
      <line x1="2" y1="61.3" x2="61.3" y2="61.3" />
      <line x1="38.6" y1="61.3" x2="38.6" y2="98" />
      <line x1="38.6" y1="75.3" x2="61.3" y2="75.3" />
      <path d="M 2 98 A 96 96 0 0 1 98 2" />
      <path d="M 98 2 A 59.3 59.3 0 0 1 61.3 61.3 A 22.7 22.7 0 0 1 38.6 75.3" />
    </svg>
  );
}
