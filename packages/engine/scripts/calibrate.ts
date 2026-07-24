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
const metricScores = new Map<string, number[]>();
const overallScores: number[] = [];
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
    // Score distributions must reflect what the app actually ships.
    bandProfile: "calibrated",
  };
  const result = analyze(input);
  if (!result.ok) {
    refused++;
    continue;
  }
  used++;
  if (result.overall !== null) overallScores.push(result.overall);
  for (const m of result.metrics) {
    // Raw values — score-system-independent facts.
    if (!values.has(m.key)) values.set(m.key, []);
    values.get(m.key)!.push(m.value);
    // Scores under the calibrated profile — for score-space standardization.
    if (!metricScores.has(m.key)) metricScores.set(m.key, []);
    metricScores.get(m.key)!.push(m.score);
  }
}

console.log(`scored: ${used}, refused by gates: ${refused}\n`);

const norms: Record<string, { p: number[]; pcts: number[]; n: number; mean: number; sd: number }> = {};
const report: string[] = [];

for (const [key, vals] of values) {
  vals.sort((a, b) => a - b);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  // Degenerate distribution (e.g. jawlineDefinition with no image pixels in
  // the corpus): a percentile table would be meaningless — omit it so the
  // app shows no percentile for that metric.
  if (percentile(vals, 75) - percentile(vals, 25) < 1e-9) {
    console.log(`${key.padEnd(20)} skipped (degenerate distribution in this corpus)`);
    continue;
  }
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

// ---- score-space statistics (calibrated profile) ----------------------------
overallScores.sort((a, b) => a - b);
const oMean = overallScores.reduce((a, b) => a + b, 0) / overallScores.length;
const oSd = Math.sqrt(
  overallScores.reduce((a, b) => a + (b - oMean) ** 2, 0) / overallScores.length,
);
const scoreStats = {
  overall: {
    pcts: PCTS,
    p: PCTS.map((p) => Number(percentile(overallScores, p).toFixed(2))),
    n: overallScores.length,
    mean: Number(oMean.toFixed(3)),
    median: Number(percentile(overallScores, 50).toFixed(3)),
    sd: Number(oSd.toFixed(3)),
  },
  byMetric: {} as Record<string, { mean: number; median: number; sd: number }>,
};
for (const [key, arr] of metricScores) {
  arr.sort((a, b) => a - b);
  const mMean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const mSd = Math.sqrt(arr.reduce((a, b) => a + (b - mMean) ** 2, 0) / arr.length);
  scoreStats.byMetric[key] = {
    mean: Number(mMean.toFixed(2)),
    median: Number(percentile(arr, 50).toFixed(2)),
    sd: Number(mSd.toFixed(2)),
  };
}
console.log(
  `\noverall harmony (calibrated profile): mean=${scoreStats.overall.mean} ` +
    `median=${scoreStats.overall.median} sd=${scoreStats.overall.sd} n=${scoreStats.overall.n}`,
);

const out = {
  meta: {
    source: "FFHQ (Flickr-Faces-HQ) 512px mirror — aggregate statistics only, no images retained",
    faces: used,
    engineNote:
      "values computed by the production engine formulas (sex-independent); score stats under the 'calibrated' band profile. Corpus is broad internet photos, unlabeled — norms are vs. a general population, not per-group.",
  },
  metrics: norms,
  scores: scoreStats,
};
const dest = join(import.meta.dirname, "..", "src", "scoring", "norms.json");
writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`\nwrote ${dest}`);
