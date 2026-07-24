"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { generatePlan, type Plan } from "@freeharmony/advice";
import { getScan, loadProfile, type StoredScan } from "@/lib/store";

const CATEGORY_ICON: Record<string, string> = {
  photography: "📷",
  "body-composition": "⚖",
  posture: "🧍",
  skincare: "✦",
  hair: "✂",
  brows: "⌒",
  beard: "▽",
  teeth: "◡",
  lifestyle: "☾",
};

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [scan, setScan] = useState<StoredScan | null | undefined>(undefined);
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    const s = getScan(id) ?? null;
    setScan(s);
    if (s?.result.ok) {
      setPlan(generatePlan(s.result, loadProfile().sex));
    }
  }, [id]);

  if (scan === undefined) {
    return <main className="p-10 text-center label-caps animate-pulse">Loading…</main>;
  }
  if (!scan || !plan) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-10 text-center flex flex-col gap-4">
        <p>No plan available — run a scan first.</p>
        <Link href="/scan" className="gold-gradient self-center rounded-full px-6 py-3 text-sm uppercase tracking-[0.15em] font-semibold">
          New Scan
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link href={`/results/${scan.id}`} className="text-sm text-ink-2 hover:text-ink">
          ← Results
        </Link>
        <span className="label-caps">Improvement Plan</span>
        <span className="w-12" />
      </header>

      <p className="text-sm text-ink-2">
        Ranked by measured deficit × realistic leverage. All of it is
        non-invasive and reversible; none of it is medical advice.
      </p>

      <div className="flex flex-col gap-3">
        {plan.items.map((item, i) => (
          <div key={item.rule.id} className="card p-5 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold/10">
                {CATEGORY_ICON[item.rule.category] ?? "•"}
              </span>
              <div className="flex-1">
                <p className="font-medium">
                  {i + 1}. {item.rule.title}
                </p>
                <p className="text-xs text-ink-3 uppercase tracking-wider">
                  {item.rule.timeline === "immediate"
                    ? "works immediately"
                    : `takes ${item.rule.timeline}`}
                </p>
              </div>
            </div>
            <p className="text-sm text-ink-2">{item.rule.body}</p>
            <p className="text-xs text-gold/80">{item.reason}</p>
            <p className="text-xs text-ink-3">{item.rule.impactNote}</p>
          </div>
        ))}
      </div>

      <div className="card border-work/30 p-5 flex flex-col gap-2">
        <p className="label-caps text-work">What we won&apos;t advise</p>
        {plan.safetyNotes.map((n, i) => (
          <p key={i} className="text-sm text-ink-2">
            {n}
          </p>
        ))}
      </div>
    </main>
  );
}
