import { z } from "zod";

export const PHOTO_FLAGS = [
  "occlusion-hair",
  "occlusion-glasses",
  "occlusion-hand",
  "occlusion-facial-hair",
  "heavy-makeup",
  "strong-side-lighting",
  "wide-angle-distortion",
  "non-neutral-expression",
  "head-turned",
  "head-tilted-up-or-down",
  "low-resolution",
  "heavy-filter-or-beautify",
] as const;

export const SanityCheckSchema = z.object({
  photoQuality: z.object({
    usable: z.boolean(),
    flags: z.array(z.enum(PHOTO_FLAGS)).default([]),
    notes: z.string().max(500).default(""),
  }),
  landmarkPlausibility: z
    .array(
      z.object({
        metric: z.string(),
        verdict: z.enum(["plausible", "suspect", "clearly-wrong"]),
        reason: z.string().max(300).default(""),
      }),
    )
    .default([]),
  coarseHarmony100: z.number().min(0).max(100),
  coarseTier: z.enum(["excellent", "good", "fair", "needs-work"]),
  coarseConfidence: z.enum(["low", "medium", "high"]),
  dominantImpressions: z.array(z.string().max(160)).max(5).default([]),
});

export type SanityCheck = z.infer<typeof SanityCheckSchema>;

export type ScanConfidence = "high" | "medium" | "low";

export interface SanityAnnotation {
  check: SanityCheck;
  /** |AI estimate − geometric overall| */
  delta: number;
  confidence: ScanConfidence;
  suspectMetrics: string[];
  recommendRetake: boolean;
  model: string;
  at: number;
}

export interface DeepReport {
  text: string;
  model: string;
  at: number;
}
