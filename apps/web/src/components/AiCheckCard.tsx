"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAiConfig, runDeepReport, runSanityCheck } from "@/lib/ai";
import { loadProfile, updateScan, type StoredScan } from "@/lib/store";

/**
 * AI second-opinion panel on the results screen. Invariant enforced upstream:
 * the AI annotation can mute the displayed confidence and recommend a retake,
 * but the deterministic score itself is never altered.
 */
export function AiCheckCard({
  scan,
  onScanUpdated,
}: {
  scan: StoredScan;
  onScanUpdated: (s: StoredScan) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState<"sanity" | "report" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    setEnabled(loadAiConfig().provider !== "none");
  }, []);

  const sanity = scan.ai?.sanity;
  const report = scan.ai?.report;

  const runCheck = async () => {
    setBusy("sanity");
    setError(null);
    try {
      const annotation = await runSanityCheck(scan);
      const next = updateScan(scan.id, { ai: { ...scan.ai, sanity: annotation } });
      if (next) onScanUpdated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(null);
    }
  };

  const runReport = async () => {
    setBusy("report");
    setError(null);
    try {
      const profile = loadProfile();
      const r = await runDeepReport(scan, profile.sex, profile.ageRange);
      const next = updateScan(scan.id, { ai: { ...scan.ai, report: r } });
      if (next) {
        onScanUpdated(next);
        setShowReport(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed");
    } finally {
      setBusy(null);
    }
  };

  if (!enabled) {
    return (
      <div className="card px-5 py-4 text-sm text-ink-2 flex items-center justify-between gap-3">
        <span>
          Want an AI cross-check of this scan? Connect your own provider — we
          never see your photo.
        </span>
        <Link href="/settings" className="shrink-0 text-gold">
          Set up →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sanity && (
        <div
          className={`card p-4 text-sm flex flex-col gap-2 ${
            sanity.confidence === "low"
              ? "border-danger/50"
              : sanity.confidence === "medium"
                ? "border-work/40"
                : "border-ideal/30"
          }`}
        >
          <p className="label-caps">
            Second opinion ·{" "}
            <span
              className={
                sanity.confidence === "low"
                  ? "text-danger"
                  : sanity.confidence === "medium"
                    ? "text-work"
                    : "text-ideal"
              }
            >
              {sanity.confidence} confidence
            </span>
          </p>
          {sanity.confidence === "low" ? (
            <>
              <p>
                This scan looks unreliable — the AI&apos;s independent read
                differs from the measured score by{" "}
                <span className="numeral">{sanity.delta.toFixed(0)}</span> points
                {sanity.suspectMetrics.length > 0 &&
                  `, and it flagged: ${sanity.suspectMetrics.join(", ")}`}
                . We recommend retaking the photo rather than trusting either
                number.
              </p>
              {sanity.check.photoQuality.flags.length > 0 && (
                <p className="text-ink-2">
                  Photo issues: {sanity.check.photoQuality.flags.join(", ")}
                </p>
              )}
              <div className="flex gap-2">
                <Link
                  href="/scan"
                  className="gold-gradient rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em]"
                >
                  Retake
                </Link>
              </div>
            </>
          ) : sanity.confidence === "medium" ? (
            <p className="text-ink-2">
              The AI&apos;s independent estimate differs slightly (Δ
              {sanity.delta.toFixed(0)}). The measured score stands; treat the
              decimals loosely.
            </p>
          ) : (
            <p className="text-ink-2">
              Independent AI estimate agrees with the measurement (Δ
              {sanity.delta.toFixed(0)}). Landmarks look correctly placed.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => void runCheck()}
          disabled={busy !== null}
          className="card flex-1 py-3 text-sm text-ink-2 hover:text-ink disabled:opacity-50"
        >
          {busy === "sanity" ? "Checking…" : sanity ? "Re-run AI check" : "AI sanity check"}
        </button>
        <button
          onClick={() => (report ? setShowReport(!showReport) : void runReport())}
          disabled={busy !== null}
          className="card flex-1 py-3 text-sm text-ink-2 hover:text-ink disabled:opacity-50"
        >
          {busy === "report" ? "Writing…" : report ? (showReport ? "Hide report" : "Show report") : "AI deep report"}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      {showReport && report && (
        <div className="card p-5 text-sm leading-relaxed whitespace-pre-wrap">
          {report.text}
          <p className="mt-4 text-xs text-ink-3">
            Generated by {report.model} · {new Date(report.at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
