import type { ScanResult, Sex } from "@freeharmony/engine";
import { RULES, SAFETY_NOTES, type AdviceRule } from "./rules";

export interface PlanItem {
  rule: AdviceRule;
  /** Why this made the list, referencing the user's actual numbers. */
  reason: string;
  /** deficit-weighted priority, higher = earlier. */
  priority: number;
}

export interface Plan {
  items: PlanItem[];
  safetyNotes: string[];
}

/**
 * Deterministic plan generation: rank each rule by (leverage × worst targeted
 * deficit), keep universal baselines at a floor priority, drop rules whose
 * sex filter doesn't match. No AI involved — the optional AI deep report
 * layers narrative on top of this, never replaces it.
 */
export function generatePlan(result: ScanResult, sex: Sex): Plan {
  const deficits = new Map<string, { label: string; score: number }>();
  for (const m of result.metrics) {
    if (m.score < 100) deficits.set(m.key, { label: m.label, score: m.score });
  }

  const items: PlanItem[] = [];
  for (const rule of RULES) {
    if (rule.sexFilter && rule.sexFilter !== sex) continue;

    if (rule.targets.length === 0) {
      items.push({
        rule,
        reason: "Baseline that pays off regardless of your numbers.",
        priority: rule.leverage * 30,
      });
      continue;
    }

    let worst: { label: string; score: number } | null = null;
    for (const t of rule.targets) {
      const d = deficits.get(t);
      if (d && (worst === null || d.score < worst.score)) worst = d;
    }
    if (!worst) continue; // nothing this rule targets needs work

    const deficit = (100 - worst.score) / 100;
    items.push({
      rule,
      reason: `${worst.label} scored ${Math.round(worst.score)} — this is one of the honest levers for it.`,
      priority: rule.leverage * deficit * 100,
    });
  }

  items.sort((a, b) => b.priority - a.priority);
  return { items, safetyNotes: SAFETY_NOTES };
}

export { RULES, SAFETY_NOTES } from "./rules";
export type { AdviceRule, AdviceCategory } from "./rules";
export { generateSummary } from "./summary";
