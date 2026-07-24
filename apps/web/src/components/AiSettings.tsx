"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_AI_CONFIG,
  loadAiConfig,
  preflightOllama,
  saveAiConfig,
  type AiConfig,
  type OllamaPreflight,
} from "@/lib/ai";

export function AiSettings() {
  const [cfg, setCfg] = useState<AiConfig>(DEFAULT_AI_CONFIG);
  const [preflight, setPreflight] = useState<OllamaPreflight | "testing" | null>(null);

  useEffect(() => {
    setCfg(loadAiConfig());
  }, []);

  const update = (patch: Partial<AiConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    saveAiConfig(next);
  };

  return (
    <section className="card p-5 flex flex-col gap-4">
      <div>
        <p className="label-caps">AI second opinion</p>
        <p className="mt-1 text-sm text-ink-2">
          Optional cross-check and narrative report from an AI provider{" "}
          <em>you</em> control. It can flag a scan as unreliable — it can never
          change the score. Off by default.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["none", "Off"],
            ["ollama", "Local (Ollama)"],
            ["claude", "Claude"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => update({ provider: value })}
            className={`card py-3 text-sm ${cfg.provider === value ? "border-gold/70" : "text-ink-2"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {cfg.provider === "ollama" && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-2">Ollama URL</span>
            <input
              value={cfg.ollamaUrl}
              onChange={(e) => update({ ollamaUrl: e.target.value })}
              className="rounded-chip border border-line bg-surface-raised px-3 py-2 text-sm"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-2">Vision model</span>
            <input
              value={cfg.ollamaModel}
              onChange={(e) => update({ ollamaModel: e.target.value })}
              className="rounded-chip border border-line bg-surface-raised px-3 py-2 text-sm"
              spellCheck={false}
            />
          </label>
          <button
            onClick={async () => {
              setPreflight("testing");
              setPreflight(await preflightOllama(cfg));
            }}
            className="card py-2.5 text-sm text-ink-2 hover:text-ink"
          >
            {preflight === "testing" ? "Testing…" : "Test connection"}
          </button>
          {preflight && preflight !== "testing" && (
            <div className={`rounded-chip border p-3 text-sm ${preflight.ok ? "border-ideal/40 text-ideal" : "border-work/40"}`}>
              {preflight.ok ? (
                <p>
                  Connected — vision models: {preflight.visionModels.join(", ")}
                  {!preflight.hasConfiguredModel &&
                    ` (heads up: "${cfg.ollamaModel}" isn't among them)`}
                </p>
              ) : (
                <>
                  <p className="text-work">{preflight.detail}</p>
                  <p className="mt-1 whitespace-pre-wrap font-mono text-xs text-ink-2">{preflight.fix}</p>
                </>
              )}
            </div>
          )}
          <p className="text-xs text-ink-3">
            Runs entirely on your machine. Your photo goes to localhost and
            nowhere else.
          </p>
        </div>
      )}

      {cfg.provider === "claude" && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-2">Your Anthropic API key</span>
            <input
              type="password"
              value={cfg.claudeApiKey}
              onChange={(e) => update({ claudeApiKey: e.target.value })}
              placeholder="sk-ant-…"
              className="rounded-chip border border-line bg-surface-raised px-3 py-2 text-sm"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-2">Model</span>
            <input
              value={cfg.claudeModel}
              onChange={(e) => update({ claudeModel: e.target.value })}
              className="rounded-chip border border-line bg-surface-raised px-3 py-2 text-sm"
              spellCheck={false}
            />
          </label>
          <p className="text-xs text-ink-3">
            The key is stored only in this browser and calls Anthropic directly
            from it — there is no middleman server. A scan check costs a few
            cents on your key. Get a key at console.anthropic.com.
          </p>
        </div>
      )}
    </section>
  );
}
