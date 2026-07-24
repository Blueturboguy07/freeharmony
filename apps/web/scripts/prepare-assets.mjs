// Copies the MediaPipe WASM runtime from node_modules and downloads the
// face_landmarker model into public/ so the deployed app is fully
// self-contained — no runtime calls to Google's CDN, which is part of the
// "your face never leaves your device" claim (the model is fetched from OUR
// origin, and inference is local).
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const app = join(root, "..");
const wasmSrc = join(app, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmDst = join(app, "public", "mediapipe", "wasm");
const modelDst = join(app, "public", "mediapipe", "face_landmarker.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

mkdirSync(join(app, "public", "mediapipe"), { recursive: true });

if (existsSync(wasmSrc)) {
  cpSync(wasmSrc, wasmDst, { recursive: true });
  console.log("[assets] wasm copied to public/mediapipe/wasm");
} else {
  console.warn("[assets] @mediapipe/tasks-vision wasm not found — run pnpm install first");
}

if (!existsSync(modelDst) || statSync(modelDst).size < 1_000_000) {
  console.log("[assets] downloading face_landmarker.task …");
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(modelDst, buf);
  console.log(`[assets] model saved (${(buf.length / 1e6).toFixed(1)} MB)`);
} else {
  console.log("[assets] model already present");
}
