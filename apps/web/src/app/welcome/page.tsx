"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Sex } from "@freeharmony/engine";
import { loadProfile, saveProfile } from "@/lib/store";

const SLIDES = [
  {
    title: "Built on math,",
    italic: "not vibes.",
    body: "Landmark geometry measures your proportions in your browser. Deterministic: same photo in, same score out.",
  },
  {
    title: "Everything is",
    italic: "free.",
    body: "Every metric, the full report, side profile, history. No Pro tier, no teaser scores, no tricks. Open source, forever.",
  },
  {
    title: "Your face",
    italic: "stays yours.",
    body: "Photos never leave this device. The only things that can: an opt-in leaderboard score, or AI calls to a provider you control.",
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [form, setForm] = useState(false);
  const [sex, setSex] = useState<Sex>("neutral");
  const [ageRange, setAgeRange] = useState<string>("");

  const finish = () => {
    saveProfile({
      ...loadProfile(),
      onboarded: true,
      sex,
      ageRange: ageRange || undefined,
    });
    router.replace("/");
  };

  if (form) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-8 px-6 py-10">
        <div>
          <h1 className="font-display text-3xl">
            Tune the <em>ideal ranges.</em>
          </h1>
          <p className="mt-2 text-sm text-ink-2 max-w-[40ch]">
            A few metrics (jaw width, brow position) have different reference
            ranges by presentation. Skipping costs you nothing — the neutral
            option uses the union of both ranges.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="label-caps">Score my face against</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["masculine", "Masculine"],
                ["neutral", "No preference"],
                ["feminine", "Feminine"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSex(value)}
                className={`card py-3 text-sm ${sex === value ? "border-gold/70 text-ink" : "text-ink-2"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="label-caps">Age range (optional)</p>
          <div className="grid grid-cols-4 gap-2">
            {["<18", "18–24", "25–34", "35+"].map((a) => (
              <button
                key={a}
                onClick={() => setAgeRange(ageRange === a ? "" : a)}
                className={`card py-3 text-sm ${ageRange === a ? "border-gold/70 text-ink" : "text-ink-2"}`}
              >
                {a}
              </button>
            ))}
          </div>
          {ageRange === "<18" && (
            <p className="text-xs text-work">
              Heads up: faces keep developing well into your twenties. Numbers
              at your age move on their own — treat all of this lightly.
            </p>
          )}
        </div>

        <button
          onClick={finish}
          className="gold-gradient rounded-full py-4 text-sm font-semibold tracking-[0.15em] uppercase"
        >
          Get Started →
        </button>
      </main>
    );
  }

  const s = SLIDES[slide]!;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-between px-6 py-10">
      <p className="text-sm lowercase tracking-wide text-ink-2">freeharmony</p>

      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl leading-tight">
          {s.title} <em>{s.italic}</em>
        </h1>
        <p className="text-ink-2 max-w-[38ch]">{s.body}</p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === slide ? "w-6 bg-gold" : "w-1.5 bg-ink-3"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() =>
            slide < SLIDES.length - 1 ? setSlide(slide + 1) : setForm(true)
          }
          className="gold-gradient rounded-full py-4 text-sm font-semibold tracking-[0.15em] uppercase"
        >
          {slide < SLIDES.length - 1 ? "Next" : "Set Up"} →
        </button>
        <p className="text-center text-xs text-ink-3">
          🔒 Your data is private, local, and yours to delete.
        </p>
      </div>
    </main>
  );
}
