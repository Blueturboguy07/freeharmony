import { describe, expect, it } from "vitest";
import { analyze } from "../src/index.js";
import { canonicalInput } from "./helpers.js";

describe("determinism", () => {
  it("500 identical runs produce byte-identical JSON", () => {
    const first = JSON.stringify(analyze(canonicalInput()));
    for (let i = 0; i < 500; i++) {
      expect(JSON.stringify(analyze(canonicalInput()))).toBe(first);
    }
  });

  it("result is stable under object-key insertion order changes in input", () => {
    const a = analyze(canonicalInput({ sex: "masculine", bandProfile: "faceharmony-parity" }));
    const input2 = { ...canonicalInput() };
    // same values, different property insertion order
    const reordered = {
      bandProfile: "faceharmony-parity" as const,
      sex: "masculine" as const,
      ...input2,
      sex2: undefined,
    };
    delete (reordered as Record<string, unknown>).sex2;
    const b = analyze({ ...reordered, sex: "masculine", bandProfile: "faceharmony-parity" });
    expect(b.overall).toBe(a.overall);
  });
});
