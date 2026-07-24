#!/usr/bin/env python3
"""Extract MediaPipe Face Landmarker landmarks from an FFHQ mirror.

Runs the SAME face_landmarker.task model the web app ships, via the official
mediapipe Python package, over N faces streamed from Hugging Face parquet
shards. Output: JSONL, one line per detected face:
  {"id": ..., "w": ..., "h": ..., "landmarks": [[x,y,z]*478], "matrix": [16]}

Images are used transiently to compute geometry; nothing but numbers is kept.
Zero LLM involvement — pure local compute.
"""
import argparse
import io
import json
import sys
from pathlib import Path

import mediapipe as mp
import numpy as np
import pyarrow.parquet as pq
from huggingface_hub import hf_hub_download
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from PIL import Image

REPO = "Ryan-sjtu/ffhq512-caption"
SHARD_TMPL = "data/train-{i:05d}-of-00054-{h}.parquet"

MODEL = Path(__file__).parent.parent / "apps/web/public/mediapipe/face_landmarker.task"


def make_landmarker() -> vision.FaceLandmarker:
    options = vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=1,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=True,
        min_face_detection_confidence=0.5,
    )
    return vision.FaceLandmarker.create_from_options(options)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=3000, help="max faces to extract")
    ap.add_argument("--shards", type=int, default=4, help="parquet shards to stream")
    ap.add_argument("--out", default="landmarks.jsonl")
    args = ap.parse_args()

    if not MODEL.exists():
        sys.exit(f"model not found at {MODEL} — run the web app's prepare-assets first")

    from huggingface_hub import HfApi

    files = [
        f
        for f in HfApi().list_repo_files(REPO, repo_type="dataset")
        if f.endswith(".parquet")
    ][: args.shards]

    landmarker = make_landmarker()
    out_path = Path(args.out)
    n_done = 0
    n_skipped = 0

    with out_path.open("w") as out:
        for shard in files:
            if n_done >= args.limit:
                break
            local = hf_hub_download(REPO, shard, repo_type="dataset")
            table = pq.read_table(local, columns=["image"])
            for batch in table.to_batches(max_chunksize=64):
                if n_done >= args.limit:
                    break
                for img_struct in batch.column("image"):
                    if n_done >= args.limit:
                        break
                    try:
                        raw = img_struct["bytes"].as_py()
                        pil = Image.open(io.BytesIO(raw)).convert("RGB")
                        mp_img = mp.Image(
                            image_format=mp.ImageFormat.SRGB,
                            data=np.asarray(pil),
                        )
                        res = landmarker.detect(mp_img)
                        if len(res.face_landmarks) != 1:
                            n_skipped += 1
                            continue
                        lms = [
                            [round(p.x, 6), round(p.y, 6), round(p.z, 6)]
                            for p in res.face_landmarks[0]
                        ]
                        matrix = None
                        if res.facial_transformation_matrixes:
                            m = res.facial_transformation_matrixes[0]
                            # numpy 4x4, row-major → flatten column-major to
                            # mirror the browser API's layout
                            matrix = [float(m[r][c]) for c in range(4) for r in range(4)]
                        out.write(
                            json.dumps(
                                {
                                    "id": n_done,
                                    "w": pil.width,
                                    "h": pil.height,
                                    "landmarks": lms,
                                    "matrix": matrix,
                                }
                            )
                            + "\n"
                        )
                        n_done += 1
                        if n_done % 100 == 0:
                            print(f"{n_done} faces extracted ({n_skipped} skipped)", flush=True)
                    except Exception as e:  # noqa: BLE001 — skip bad rows, keep going
                        n_skipped += 1
                        if n_skipped % 200 == 0:
                            print(f"skip #{n_skipped}: {e}", file=sys.stderr, flush=True)

    print(f"DONE: {n_done} faces → {out_path} ({n_skipped} skipped)")


if __name__ == "__main__":
    main()
