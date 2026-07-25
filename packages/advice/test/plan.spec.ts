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
    percentile: null,
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
    overallPercentile: null,
    standardized: null,
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
    const plan = generatePlan(result, { sex: "neutral" });
    expect(plan.items.length).toBeGreaterThan(0);
    const first = plan.items[0]!;
    expect(first.rule.targets).toContain("jawlineDefinition");
    expect(first.reason).toContain("Jawline definition");
  });

  it("always includes universal baselines even on a perfect scan", () => {
    const result = fakeResult([metric("canthalTilt", "Canthal tilt", 100)]);
    const plan = generatePlan(result, { sex: "neutral" });
    const ids = plan.items.map((i) => i.rule.id);
    expect(ids).toContain("skincare-baseline");
    expect(ids).toContain("teeth");
  });

  it("filters sex-gated rules", () => {
    const result = fakeResult([metric("jawlineDefinition", "Jawline definition", 30)]);
    const fem = generatePlan(result, { sex: "feminine" });
    expect(fem.items.some((i) => i.rule.id === "beard-jaw")).toBe(false);
    const masc = generatePlan(result, { sex: "masculine" });
    expect(masc.items.some((i) => i.rule.id === "beard-jaw")).toBe(true);
  });

  it("ships safety notes and contains no procedural coaching", () => {
    const plan = generatePlan(fakeResult([]), { sex: "neutral" });
    expect(plan.safetyNotes.length).toBeGreaterThan(0);
    const allText = RULES.map((r) => `${r.title} ${r.body}`).join(" ").toLowerCase();
    for (const banned of ["filler", "rhinoplasty", "implant", "finasteride", "steroid"]) {
      expect(allText).not.toContain(banned);
    }
  });
});

describe("personalization from onboarding answers", () => {
  const base = fakeResult([
    metric("jawlineDefinition", "Jawline definition", 40),
    metric("canthalTilt", "Canthal tilt", 60),
  ]);

  it("a full existing routine demotes the skincare baseline and rewrites its copy", () => {
    const bare = generatePlan(base, { sex: "neutral", skincare: [] });
    const covered = generatePlan(base, {
      sex: "neutral",
      skincare: ["cleanser", "moisturizer", "sunscreen"],
    });
    const pBare = bare.items.find((i) => i.rule.id === "skincare-baseline")!;
    const pCov = covered.items.find((i) => i.rule.id === "skincare-baseline")!;
    expect(pCov.priority).toBeLessThan(pBare.priority);
    expect(pCov.reason).toContain("already");
  });

  it("missing sunscreen is called out by name", () => {
    const plan = generatePlan(base, { sex: "neutral", skincare: ["cleanser", "moisturizer"] });
    const item = plan.items.find((i) => i.rule.id === "skincare-baseline")!;
    expect(item.reason.toLowerCase()).toContain("sunscreen");
  });

  it("skin type tailors the skincare copy", () => {
    const plan = generatePlan(base, { sex: "neutral", skinType: "oily", skincare: ["none"] });
    const item = plan.items.find((i) => i.rule.id === "skincare-baseline")!;
    expect(item.rule.body.toLowerCase()).toContain("oily");
  });

  it("bad sleep boosts the sleep rule; great sleep demotes it", () => {
    const short = generatePlan(base, { sex: "neutral", sleep: "<5" });
    const rested = generatePlan(base, { sex: "neutral", sleep: "8+" });
    const pShort = short.items.find((i) => i.rule.id === "sleep-hydration")!;
    const pRested = rested.items.find((i) => i.rule.id === "sleep-hydration")!;
    expect(pShort.priority).toBeGreaterThan(pRested.priority);
    expect(pShort.reason).toContain("under 5");
  });

  it("flagged concerns boost matching rules", () => {
    const plain = generatePlan(base, { sex: "neutral" });
    const concerned = generatePlan(base, { sex: "neutral", concerns: ["jawline"] });
    const pPlain = plain.items.find((i) => i.rule.id === "leanness")!;
    const pConc = concerned.items.find((i) => i.rule.id === "leanness")!;
    expect(pConc.priority).toBeGreaterThan(pPlain.priority);
    expect(pConc.reason).toContain("concern");
  });
});
