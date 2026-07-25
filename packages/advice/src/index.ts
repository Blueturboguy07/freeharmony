import type { ScanResult, Sex } from "@freeharmony/engine";
import { RULES, SAFETY_NOTES, type AdviceRule } from "./rules";

export interface PlanItem {
  rule: AdviceRule;
  /** Why this made the list, referencing the user's numbers AND answers. */
  reason: string;
  /** deficit- and profile-weighted priority, higher = earlier. */
  priority: number;
}

export interface Plan {
  items: PlanItem[];
  safetyNotes: string[];
}

/** Onboarding answers the plan personalizes against. All optional. */
export interface PersonalContext {
  sex: Sex;
  ageRange?: string;
  goal?: string;
  skinType?: "oily" | "dry" | "normal" | "combination" | "sensitive";
  /** Product kinds already in the routine (e.g. "cleanser", "sunscreen"). */
  skincare?: string[];
  diet?: "balanced" | "high-protein" | "plant-based" | "not-great";
  sleep?: "<5" | "6-8" | "8+" | "irregular";
  activity?: "sedentary" | "light" | "regular" | "athlete";
  concerns?: string[];
  experience?: "beginner" | "intermediate" | "advanced";
}

/** Concern chip → the metric keys it cares about. */
const CONCERN_TARGETS: Record<string, string[]> = {
  jawline: ["jawlineDefinition", "jawAngularity", "jawToCheekbone", "chinToPhiltrum"],
  skin: [],
  symmetry: ["overallSymmetry", "eyeSymmetry", "jawSymmetry"],
  eyes: ["canthalTilt", "eyeSymmetry", "eyeSeparationRatio", "browPosition"],
  cheekbones: ["jawToCheekbone", "fwhr"],
  hairline: ["facialThirds"],
  posture: [],
  harmony: [],
};

/** Concern chip → rule categories it boosts even without a metric target. */
const CONCERN_CATEGORIES: Record<string, string[]> = {
  skin: ["skincare"],
  posture: ["posture"],
  hairline: ["hair"],
};

const SKIN_TYPE_ADDON: Record<NonNullable<PersonalContext["skinType"]>, string> = {
  oily: "For oily skin: a salicylic-acid cleanser and a lightweight gel moisturizer — don't skip moisturizer, under-moisturizing makes oil worse.",
  dry: "For dry skin: a non-foaming hydrating cleanser, a richer cream, and no hot-water washing.",
  normal: "Normal skin keeps it simple: gentle cleanser, moisturizer, SPF — consistency beats products.",
  combination: "For combination skin: lighter product on the T-zone, richer on the cheeks.",
  sensitive: "For sensitive skin: fragrance-free everything, patch-test new products, and add one product at a time.",
};

/**
 * Deterministic plan generation: rank each rule by (leverage × worst targeted
 * deficit), then personalize with the onboarding answers — what you already
 * do gets de-duplicated, what you flagged as a concern gets boosted, and the
 * copy references your actual answers. No AI involved — the optional AI deep
 * report layers narrative on top of this, never replaces it.
 */
export function generatePlan(result: ScanResult, personal: PersonalContext): Plan {
  const { sex } = personal;
  const deficits = new Map<string, { label: string; score: number }>();
  for (const m of result.metrics) {
    if (m.score < 100) deficits.set(m.key, { label: m.label, score: m.score });
  }

  const concernMetrics = new Set<string>();
  const concernCategories = new Set<string>();
  for (const c of personal.concerns ?? []) {
    for (const t of CONCERN_TARGETS[c] ?? []) concernMetrics.add(t);
    for (const cat of CONCERN_CATEGORIES[c] ?? []) concernCategories.add(cat);
  }

  const has = (kind: string) => (personal.skincare ?? []).includes(kind);

  const items: PlanItem[] = [];
  for (const rule of RULES) {
    if (rule.sexFilter && rule.sexFilter !== sex) continue;

    let priority: number;
    let reason: string;
    let body = rule.body;

    if (rule.targets.length === 0) {
      priority = rule.leverage * 30;
      reason = "Baseline that pays off regardless of your numbers.";
    } else {
      let worst: { label: string; score: number } | null = null;
      for (const t of rule.targets) {
        const d = deficits.get(t);
        if (d && (worst === null || d.score < worst.score)) worst = d;
      }
      if (!worst) continue; // nothing this rule targets needs work
      const deficit = (100 - worst.score) / 100;
      priority = rule.leverage * deficit * 100;
      reason = `${worst.label} scored ${Math.round(worst.score)} — this is one of the honest levers for it.`;
      // Concern boost: you said you care about this area.
      if (rule.targets.some((t) => concernMetrics.has(t))) {
        priority *= 1.5;
        reason += " You flagged this area as a concern, so it's prioritized.";
      }
    }
    if (concernCategories.has(rule.category)) {
      priority *= 1.4;
      reason += " Matches a concern you flagged.";
    }

    // ---- per-rule personalization from onboarding answers ----
    if (rule.id === "skincare-baseline") {
      const core = ["cleanser", "moisturizer", "sunscreen"];
      const missing = core.filter((k) => !has(k));
      if (has("none") || (personal.skincare?.length ?? 0) === 0) {
        priority *= 1.35;
        reason = "You said you don't run a routine yet — this is the cheapest visible upgrade available.";
      } else if (missing.length === 0) {
        priority *= 0.4;
        reason = "You already run the core routine — keep it consistent; nothing new to buy.";
        body = "You've got cleanser, moisturizer, and SPF covered. The lever now is consistency and sun discipline, not more products.";
      } else {
        reason = `Your routine is missing ${missing.join(" and ")} — ${missing.includes("sunscreen") ? "SPF is the single highest-leverage item" : "worth adding"}.`;
      }
      if (personal.skinType) {
        body += ` ${SKIN_TYPE_ADDON[personal.skinType]}`;
      }
    }

    if (rule.id === "sleep-hydration" && personal.sleep) {
      if (personal.sleep === "<5" || personal.sleep === "irregular") {
        priority *= 1.6;
        reason =
          personal.sleep === "<5"
            ? "You said you sleep under 5 hours — this is very likely showing up in your eye-area read."
            : "You said your sleep is irregular — stabilizing it is the cheapest eye-area improvement you have.";
      } else if (personal.sleep === "8+") {
        priority *= 0.3;
        reason = "Your sleep is already solid — just keep it.";
      }
    }

    if (rule.id === "leanness") {
      if (personal.diet === "not-great") {
        priority *= 1.3;
        reason += " You described your diet as convenience-first — that's the first thing to tighten.";
      } else if (personal.diet === "high-protein" && personal.activity === "athlete") {
        reason += " You're already training and eating protein-first — this is maintenance, not a change.";
        priority *= 0.7;
      }
      if (personal.activity === "sedentary") {
        body += " Starting from low activity: walking plus two resistance sessions a week is enough to begin.";
      }
    }

    items.push({ rule: { ...rule, body }, reason, priority });
  }

  items.sort((a, b) => b.priority - a.priority);
  return { items, safetyNotes: SAFETY_NOTES };
}

export { RULES, SAFETY_NOTES } from "./rules";
export type { AdviceRule, AdviceCategory } from "./rules";
export { generateSummary } from "./summary";
