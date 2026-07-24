"use client";

// Placeholder shell — the full provider config (Ollama preflight, Claude
// key/OAuth) lands with the AI layer.
export function AiSettings() {
  return (
    <section className="card p-5 flex flex-col gap-2">
      <p className="label-caps">AI second opinion</p>
      <p className="text-sm text-ink-2">
        Optional. Connect your own AI provider (local Ollama or your Claude
        account) to sanity-check scans and generate a narrative report. Off by
        default; scoring never depends on it.
      </p>
      <p className="text-xs text-ink-3">Coming online in this build soon.</p>
    </section>
  );
}
