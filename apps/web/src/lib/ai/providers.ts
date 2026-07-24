"use client";

import Anthropic from "@anthropic-ai/sdk";
import type { AiConfig } from "./config";

export interface VisionRequest {
  system: string;
  userText: string;
  /** base64 JPEG payloads, no data: prefix. Empty = text-only request. */
  images: string[];
  maxTokens: number;
  /** Text-only requests can run on a much lighter local model. */
  preferTextModel?: boolean;
}

/** Call the configured provider; returns the raw text response. */
export async function callVision(cfg: AiConfig, req: VisionRequest): Promise<string> {
  if (cfg.provider === "ollama") return callOllama(cfg, req);
  if (cfg.provider === "claude") return callClaude(cfg, req);
  throw new Error("No AI provider configured");
}

async function callOllama(cfg: AiConfig, req: VisionRequest): Promise<string> {
  const textOnly = req.images.length === 0;
  const model = textOnly && req.preferTextModel ? cfg.ollamaTextModel : cfg.ollamaModel;
  const res = await fetch(`${cfg.ollamaUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: req.system },
        textOnly
          ? { role: "user", content: req.userText }
          : { role: "user", content: req.userText, images: req.images },
      ],
      options: { temperature: 0, seed: 7 },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { message?: { content?: string } };
  const text = json.message?.content;
  if (!text) throw new Error("Ollama returned an empty response");
  return text;
}

async function callClaude(cfg: AiConfig, req: VisionRequest): Promise<string> {
  if (!cfg.claudeApiKey) throw new Error("No Claude API key configured");
  const client = new Anthropic({
    apiKey: cfg.claudeApiKey,
    dangerouslyAllowBrowser: true, // key is the user's own, stored locally
  });
  const response = await client.messages.create({
    model: cfg.claudeModel,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [
      {
        role: "user",
        content: [
          ...req.images.map(
            (data) =>
              ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: "image/jpeg" as const,
                  data,
                },
              }),
          ),
          { type: "text" as const, text: req.userText },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this request.");
  }
  const text = response.content
    .filter((b): b is { type: "text"; text: string; citations: never } => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text) throw new Error("Claude returned an empty response");
  return text;
}

export type OllamaPreflight =
  | { ok: true; visionModels: string[]; hasConfiguredModel: boolean }
  | {
      ok: false;
      problem: "unreachable" | "mixed-content" | "no-vision-model" | "http-error";
      detail: string;
      fix: string;
    };

const VISION_HINTS = ["vl", "vision", "llava", "gemma3", "moondream", "minicpm"];

/** Diagnose the local Ollama connection with an actionable fix per failure. */
export async function preflightOllama(cfg: AiConfig): Promise<OllamaPreflight> {
  const base = cfg.ollamaUrl.replace(/\/$/, "");
  const pageIsHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const targetIsLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1)/.test(base);
  try {
    const res = await fetch(`${base}/api/tags`, { method: "GET" });
    if (!res.ok) {
      return {
        ok: false,
        problem: "http-error",
        detail: `Ollama answered HTTP ${res.status}.`,
        fix: "Check that OLLAMA_ORIGINS includes this site's origin, then restart Ollama.",
      };
    }
    const json = (await res.json()) as { models?: Array<{ name: string }> };
    const names = (json.models ?? []).map((m) => m.name);
    const vision = names.filter((n) =>
      VISION_HINTS.some((h) => n.toLowerCase().includes(h)),
    );
    if (vision.length === 0) {
      return {
        ok: false,
        problem: "no-vision-model",
        detail: `Ollama is running with ${names.length} model(s), but none look vision-capable.`,
        fix: "Run:  ollama pull qwen2.5vl:7b",
      };
    }
    return {
      ok: true,
      visionModels: vision,
      hasConfiguredModel: names.some((n) => n.startsWith(cfg.ollamaModel.split(":")[0]!)),
    };
  } catch {
    if (pageIsHttps && targetIsLocalHttp) {
      const isSafari =
        typeof navigator !== "undefined" &&
        /safari/i.test(navigator.userAgent) &&
        !/chrome|chromium|edg/i.test(navigator.userAgent);
      if (isSafari) {
        return {
          ok: false,
          problem: "mixed-content",
          detail: "Safari blocks HTTPS pages from calling http://localhost.",
          fix: "Use Chrome or Firefox for the local-AI feature, or run the app locally over http://localhost.",
        };
      }
    }
    return {
      ok: false,
      problem: "unreachable",
      detail: "Couldn't reach Ollama at all (connection refused or blocked).",
      fix: `1) Install & start Ollama (ollama serve). 2) Allow this origin: OLLAMA_ORIGINS=${typeof window !== "undefined" ? window.location.origin : "<site-origin>"} ollama serve. 3) Pull a vision model: ollama pull qwen2.5vl:7b`,
    };
  }
}
