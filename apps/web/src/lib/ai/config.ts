"use client";

export type AiProviderKind = "none" | "ollama" | "claude";

export interface AiConfig {
  provider: AiProviderKind;
  ollamaUrl: string;
  /** Vision model — needed only for the sanity check (photo goes in). */
  ollamaModel: string;
  /** Lightweight text model — used for summaries/reports (no photo). */
  ollamaTextModel: string;
  claudeApiKey: string;
  claudeModel: string;
}

const KEY = "fh.ai.v1";

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: "none",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "qwen2.5vl:7b",
  ollamaTextModel: "llama3.2:3b",
  claudeApiKey: "",
  claudeModel: "claude-opus-5",
};

export function loadAiConfig(): AiConfig {
  if (typeof window === "undefined") return DEFAULT_AI_CONFIG;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_AI_CONFIG, ...(JSON.parse(raw) as Partial<AiConfig>) };
  } catch {
    // fall through
  }
  return DEFAULT_AI_CONFIG;
}

export function saveAiConfig(c: AiConfig): void {
  localStorage.setItem(KEY, JSON.stringify(c));
}
