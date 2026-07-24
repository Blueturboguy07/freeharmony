"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchBoard,
  getSupabase,
  submitScore,
  type LeaderboardRow,
} from "@/lib/supabase";
import { loadProfile, loadScans, saveProfile } from "@/lib/store";

export default function LeaderboardPage() {
  const configured = getSupabase() !== null;
  const [scope, setScope] = useState<"all" | "weekly">("all");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "busy" | "done">("idle");

  const refresh = useCallback(async (s: "all" | "weekly") => {
    if (!configured) return;
    setRows(null);
    try {
      setRows(await fetchBoard(s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [configured]);

  useEffect(() => {
    setNickname(loadProfile().nickname ?? "");
    void refresh(scope);
  }, [scope, refresh]);

  const best = loadBest();

  const submit = async () => {
    if (!best) return;
    setSubmitState("busy");
    setError(null);
    try {
      await submitScore({
        nickname: nickname.trim(),
        overall: best.overall,
        areas: best.areas,
        sex: best.sex,
        engineVersion: best.engineVersion,
      });
      saveProfile({ ...loadProfile(), nickname: nickname.trim() });
      setSubmitState("done");
      void refresh(scope);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setSubmitState("idle");
    }
  };

  const nickOk = /^[A-Za-z0-9_ ]{3,20}$/.test(nickname.trim());

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-2 hover:text-ink">
          ← Home
        </Link>
        <span className="label-caps">Leaderboard</span>
        <span className="w-12" />
      </header>

      {!configured ? (
        <div className="card p-8 text-center text-sm text-ink-2">
          This deployment doesn&apos;t have a leaderboard backend configured.
          Self-hosting? Set NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY, and run the included migration.
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            Opt-in and for fun: entries are self-reported scores from
            client-side math — a nickname and numbers, never a photo.
          </p>

          {/* Submit */}
          {best && submitState !== "done" && (
            <div className="card p-5 flex flex-col gap-3">
              <p className="label-caps">
                Submit your best score ·{" "}
                <span className="numeral text-gold">{best.overall.toFixed(1)}%</span>
              </p>
              <div className="flex gap-2">
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Nickname (3–20 chars)"
                  className="flex-1 rounded-chip border border-line bg-surface-raised px-3 py-2 text-sm"
                  maxLength={20}
                  spellCheck={false}
                />
                <button
                  onClick={() => void submit()}
                  disabled={!nickOk || submitState === "busy"}
                  className="gold-gradient rounded-chip px-5 text-sm font-semibold uppercase tracking-wider disabled:opacity-50"
                >
                  {submitState === "busy" ? "…" : "Submit"}
                </button>
              </div>
              <p className="text-xs text-ink-3">
                Submitting sends: nickname, scores, presentation setting. Nothing else.
              </p>
            </div>
          )}
          {submitState === "done" && (
            <div className="card border-ideal/40 p-4 text-sm text-ideal">
              Score submitted. Welcome to the board.
            </div>
          )}

          {/* Scope tabs */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["all", "All Time"],
                ["weekly", "This Week"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setScope(value)}
                className={`card py-2.5 text-sm uppercase tracking-[0.15em] ${scope === value ? "border-gold/70" : "text-ink-2"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex flex-col gap-2 pb-10">
            {rows === null ? (
              <p className="label-caps animate-pulse py-6 text-center">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-2">
                Nobody here yet. Be first.
              </p>
            ) : (
              rows.map((r, i) => (
                <div key={`${r.nickname}-${i}`} className="card flex items-center gap-4 px-4 py-3">
                  <span className="numeral w-8 text-lg text-ink-2">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{r.nickname}</span>
                  <span className="numeral text-xl text-gold">
                    {Number(r.overall_score).toFixed(1)}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}

function loadBest() {
  const scans = loadScans().filter((s) => s.result.overall !== null);
  if (scans.length === 0) return null;
  const best = scans.reduce((a, b) =>
    (b.result.overall ?? 0) > (a.result.overall ?? 0) ? b : a,
  );
  const areas: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(best.result.areas)) areas[k] = v.score;
  return {
    overall: best.result.overall!,
    areas,
    sex: best.result.sex,
    engineVersion: best.result.engineVersion,
  };
}
