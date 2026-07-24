import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { subScore, verdictOf } from "../src/scoring/curve.js";
import { BANDS, resolveBand } from "../src/scoring/bands.js";
import type { Band } from "../src/types.js";

describe("subScore curve properties", () => {
  const bandArb = fc
    .tuple(
      fc.double({ min: -50, max: 50, noNaN: true }),
      fc.double({ min: 0.01, max: 40, noNaN: true }),
      fc.double({ min: 0.01, max: 20, noNaN: true }),
      fc.double({ min: 0.01, max: 20, noNaN: true }),
    )
    .map(([lo, width, sLo, sHi]): Band => ({ lo, hi: lo + width, sLo, sHi }));

  it("is 100 inside the band, below 100 meaningfully outside, never above", () => {
    fc.assert(
      fc.property(bandArb, fc.double({ min: -100, max: 100, noNaN: true }), (b, v) => {
        const s = subScore(v, b);
        if (v >= b.lo && v <= b.hi) return s === 100;
        // The curve is C¹-flat at the edge, so a value epsilon outside can
        // still round to 100 in floating point — only require strict decrease
        // once the distance is non-negligible.
        const d = v < b.lo ? (b.lo - v) / b.sLo! : (v - b.hi) / b.sHi!;
        if (d > 1e-3) return s < 100 && s >= 0;
        return s <= 100 && s >= 0;
      }),
    );
  });

  it("is exactly 50 one falloff-scale outside either edge", () => {
    fc.assert(
      fc.property(bandArb, (b) => {
        const above = subScore(b.hi + b.sHi!, b);
        const below = subScore(b.lo - b.sLo!, b);
        return Math.abs(above - 50) < 1e-9 && Math.abs(below - 50) < 1e-9;
      }),
    );
  });

  it("is monotonically non-increasing with distance beyond the edge", () => {
    fc.assert(
      fc.property(
        bandArb,
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        (b, d1, d2) => {
          const lo = Math.min(d1, d2);
          const hi = Math.max(d1, d2);
          return (
            subScore(b.hi + hi * b.sHi!, b) <= subScore(b.hi + lo * b.sHi!, b) + 1e-9
          );
        },
      ),
    );
  });
});

describe("parity: the source app's published value→verdict pairs", () => {
  // Every observed value/verdict pair from the original app's own screenshots
  // must reproduce under our curve + verdict thresholds.
  const sex = "masculine" as const;
  const profile = "faceharmony-parity" as const;

  const cases: Array<{
    key: keyof typeof BANDS;
    value: number;
    verdict: "ideal" | "near-ideal" | "needs-work";
  }> = [
    { key: "chinToPhiltrum", value: 2.42, verdict: "ideal" },
    { key: "canthalTilt", value: 3.5, verdict: "ideal" },
    { key: "lipRatio", value: 1.68, verdict: "ideal" },
    { key: "eyeToMouthAngle", value: 49.8, verdict: "near-ideal" },
    { key: "eyeSeparationRatio", value: 0.49, verdict: "needs-work" },
    { key: "mouthToNoseWidth", value: 1.28, verdict: "needs-work" },
    { key: "jawToCheekbone", value: 0.81, verdict: "needs-work" },
  ];

  for (const c of cases) {
    it(`${c.key} ${c.value} → ${c.verdict}`, () => {
      const band = resolveBand(BANDS[c.key][profile], sex);
      expect(verdictOf(subScore(c.value, band))).toBe(c.verdict);
    });
  }
});

describe("neutral band is the union of dimorphic bands", () => {
  it("a value ideal for either sex is ideal for neutral", () => {
    for (const key of ["fwhr", "jawToCheekbone", "browPosition", "jawAngularity"] as const) {
      const set = BANDS[key]["faceharmony-parity"];
      if (!("masculine" in set)) continue;
      const neutral = resolveBand(set, "neutral");
      for (const sexed of [set.masculine, set.feminine]) {
        for (const v of [sexed.lo, sexed.hi, (sexed.lo + sexed.hi) / 2]) {
          expect(subScore(v, neutral)).toBe(100);
        }
      }
    }
  });
});
