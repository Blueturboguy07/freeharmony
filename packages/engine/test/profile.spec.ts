import { describe, expect, it } from "vitest";
import {
  analyzeProfile,
  defaultProfileAnchors,
  profileFacing,
  type ProfileAnchors,
} from "../src/profile";

/** Hand-constructed right-facing profile with known geometry. */
function syntheticProfile(): ProfileAnchors {
  return {
    // Vertical forehead-to-brow, nose protruding right.
    glabella: { x: 0.6, y: 0.3 },
    nasion: { x: 0.58, y: 0.4 },
    pronasale: { x: 0.72, y: 0.5 },
    subnasale: { x: 0.62, y: 0.55 },
    labialeSup: { x: 0.635, y: 0.6 },
    labialeInf: { x: 0.63, y: 0.65 },
    pogonion: { x: 0.615, y: 0.75 },
    menton: { x: 0.56, y: 0.8 },
  };
}

describe("profile analysis", () => {
  it("detects facing direction", () => {
    const right = syntheticProfile();
    expect(profileFacing(right)).toBe(1);
    const left: ProfileAnchors = Object.fromEntries(
      Object.entries(right).map(([k, p]) => [k, { x: 1 - p.x, y: p.y }]),
    ) as ProfileAnchors;
    expect(profileFacing(left)).toBe(-1);
  });

  it("is mirror-invariant: left- and right-facing profiles score identically", () => {
    const right = syntheticProfile();
    const left: ProfileAnchors = Object.fromEntries(
      Object.entries(right).map(([k, p]) => [k, { x: 1 - p.x, y: p.y }]),
    ) as ProfileAnchors;
    const a = analyzeProfile(right, "neutral");
    const b = analyzeProfile(left, "neutral");
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.value).toBeCloseTo(a[i]!.value, 10);
    }
  });

  it("computes angles in sane ranges for a plausible profile", () => {
    const results = analyzeProfile(syntheticProfile(), "neutral");
    const get = (k: string) => results.find((r) => r.key === k)!;
    expect(get("nasofrontalAngle").value).toBeGreaterThan(90);
    expect(get("nasofrontalAngle").value).toBeLessThan(180);
    expect(get("nasolabialAngle").value).toBeGreaterThan(45);
    expect(get("nasolabialAngle").value).toBeLessThan(180);
    expect(get("facialConvexity").value).toBeGreaterThan(120);
    expect(get("facialConvexity").value).toBeLessThan(180);
  });

  it("E-line: lips behind the nose-chin line measure negative", () => {
    const anchors = syntheticProfile();
    // labialeSup at x=0.635 vs the pronasale(0.72,0.5)→pogonion(0.615,0.75)
    // line — clearly behind it for a right-facing profile.
    const results = analyzeProfile(anchors, "neutral");
    expect(results.find((r) => r.key === "eLineUpper")!.value).toBeLessThan(0);
  });

  it("a lip pushed far forward of the E-line scores worse", () => {
    const base = analyzeProfile(syntheticProfile(), "neutral");
    const jutting = syntheticProfile();
    jutting.labialeSup = { x: 0.71, y: 0.6 };
    const out = analyzeProfile(jutting, "neutral");
    expect(out.find((r) => r.key === "eLineUpper")!.score).toBeLessThan(
      base.find((r) => r.key === "eLineUpper")!.score,
    );
  });

  it("is deterministic", () => {
    const a = JSON.stringify(analyzeProfile(syntheticProfile(), "masculine"));
    const b = JSON.stringify(analyzeProfile(syntheticProfile(), "masculine"));
    expect(a).toBe(b);
  });

  it("default anchors form a right-facing profile", () => {
    expect(profileFacing(defaultProfileAnchors())).toBe(1);
  });
});
