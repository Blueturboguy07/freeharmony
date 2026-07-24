// Synthetic pose sweep: pins the Euler sign convention, validates the matrix
// layout detector, fits the landmark yaw proxy, and checks gate boundaries.
import { describe, expect, it } from "vitest";
import { analyze } from "../src/index.js";
import { eulerFromMatrix, isColumnMajor, yawAsymmetry, YAW_PROXY_TO_DEG } from "../src/pose.js";
import { buildFrame } from "../src/normalize.js";
import {
  canonicalInput,
  projectCanonical,
  rotXYZ,
  toColMajor16,
  FRAME_W,
  FRAME_H,
} from "./helpers.js";

describe("matrix layout detection", () => {
  it("detects column-major (translation in d[12..14])", () => {
    const m = toColMajor16(rotXYZ(10, 5, -8));
    expect(isColumnMajor(m)).toBe(true);
  });

  it("detects row-major (translation in d[3,7,11])", () => {
    const cm = toColMajor16(rotXYZ(10, 5, -8));
    // Transpose the 4x4 → row-major storage of the same transform.
    const rm = new Array<number>(16);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) rm[r * 4 + c] = cm[c * 4 + r]!;
    expect(isColumnMajor(rm)).toBe(false);
  });
});

describe("Euler recovery from synthetic rotations", () => {
  const grid = [
    [0, 0, 0],
    [8, 0, 0],
    [-8, 0, 0],
    [0, 6, 0],
    [0, -6, 0],
    [0, 0, 12],
    [10, -5, 7],
    [-6, 8, -15],
  ] as const;

  for (const [yaw, pitch, roll] of grid) {
    it(`recovers yaw=${yaw} pitch=${pitch} roll=${roll} within 0.5°`, () => {
      const e = eulerFromMatrix(toColMajor16(rotXYZ(yaw, pitch, roll)));
      expect(e.yawDeg).toBeCloseTo(yaw, 1);
      expect(e.pitchDeg).toBeCloseTo(pitch, 1);
      expect(e.rollDeg).toBeCloseTo(roll, 1);
    });
  }
});

describe("landmark yaw proxy", () => {
  for (const yaw of [2, 6, 10, 12]) {
    it(`proxy at yaw ${yaw}° maps back within 1°, both signs`, () => {
      for (const sign of [1, -1]) {
        const pts = projectCanonical(rotXYZ(sign * yaw, 0, 0)).map((p) => ({
          x: p.x * FRAME_W,
          y: FRAME_H - p.y * FRAME_H,
          z: p.z * FRAME_W,
        }));
        const asym = yawAsymmetry(pts);
        expect(asym * YAW_PROXY_TO_DEG).toBeCloseTo(sign * yaw, 0);
      }
    });
  }

  it("matrix and proxy agree in sign for the same physical rotation", () => {
    const r = rotXYZ(8, 0, 0);
    const e = eulerFromMatrix(toColMajor16(r));
    const pts = projectCanonical(r).map((p) => ({
      x: p.x * FRAME_W,
      y: FRAME_H - p.y * FRAME_H,
      z: p.z * FRAME_W,
    }));
    const proxyDeg = yawAsymmetry(pts) * YAW_PROXY_TO_DEG;
    expect(Math.sign(proxyDeg)).toBe(Math.sign(e.yawDeg));
  });
});

describe("pose gates", () => {
  function rotatedInput(yaw: number, pitch: number, roll: number) {
    const r = rotXYZ(yaw, pitch, roll);
    return canonicalInput({
      landmarks: projectCanonical(r),
      transformationMatrix: toColMajor16(r),
    });
  }

  it("yaw 13° blocks", () => {
    const res = analyze(rotatedInput(13, 0, 0));
    expect(res.ok).toBe(false);
    expect(res.gates.blocking.some((g) => g.code === "yaw")).toBe(true);
  });

  it("yaw 8° degrades but scores", () => {
    const res = analyze(rotatedInput(8, 0, 0));
    expect(res.ok).toBe(true);
    expect(res.gates.warnings.some((g) => g.code === "yaw-mild")).toBe(true);
  });

  it("pitch 11° blocks", () => {
    const res = analyze(rotatedInput(0, 11, 0));
    expect(res.ok).toBe(false);
    expect(res.gates.blocking.some((g) => g.code === "pitch")).toBe(true);
  });

  it("roll 15° is corrected and only warns", () => {
    const res = analyze(rotatedInput(0, 0, 15));
    expect(res.ok).toBe(true);
    expect(res.gates.warnings.some((g) => g.code === "roll-mild")).toBe(true);
  });

  it("roll 24° blocks", () => {
    const res = analyze(rotatedInput(0, 0, 24));
    expect(res.ok).toBe(false);
    expect(res.gates.blocking.some((g) => g.code === "roll")).toBe(true);
  });

  it("roll ±18° barely moves scale-invariant metrics", () => {
    const base = analyze(canonicalInput());
    const rolled = analyze(rotatedInput(0, 0, 18));
    for (const key of ["fwhr", "jawToCheekbone", "chinToPhiltrum", "lipRatio"]) {
      const a = base.metrics.find((m) => m.key === key)!.value;
      const b = rolled.metrics.find((m) => m.key === key)!.value;
      expect(Math.abs(b - a) / a).toBeLessThan(0.005);
    }
  });
});
