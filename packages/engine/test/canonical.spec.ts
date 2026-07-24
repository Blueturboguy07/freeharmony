// Tier-0 fixture: the canonical face model projected into a synthetic frame.
// Locks every landmark index and metric formula simultaneously — if an index
// is swapped or a formula drifts, assertions fail here in milliseconds with
// no WASM, images, or network involved.
import { describe, expect, it } from "vitest";
import { analyze } from "../src/index.js";
import { buildFrame } from "../src/normalize.js";
import { eyeAspectRatio } from "../src/gates/index.js";
import { canonicalInput, metricValue } from "./helpers.js";

const r = analyze(canonicalInput());

describe("canonical face model fixture", () => {
  it("passes gates and produces a score", () => {
    expect(r.gates.blocking).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.overall).not.toBeNull();
    expect(r.tier).not.toBeNull();
  });

  it("frame: zero roll, zero yaw proxy, IPD ≈ 323px", () => {
    expect(Math.abs(r.frame!.rollDeg)).toBeLessThan(0.01);
    expect(Math.abs(r.frame!.yawAsym)).toBeLessThan(0.001);
    expect(r.frame!.scale).toBeCloseTo(6.3023 * 51.2, 0);
  });

  // Expected values derived independently from canonical_face_model.obj
  // during engine design. Tolerances: ratios ±0.005, degrees ±0.15.
  const ratioCases: Array<[string, number]> = [
    ["eyeSeparationRatio", 0.4874],
    ["midLowerThird", 0.9536],
    ["midfaceRatio", 0.957],
    ["fwhr", 2.0297],
    ["jawToCheekbone", 0.9189],
    ["chinToPhiltrum", 2.4699],
    ["lipRatio", 1.3991],
    ["mouthToNoseWidth", 1.5269],
    ["browPosition", 0.2464],
  ];
  for (const [key, expected] of ratioCases) {
    it(`${key} = ${expected}`, () => {
      expect(metricValue(r, key)).toBeCloseTo(expected, 2);
    });
  }

  const degreeCases: Array<[string, number]> = [
    ["canthalTilt", 1.74],
    ["eyeToMouthAngle", 49.13],
    ["jawAngularity", 146.66],
  ];
  for (const [key, expected] of degreeCases) {
    it(`${key} = ${expected}°`, () => {
      expect(metricValue(r, key)).toBeCloseTo(expected, 1);
    });
  }

  it("perfect mirror symmetry scores 100", () => {
    expect(metricValue(r, "overallSymmetry")).toBeCloseTo(100, 1);
    expect(metricValue(r, "eyeSymmetry")).toBeCloseTo(100, 1);
    expect(metricValue(r, "jawSymmetry")).toBeCloseTo(100, 1);
  });

  it("facial thirds ≈ 29.8 / 34.2 / 35.9 %", () => {
    const m = r.metrics.find((x) => x.key === "facialThirds")!;
    const pct = m.detail!.thirdsPct as number[];
    expect(pct[0]).toBeCloseTo(29.8, 0);
    expect(pct[1]).toBeCloseTo(34.2, 0);
    expect(pct[2]).toBeCloseTo(35.9, 0);
    expect(m.confidence).toBeLessThanOrEqual(0.6);
    expect(m.flags).toContain("estimated-trichion");
  });

  it("facial fifths ≈ 21.3 / 16.7 / 24.0 / 16.7 / 21.3 %", () => {
    const m = r.metrics.find((x) => x.key === "facialFifths")!;
    const pct = m.detail!.fifthsPct as number[];
    expect(pct[0]).toBeCloseTo(21.3, 0);
    expect(pct[1]).toBeCloseTo(16.7, 0);
    expect(pct[2]).toBeCloseTo(24.0, 0);
    expect(pct[3]).toBeCloseTo(16.7, 0);
    expect(pct[4]).toBeCloseTo(21.3, 0);
  });

  it("open-eye aspect ratio ≈ 0.254", () => {
    const { frame } = buildFrame(canonicalInput());
    expect(eyeAspectRatio(frame, "right")).toBeCloseTo(0.2541, 2);
    expect(eyeAspectRatio(frame, "left")).toBeCloseTo(0.2541, 2);
  });

  it("jawlineDefinition without an image falls back to angularity-only at 0.5 confidence", () => {
    const m = r.metrics.find((x) => x.key === "jawlineDefinition")!;
    expect(m.flags).toContain("no-image");
    expect(m.confidence).toBeLessThanOrEqual(0.5);
  });
});

describe("scale invariance", () => {
  it("identical rounded result at 0.5x and 2.5x resolution", () => {
    const base = analyze(canonicalInput());
    for (const f of [0.5, 2.5]) {
      const scaled = analyze(
        canonicalInput({
          imageWidth: Math.round(1024 * f),
          imageHeight: Math.round(1280 * f),
        }),
      );
      expect(scaled.overall).toBeCloseTo(base.overall!, 1);
      for (const m of base.metrics) {
        const s = scaled.metrics.find((x) => x.key === m.key)!;
        expect(s.value).toBeCloseTo(m.value, 4);
      }
    }
  });
});

describe("mirrored input", () => {
  it("de-mirroring restores identical metric values", () => {
    const input = canonicalInput();
    const mirrored = canonicalInput({
      landmarks: input.landmarks.map((p) => ({ ...p, x: 1 - p.x })),
      mirrored: true,
    });
    const a = analyze(input);
    const b = analyze(mirrored);
    for (const m of a.metrics) {
      const other = b.metrics.find((x) => x.key === m.key)!;
      expect(other.value).toBeCloseTo(m.value, 6);
    }
  });
});
