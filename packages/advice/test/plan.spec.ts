import { describe, expect, it } from "vitest";
import type { MetricResult, ScanResult } from "@freeharmony/engine";
import { generatePlan, RULES } from "../src/index";

function metric(key: string, label: string, score: number): MetricResult {
  return {
    key: key as MetricResult["key"],
    label,
    value: 1,
    unit: "ratio",
    band: { lo: 0, hi: 1 },
    score,
    verdict: score >= 100 ? "ideal" : score >= 65 ? "near-ideal" : "needs-work",
    confidence: 1,
    flags: [],
  };
}

function fakeResult(metrics: MetricResult[]): ScanResult {
  return {
    ok: true,
    gates: {
      pass: true,
      blocking: [],
      warnings: [],
      confidenceMultiplier: 1,
      regionConfidence: {},
      jawEdgeSupport: null,
    },
    frame: null,
    metrics,
    areas: {
      symmetry: { score: 90, confidence: 1 },
      eyeArea: { score: 90, confidence: 1 },
      midface: { score: 90, confidence: 1 },
      jawline: { score: 90, confidence: 1 },
    },
    overall: 90,
    tier: "excellent",
    engineVersion: "test",
    bandProfile: "faceharmony-parity",
    sex: "neutral",
  };
}

describe("generatePlan", () => {
  it("ranks rules targeting the worst deficits first", () => {
    const result = fakeResult([
      metric("jawlineDefinition", "Jawline definition", 20),
      metric("canthalTilt", "Canthal tilt", 100),
      metric("lipRatio", "Lip ratio", 95),
    ]);
    const plan = generatePlan(result, "neutral");
    expect(plan.items.length).toBeGreaterThan(0);
    const first = plan.items[0]!;
    expect(first.rule.targets).toContain("jawlineDefinition");
    expect(first.reason).toContain("Jawline definition");
  });

  it("always includes universal baselines even on a perfect scan", () => {
    const result = fakeResult([metric("canthalTilt", "Canthal tilt", 100)]);
    const plan = generatePlan(result, "neutral");
    const ids = plan.items.map((i) => i.rule.id);
    expect(ids).toContain("skincare-baseline");
    expect(ids).toContain("teeth");
  });

  it("filters sex-gated rules", () => {
    const result = fakeResult([metric("jawlineDefinition", "Jawline definition", 30)]);
    const fem = generatePlan(result, "feminine");
    expect(fem.items.some((i) => i.rule.id === "beard-jaw")).toBe(false);
    const masc = generatePlan(result, "masculine");
    expect(masc.items.some((i) => i.rule.id === "beard-jaw")).toBe(true);
  });

  it("ships safety notes and contains no procedural coaching", () => {
    const plan = generatePlan(fakeResult([]), "neutral");
    expect(plan.safetyNotes.length).toBeGreaterThan(0);
    const allText = RULES.map((r) => `${r.title} ${r.body}`).join(" ").toLowerCase();
    for (const banned of ["filler", "rhinoplasty", "implant", "finasteride", "steroid"]) {
      expect(allText).not.toContain(banned);
    }
  });
});
