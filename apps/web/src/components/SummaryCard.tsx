"use client";

import { useEffect, useState } from "react";
import { generateSummary } from "@freeharmony/advice";
import { loadAiConfig, runAiSummary } from "@/lib/ai";
import { updateScan, type StoredScan } from "@/lib/store";

/**
 * "What do these numbers mean" — top of the results screen. The templated
 * summary renders instantly and offline; the AI version only rewords it
 * (numbers-only payload — no photo is sent for this call).
 */
export function SummaryCard({
  scan,
  onScanUpdated,
}: {
  scan: StoredScan;
  onScanUpdated: (s: StoredScan) => void;
}) {
  const [aiAvailable, setAiAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAiAvailable(loadAiConfig().provider !== "none");
  }, []);

  const aiText = scan.ai?.summary?.text;
  const text = aiText ?? generateSummary(scan.result);

  const enhance = async () => {
    setBusy(true);
    setError(null);
    try {
      const summary = await runAiSummary(scan);
      const next = updateScan(scan.id, { ai: { ...scan.ai, summary } });
      if (next) onScanUpdated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="label-caps">Summary</p>
        {aiAvailable && (
          <button
            onClick={() => void enhance()}
            disabled={busy}
            className="text-xs text-gold hover:text-gold-hi disabled:opacity-50"
          >
            {busy ? "Writing…" : aiText ? "↻ Regenerate" : "✦ Reword with AI"}
          </button>
        )}
      </div>
      <p className="text-sm leading-relaxed text-ink-2">{text}</p>
      {aiText && (
        <p className="text-xs text-ink-3">
          AI-worded ({scan.ai?.summary?.model}) from the measured numbers — the
          numbers themselves are untouched.
        </p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
