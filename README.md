# FreeHarmony

**Free, open-source facial harmony analysis. Every metric. No paywall. Ever.**

FreeHarmony measures your facial proportions — canthal tilt, midface ratio, jaw-to-cheekbone
width, symmetry, and a dozen more — using real landmark geometry that runs entirely in your
browser. It exists because the app it replaces charges $4.99/week to show you numbers your
own webcam already computed, teases you with a flattering fake score, and then reveals a
lower "real" one when you decline to pay.

We think that's garbage. So:

- **Everything is free.** Every metric, every sub-score, the full report, side profile,
  scan history. There is no Pro tier because there is no tier.
- **The score is math, and only math.** Deterministic geometry from MediaPipe face
  landmarks. Same photo in, same score out — auditable in `packages/engine`, which has no
  dependencies and 100% reproducible tests.
- **Your face never leaves your device.** Landmarking and scoring are fully client-side.
  The only thing that can ever leave your browser: an AI second-opinion call to a provider
  *you* configure (your local Ollama, or your own Claude key). Off by default.
- **No dark patterns.** One honest score, shown once. If your photo is too blurry or
  turned too far, we tell you to retake it instead of guessing.

## How scoring works

1. MediaPipe Face Landmarker (WASM, in-browser) finds 478 facial landmarks.
2. `packages/engine` normalizes them (de-mirror, pixel-space, roll-correction) and refuses
   photos it can't measure honestly (excessive yaw/pitch, blur, occlusion, closed eyes).
3. Seventeen metrics are computed from published facial-aesthetics conventions, each scored
   against an ideal band with a smooth falloff curve, then rolled up into four area scores
   and one Harmony %.
4. Optionally, a vision model you control cross-examines the landmarks ("did the jaw point
   land on an ear?") and can flag a scan as unreliable — it can never change the score.

Scores are photo-based estimates for entertainment and self-improvement, not clinical
measurements — lighting, lens distance, and pose all move the numbers. The app says this
in-product, and the advice engine hard-refuses surgical/medication coaching and actively
discourages dangerous community practices.

## Development

```sh
pnpm install
pnpm dev        # Next.js app at localhost:3000
pnpm test       # engine unit tests (no browser needed)
pnpm typecheck
```

Monorepo layout: `apps/web` (Next.js UI) · `packages/engine` (pure-TS scoring, zero deps,
zero DOM) · `packages/advice` (templated improvement-plan rules).

## License

AGPL-3.0. Use it, fork it, ship it — but if you serve a modified version to users, you
must publish your source. Paywalling a fork of the anti-paywall app should at least be
embarrassing in public.
