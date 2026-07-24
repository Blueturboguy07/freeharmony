"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Sex } from "@freeharmony/engine";
import {
  loadProfile,
  loadScans,
  nukeAllData,
  saveProfile,
  type Profile,
} from "@/lib/store";
import { AiSettings } from "@/components/AiSettings";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [confirmNuke, setConfirmNuke] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  if (!profile) return null;

  const update = (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    saveProfile(next);
  };

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-2 hover:text-ink">
          ← Home
        </Link>
        <span className="label-caps">Settings</span>
        <span className="w-12" />
      </header>

      <section className="card p-5 flex flex-col gap-3">
        <p className="label-caps">Score against</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["masculine", "Masculine"],
              ["neutral", "Neutral"],
              ["feminine", "Feminine"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => update({ sex: value as Sex })}
              className={`card py-3 text-sm ${profile.sex === value ? "border-gold/70" : "text-ink-2"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3">
          Applies to new scans. Neutral uses the union of both reference
          ranges, so it never penalizes you for not declaring.
        </p>
      </section>

      <AiSettings />

      <section className="card p-5 flex flex-col gap-3">
        <p className="label-caps">Your data</p>
        <button
          onClick={() => {
            const data = {
              profile: loadProfile(),
              scans: loadScans(),
              exportedAt: new Date().toISOString(),
            };
            const a = document.createElement("a");
            a.href = URL.createObjectURL(
              new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
            );
            a.download = "freeharmony-export.json";
            a.click();
          }}
          className="card py-3 text-sm text-ink-2 hover:text-ink"
        >
          Export everything (JSON)
        </button>
        {!confirmNuke ? (
          <button
            onClick={() => setConfirmNuke(true)}
            className="card py-3 text-sm text-danger/80 hover:text-danger"
          >
            Delete all local data…
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                nukeAllData();
                window.location.href = "/welcome";
              }}
              className="flex-1 rounded-card bg-danger/20 py-3 text-sm text-danger"
            >
              Yes, delete everything
            </button>
            <button
              onClick={() => setConfirmNuke(false)}
              className="card flex-1 py-3 text-sm text-ink-2"
            >
              Keep it
            </button>
          </div>
        )}
        <p className="text-xs text-ink-3">
          Everything lives in this browser&apos;s storage. Deleting is instant and
          unrecoverable — there is no server copy to restore from.
        </p>
      </section>

      <p className="text-center text-xs text-ink-3">
        FreeHarmony is open source (AGPL-3.0).{" "}
        <a
          href="https://github.com/Blueturboguy07/freeharmony"
          className="underline underline-offset-4"
        >
          Read the code
        </a>
        .
      </p>
    </main>
  );
}
