import { describe, expect, it } from "vitest";
import { analyze } from "../src/index";
import { BANDS, resolveBand } from "../src/scoring/bands";
import { subScore } from "../src/scoring/curve";
import {
  overallPercentileOf,
  overallScoreStats,
  percentileOf,
  standardizedOverall,
} from "../src/scoring/norms";
import { canonicalInput } from "./helpers";

describe("calibrated band profile", () => {
  it("every metric has a calibrated band with corpus falloff scales", () => {
    for (const [key, profiles] of Object.entries(BANDS)) {
      const band = resolveBand(profiles.calibrated, "neutral");
      expect(band.sLo, key).toBeGreaterThan(0);
      expect(band.sHi, key).toBeGreaterThan(0);
      expect(band.hi, key).toBeGreaterThan(band.lo);
    }
  });

  it("re-anchored ESR: the population median now scores ideal", () => {
    // FFHQ corpus median eyeSeparationRatio = 0.499; the parity band (a
    // different measurement convention) put it at ~1 in the population.
    const band = resolveBand(BANDS.eyeSeparationRatio.calibrated, "neutral");
    expect(subScore(0.499, band)).toBe(100);
    // ...while the parity band keeps its original values for comparison.
    const parity = resolveBand(BANDS.eyeSeparationRatio["faceharmony-parity"], "neutral");
    expect(parity.hi).toBe(0.474);
  });

  it("analyze() under the calibrated profile still scores the canonical face", () => {
    const r = analyze(canonicalInput({ bandProfile: "calibrated" }));
    expect(r.ok).toBe(true);
    expect(r.overall).not.toBeNull();
    // Raw values are profile-independent.
    const esr = r.metrics.find((m) => m.key === "eyeSeparationRatio")!;
    expect(esr.value).toBeCloseTo(0.4874, 2);
  });
});

describe("percentiles from the corpus", () => {
  it("median values map to ~50th percentile", () => {
    // Corpus medians from the calibration run.
    expect(percentileOf("canthalTilt", 4.226)).toBeGreaterThanOrEqual(45);
    expect(percentileOf("canthalTilt", 4.226)).toBeLessThanOrEqual(55);
    expect(percentileOf("eyeSeparationRatio", 0.499)).toBeGreaterThanOrEqual(45);
    expect(percentileOf("eyeSeparationRatio", 0.499)).toBeLessThanOrEqual(55);
  });

  it("extremes clamp to the table edges", () => {
    expect(percentileOf("canthalTilt", -20)).toBe(1);
    expect(percentileOf("canthalTilt", 40)).toBe(99);
  });

  it("metrics without corpus data return null", () => {
    expect(percentileOf("jawlineDefinition", 0.8)).toBeNull();
    expect(percentileOf("not-a-metric", 1)).toBeNull();
  });

  it("percentile is monotonic in the value", () => {
    let prev = -1;
    for (const v of [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const p = percentileOf("canthalTilt", v)!;
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
});

describe("score-space standardization", () => {
  const stats = overallScoreStats();

  it("standardized score behaves — or is null pre-calibration", () => {
    if (!stats) {
      expect(standardizedOverall(70)).toBeNull();
      expect(overallPercentileOf(70)).toBeNull();
      return;
    }
    // Corpus mean maps to 50 by construction.
    expect(standardizedOverall(stats.mean)).toBeCloseTo(50, 0);
    // One SD above the mean maps to ~65.
    expect(standardizedOverall(stats.mean + stats.sd)).toBeCloseTo(65, 0);
    // Clamped at the extremes.
    expect(standardizedOverall(0)).toBeGreaterThanOrEqual(1);
    expect(standardizedOverall(200)).toBeLessThanOrEqual(99);
    // Monotonic.
    let prev = -1;
    for (let v = 0; v <= 100; v += 5) {
      const s = standardizedOverall(v)!;
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
    // Median score sits at the 50th percentile of its own distribution.
    const midPct = overallPercentileOf(stats.median)!;
    expect(midPct).toBeGreaterThanOrEqual(45);
    expect(midPct).toBeLessThanOrEqual(55);
  });

  it("analyze() only standardizes under the calibrated profile", () => {
    const parity = analyze(canonicalInput({ bandProfile: "faceharmony-parity" }));
    expect(parity.standardized).toBeNull();
    const cal = analyze(canonicalInput({ bandProfile: "calibrated" }));
    if (stats) {
      expect(cal.standardized).not.toBeNull();
      expect(cal.overallPercentile).not.toBeNull();
    }
  });
});
