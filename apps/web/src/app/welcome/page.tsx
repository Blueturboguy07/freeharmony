"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadProfile, saveProfile, type Profile } from "@/lib/store";

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

type StepKind = "single-row" | "single-card" | "multi-grid";

interface StepOption {
  value: string;
  label: string;
  sub?: string;
  icon?: string;
}

interface StepDef {
  key: keyof Profile;
  headline: string;
  kind: StepKind;
  options: StepOption[];
  /** For multi-selects: an option that clears the others. */
  noneValue?: string;
  optional?: boolean;
  note?: string;
}

const STEPS: StepDef[] = [
  {
    key: "sex",
    headline: "How should we score you?",
    kind: "single-card",
    options: [
      { value: "masculine", label: "Masculine", sub: "Masculine reference ranges", icon: "▵" },
      { value: "feminine", label: "Feminine", sub: "Feminine reference ranges", icon: "▿" },
      { value: "neutral", label: "Skip", sub: "Union of both — costs you nothing", icon: "◇" },
    ],
    note: "A few metrics (jaw width, brows) have different reference ranges by presentation.",
  },
  {
    key: "ageRange",
    headline: "What's your age range?",
    kind: "single-row",
    options: [
      { value: "<18", label: "Under 18" },
      { value: "18-24", label: "18–24" },
      { value: "25-34", label: "25–34" },
      { value: "35-44", label: "35–44" },
      { value: "45+", label: "45+" },
    ],
  },
  {
    key: "goal",
    headline: "What brings you here?",
    kind: "single-card",
    options: [
      { value: "photos", label: "Look better in photos", icon: "◉" },
      { value: "dating", label: "Upgrade my dating profile", icon: "♡" },
      { value: "grooming", label: "Dial in my grooming", icon: "✂" },
      { value: "tracking", label: "Track my glow-up", icon: "↗" },
    ],
  },
  {
    key: "skinType",
    headline: "How would you describe your skin?",
    kind: "single-row",
    options: [
      { value: "oily", label: "Oily", icon: "◌" },
      { value: "dry", label: "Dry", icon: "∴" },
      { value: "normal", label: "Normal", icon: "❦" },
      { value: "combination", label: "Combination", icon: "◐" },
      { value: "sensitive", label: "Sensitive", icon: "✕" },
    ],
  },
  {
    key: "activity",
    headline: "How active are you?",
    kind: "single-row",
    options: [
      { value: "sedentary", label: "Mostly sitting", sub: "Desk life, little exercise" },
      { value: "light", label: "Lightly active", sub: "Walks, occasional workouts" },
      { value: "regular", label: "Regularly active", sub: "Several sessions a week" },
      { value: "athlete", label: "Training hard", sub: "Structured training, most days" },
    ],
  },
  {
    key: "skincare",
    headline: "What's in your routine today?",
    kind: "multi-grid",
    noneValue: "none",
    options: [
      { value: "cleanser", label: "Cleanser", icon: "☖" },
      { value: "moisturizer", label: "Moisturizer", icon: "❦" },
      { value: "sunscreen", label: "Sunscreen", icon: "☀" },
      { value: "serum", label: "Serum", icon: "◌" },
      { value: "eye-cream", label: "Eye cream", icon: "◎" },
      { value: "exfoliator", label: "Exfoliator", icon: "✦" },
      { value: "toner", label: "Toner", icon: "△" },
      { value: "mask", label: "Mask", icon: "☺" },
      { value: "none", label: "Nothing yet", icon: "∅" },
    ],
  },
  {
    key: "diet",
    headline: "How do you usually eat?",
    kind: "single-card",
    options: [
      { value: "balanced", label: "Balanced", sub: "A bit of everything", icon: "☰" },
      { value: "high-protein", label: "High protein", sub: "Protein and whole foods first", icon: "◬" },
      { value: "plant-based", label: "Mostly plants", sub: "Plant-forward most days", icon: "❧" },
      { value: "not-great", label: "Honestly? Convenient", sub: "Whatever's around", icon: "◔" },
    ],
  },
  {
    key: "sleep",
    headline: "How much do you sleep?",
    kind: "single-row",
    options: [
      { value: "<5", label: "Under 5 hours", sub: "Running on fumes", icon: "▁" },
      { value: "6-8", label: "6–8 hours", sub: "Usually enough", icon: "◐" },
      { value: "8+", label: "8+ hours", sub: "Well rested", icon: "●" },
      { value: "irregular", label: "All over the place", sub: "No consistent schedule", icon: "∿" },
    ],
  },
  {
    key: "concerns",
    headline: "Anything you specifically care about?",
    kind: "multi-grid",
    optional: true,
    options: [
      { value: "jawline", label: "Jawline", icon: "▽" },
      { value: "skin", label: "Skin clarity", icon: "✦" },
      { value: "symmetry", label: "Symmetry", icon: "⚖" },
      { value: "eyes", label: "Eye area", icon: "◎" },
      { value: "cheekbones", label: "Cheekbones", icon: "◮" },
      { value: "hairline", label: "Hairline", icon: "✂" },
      { value: "posture", label: "Posture", icon: "↕" },
      { value: "harmony", label: "Overall harmony", icon: "◈" },
    ],
  },
  {
    key: "experience",
    headline: "How deep are you into this?",
    kind: "single-row",
    options: [
      { value: "beginner", label: "Just starting", sub: "New to all of it" },
      { value: "intermediate", label: "Some routine going", sub: "I know the basics" },
      { value: "advanced", label: "I track ratios", sub: "Deep in the details" },
    ],
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [step, setStep] = useState(-1); // -1 = intro slides
  const [profile, setProfile] = useState<Profile>({ onboarded: false, sex: "neutral" });

  useEffect(() => {
    const existing = loadProfile();
    setProfile(existing);
    if (window.location.hash === "#edit") setStep(0);
  }, []);

  const current = step >= 0 ? STEPS[step] : undefined;

  const valueOf = (def: StepDef): string | string[] | undefined =>
    profile[def.key] as string | string[] | undefined;

  const setValue = (def: StepDef, v: string) => {
    setProfile((p) => {
      if (def.kind === "multi-grid") {
        const prev = (p[def.key] as string[] | undefined) ?? [];
        let next: string[];
        if (def.noneValue && v === def.noneValue) {
          next = prev.includes(v) ? [] : [v];
        } else {
          next = prev.includes(v)
            ? prev.filter((x) => x !== v)
            : [...prev.filter((x) => x !== def.noneValue), v];
        }
        return { ...p, [def.key]: next };
      }
      return { ...p, [def.key]: v };
    });
  };

  const canNext =
    !current ||
    current.optional ||
    (current.kind === "multi-grid"
      ? ((valueOf(current) as string[] | undefined)?.length ?? 0) > 0
      : valueOf(current) !== undefined);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    saveProfile({ ...profile, onboarded: true });
    router.replace("/");
  };

  // ---- intro slides ----
  if (step === -1) {
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
                className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-gold" : "w-1.5 bg-ink-3"}`}
              />
            ))}
          </div>
          <button
            onClick={() => (slide < SLIDES.length - 1 ? setSlide(slide + 1) : setStep(0))}
            className="gold-gradient btn-press rounded-full py-4 text-sm font-semibold tracking-[0.15em] uppercase"
          >
            {slide < SLIDES.length - 1 ? "Next" : "Personalize"} →
          </button>
          <p className="text-center text-xs text-ink-3">
            🔒 Answers stay on this device and shape your plan — nothing is uploaded.
          </p>
        </div>
      </main>
    );
  }

  // ---- questionnaire ----
  const def = current!;
  const val = valueOf(def);
  const selected = (v: string) =>
    def.kind === "multi-grid" ? ((val as string[] | undefined) ?? []).includes(v) : val === v;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 py-8">
      <header className="relative flex items-center justify-center py-2">
        <button
          onClick={() => (step === 0 ? setStep(-1) : setStep(step - 1))}
          className="absolute left-0 text-xl text-ink-2 hover:text-ink"
          aria-label="Back"
        >
          ←
        </button>
        <span className="label-caps">
          Step {step + 1} of {STEPS.length}
        </span>
      </header>

      <h1 className="font-display py-6 text-center text-3xl leading-snug">
        {def.headline}
      </h1>
      {def.note && <p className="-mt-3 pb-4 text-center text-xs text-ink-3">{def.note}</p>}

      <div className="flex-1">
        {def.kind === "single-row" && (
          <div className="flex flex-col gap-3">
            {def.options.map((o) => (
              <button
                key={o.value}
                onClick={() => setValue(def, o.value)}
                className={`card btn-press flex items-center gap-4 px-5 py-4 text-left ${
                  selected(o.value) ? "border-gold/70 bg-gold/10" : ""
                }`}
              >
                {o.icon && <span className="text-gold/80">{o.icon}</span>}
                <span className="flex-1">
                  <span className={`block font-medium ${selected(o.value) ? "text-gold-hi" : ""}`}>
                    {o.label}
                  </span>
                  {o.sub && <span className="block text-sm text-ink-2">{o.sub}</span>}
                </span>
                <Radio on={selected(o.value)} />
              </button>
            ))}
          </div>
        )}

        {def.kind === "single-card" && (
          <div className="grid grid-cols-2 gap-3">
            {def.options.map((o) => (
              <button
                key={o.value}
                onClick={() => setValue(def, o.value)}
                className={`card btn-press relative flex flex-col gap-2 p-5 text-left ${
                  selected(o.value) ? "border-gold/70 bg-gold/10" : ""
                }`}
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-raised text-lg text-gold/80">
                  {o.icon}
                </span>
                <span className={`font-medium ${selected(o.value) ? "text-gold-hi" : ""}`}>
                  {o.label}
                </span>
                {o.sub && <span className="text-sm text-ink-2">{o.sub}</span>}
                <span className="absolute right-3 top-3">
                  <Radio on={selected(o.value)} />
                </span>
              </button>
            ))}
          </div>
        )}

        {def.kind === "multi-grid" && (
          <div className="grid grid-cols-3 gap-3">
            {def.options.map((o) => (
              <button
                key={o.value}
                onClick={() => setValue(def, o.value)}
                className={`card btn-press relative flex aspect-square flex-col items-center justify-center gap-2 p-2 ${
                  selected(o.value) ? "border-gold/70 bg-gold/10" : ""
                }`}
              >
                <span className="text-xl text-gold/80">{o.icon}</span>
                <span
                  className={`text-center text-xs ${selected(o.value) ? "text-gold-hi" : "text-ink-2"}`}
                >
                  {o.label}
                </span>
                {selected(o.value) && (
                  <span className="absolute right-2 top-2">
                    <Radio on />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-6">
        <button
          onClick={() => (step === 0 ? setStep(-1) : setStep(step - 1))}
          className="card btn-press flex-1 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-ink-2"
        >
          Previous
        </button>
        <button
          onClick={next}
          disabled={!canNext}
          className="gold-gradient btn-press flex-1 rounded-card py-4 text-sm font-semibold uppercase tracking-[0.15em] disabled:opacity-40"
        >
          {step === STEPS.length - 1 ? "Finish" : "Next"}
        </button>
      </div>
      <p className="pt-3 text-center text-xs text-ink-3">
        {profile.ageRange === "<18" && def.key === "ageRange"
          ? "Your face is still developing — numbers at your age move on their own. Treat all of this lightly."
          : "Answers personalize your plan and never leave this device."}
      </p>
    </main>
  );
}

function Radio({ on }: { on?: boolean }) {
  return on ? (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-gold-hi text-xs text-on-gold">
      ✓
    </span>
  ) : (
    <span className="h-6 w-6 rounded-full border-2 border-ink-3/50" />
  );
}
