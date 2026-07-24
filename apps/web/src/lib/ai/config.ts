"use client";

export type AiProviderKind = "none" | "ollama" | "claude";

export interface AiConfig {
  provider: AiProviderKind;
  ollamaUrl: string;
  ollamaModel: string;
  claudeApiKey: string;
  claudeModel: string;
}

const KEY = "fh.ai.v1";

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: "none",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "qwen2.5vl:7b",
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
