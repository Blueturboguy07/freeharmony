"use client";

import { generatePlan } from "@freeharmony/advice";
import type { Sex } from "@freeharmony/engine";
import type { StoredScan } from "../store";
import { loadAiConfig } from "./config";
import { buildAnnotatedOverlay, dataUrlToBase64 } from "./overlay";
import { buildMeasurementPayload, REPORT_SYSTEM, SANITY_SYSTEM } from "./prompt";
import { callVision } from "./providers";
import {
  SanityCheckSchema,
  type DeepReport,
  type SanityAnnotation,
  type ScanConfidence,
} from "./schema";

export { loadAiConfig, saveAiConfig, DEFAULT_AI_CONFIG } from "./config";
export type { AiConfig, AiProviderKind } from "./config";
export { preflightOllama } from "./providers";
export type { OllamaPreflight } from "./providers";
export type { SanityAnnotation, DeepReport, ScanConfidence } from "./schema";

/**
 * Reconciliation between the deterministic score and the AI's independent
 * estimate. Divergence is a signal about MEASUREMENT VALIDITY, not two noisy
 * reads of one number — so the two are never averaged. The AI can only lower
 * displayed confidence and recommend a retake.
 */
export function reconcile(
  geoOverall: number,
  check: SanityAnnotation["check"],
): Pick<SanityAnnotation, "delta" | "confidence" | "suspectMetrics" | "recommendRetake"> {
  const delta = Math.abs(check.coarseHarmony100 - geoOverall);
  const suspectMetrics = check.landmarkPlausibility
    .filter((p) => p.verdict !== "plausible")
    .map((p) => p.metric);
  const clearlyWrong = check.landmarkPlausibility.some(
    (p) => p.verdict === "clearly-wrong",
  );

  let confidence: ScanConfidence = delta <= 8 ? "high" : delta <= 15 ? "medium" : "low";
  if (clearlyWrong || !check.photoQuality.usable) confidence = "low";
  else if (check.coarseConfidence === "low" && confidence === "high") confidence = "medium";

  return {
    delta,
    confidence,
    suspectMetrics,
    recommendRetake: confidence === "low",
  };
}

function stableHash(s: string): string {
  // djb2 — cache key material, not cryptographic.
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function extractJson(text: string): unknown {
  // Models occasionally wrap JSON in fences or prose despite instructions.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in response");
  return JSON.parse(text.slice(start, end + 1));
}

const CACHE_KEY = "fh.ai.cache.v1";

function cacheGet(key: string): SanityAnnotation | null {
  try {
    const map = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, SanityAnnotation>;
    return map[key] ?? null;
  } catch {
    return null;
  }
}

function cachePut(key: string, value: SanityAnnotation): void {
  try {
    const map = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, SanityAnnotation>;
    const entries = Object.entries(map).slice(-9);
    entries.push([key, value]);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // cache is best-effort
  }
}

/**
 * Run the AI sanity check for a stored scan. Requires a configured provider.
 * The scan's photo + measurements are sent ONLY here, only on user action.
 */
export async function runSanityCheck(scan: StoredScan): Promise<SanityAnnotation> {
  const cfg = loadAiConfig();
  if (cfg.provider === "none") throw new Error("No AI provider configured");
  if (!scan.input || scan.result.overall === null) {
    throw new Error("This scan can't be checked (missing raw landmarks)");
  }

  const payload = buildMeasurementPayload(scan.result);
  const key = stableHash(
    scan.photo.length + ":" + scan.photo.slice(-64) + payload + cfg.provider + cfg.claudeModel + cfg.ollamaModel,
  );
  const cached = cacheGet(key);
  if (cached) return cached;

  const overlay = await buildAnnotatedOverlay(scan.photo, scan.input, scan.overrides);
  const userText = `Image 1 is the clean portrait. Image 2 is the SAME portrait with the app's measurement construction drawn in gold.

Computed measurements:
${payload}

Evaluate per your instructions and answer with the JSON object only.`;

  const req = {
    system: SANITY_SYSTEM,
    userText,
    images: [dataUrlToBase64(scan.photo), dataUrlToBase64(overlay)],
    maxTokens: 2000,
  };

  let parsed: unknown;
  try {
    parsed = extractJson(await callVision(cfg, req));
  } catch {
    // one retry, then fail closed
    parsed = extractJson(await callVision(cfg, req));
  }
  const check = SanityCheckSchema.parse(parsed);

  const annotation: SanityAnnotation = {
    check,
    ...reconcile(scan.result.overall, check),
    model: cfg.provider === "claude" ? cfg.claudeModel : cfg.ollamaModel,
    at: Date.now(),
  };
  cachePut(key, annotation);
  return annotation;
}

/** Generate the narrative deep report (markdown). */
export async function runDeepReport(scan: StoredScan, sex: Sex, ageRange?: string): Promise<DeepReport> {
  const cfg = loadAiConfig();
  if (cfg.provider === "none") throw new Error("No AI provider configured");
  if (scan.result.overall === null) throw new Error("No score to report on");

  const plan = generatePlan(scan.result, sex);
  const userText = `Profile: presentation=${sex}${ageRange ? `, age=${ageRange}` : ""}.

Computed measurements:
${buildMeasurementPayload(scan.result)}

Deterministic plan items (expand on these, in this order):
${plan.items.slice(0, 6).map((p, i) => `${i + 1}. ${p.rule.title} — ${p.reason}`).join("\n")}

Write the report.`;

  const text = await callVision(cfg, {
    system: REPORT_SYSTEM,
    userText,
    images: [dataUrlToBase64(scan.photo)],
    maxTokens: 4000,
  });

  return {
    text,
    model: cfg.provider === "claude" ? cfg.claudeModel : cfg.ollamaModel,
    at: Date.now(),
  };
}
