/**
 * Calibration harness: run the REAL engine formulas over a landmark corpus
 * (calibration/extract_landmarks.py output) and produce:
 *   1. src/scoring/norms.json — per-metric percentile tables (p1…p99) that
 *      power percentile display in the app
 *   2. a console report placing every band edge inside the population
 *      distribution, so band anchoring is an informed decision, not a guess
 *
 * Usage: pnpm calibrate ../../calibration/landmarks.jsonl
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyze } from "../src/index";
import { BANDS, resolveBand } from "../src/scoring/bands";
import type { MetricKey, Pt, ScanInput } from "../src/types";

const PCTS = [1, 2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 99];

interface Row {
  id: number;
  w: number;
  h: number;
  landmarks: [number, number, number][];
  matrix: number[] | null;
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const t = idx - lo;
  return sorted[lo]! * (1 - t) + sorted[hi]! * t;
}

const file = process.argv[2];
if (!file) {
  console.error("usage: pnpm calibrate <landmarks.jsonl>");
  process.exit(1);
}

const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
console.log(`corpus: ${lines.length} faces`);

const values = new Map<string, number[]>();
let used = 0;
let refused = 0;

for (const line of lines) {
  const row = JSON.parse(line) as Row;
  const landmarks: Pt[] = row.landmarks.map(([x, y, z]) => ({ x, y, z }));
  const input: ScanInput = {
    landmarks,
    imageWidth: row.w,
    imageHeight: row.h,
    mirrored: false,
    transformationMatrix: row.matrix ?? undefined,
    sex: "neutral",
  };
  const result = analyze(input);
  if (!result.ok) {
    refused++;
    continue;
  }
  used++;
  for (const m of result.metrics) {
    // Values only — percentiles are score-system-independent facts.
    if (!values.has(m.key)) values.set(m.key, []);
    values.get(m.key)!.push(m.value);
  }
}

console.log(`scored: ${used}, refused by gates: ${refused}\n`);

const norms: Record<string, { p: number[]; pcts: number[]; n: number; mean: number; sd: number }> = {};
const report: string[] = [];

for (const [key, vals] of values) {
  vals.sort((a, b) => a - b);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  norms[key] = {
    pcts: PCTS,
    p: PCTS.map((p) => Number(percentile(vals, p).toFixed(5))),
    n: vals.length,
    mean: Number(mean.toFixed(5)),
    sd: Number(sd.toFixed(5)),
  };

  // Where do the current parity band edges land in the population?
  const bandSet = BANDS[key as MetricKey]?.["faceharmony-parity"];
  if (bandSet) {
    const band = resolveBand(bandSet, "neutral");
    const pctOf = (v: number) => {
      let below = 0;
      for (const x of vals) if (x < v) below++;
      return ((below / vals.length) * 100).toFixed(0);
    };
    const iqr = percentile(vals, 75) - percentile(vals, 25);
    report.push(
      `${key.padEnd(20)} med=${percentile(vals, 50).toFixed(3).padStart(8)}  ` +
        `band=[${band.lo}, ${band.hi}] → pop pct [${pctOf(band.lo)}%, ${pctOf(band.hi)}%]  ` +
        `IQR=${iqr.toFixed(3)}  robustSD=${(iqr / 1.349).toFixed(3)}`,
    );
  }
}

console.log(report.join("\n"));

const out = {
  meta: {
    source: "FFHQ (Flickr-Faces-HQ) 512px mirror — aggregate statistics only, no images retained",
    faces: used,
    engineNote: "values computed by the production engine formulas; sex-independent raw values",
  },
  metrics: norms,
};
const dest = join(import.meta.dirname, "..", "src", "scoring", "norms.json");
writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`\nwrote ${dest}`);
