"""E2E pipeline latency olcumu.

Webcam'den N saniye boyunca frame alir, tum pipeline'i (detect + embed +
match + antispoof + mediapipe) calistirir, her frame icin ms olcer.
Sonuc: p50/p95/p99 + CSV.

Kullanim:
    python evaluation/test_latency.py --seconds 60
    python evaluation/test_latency.py --seconds 30 --no-antispoof
"""
from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from insightface.app import FaceAnalysis

sys.path.insert(0, str(Path(__file__).parent.parent))
import db
from antispoof import AntiSpoof
from liveness_challenge import ActiveLiveness


def build_app(det_size: int) -> FaceAnalysis:
    app = FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )
    app.prepare(ctx_id=0, det_size=(det_size, det_size))
    return app


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=int, default=60)
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--det-size", type=int, default=640)
    ap.add_argument("--no-antispoof", action="store_true")
    ap.add_argument("--no-challenge", action="store_true")
    ap.add_argument("--out", type=Path, default=Path("results_latency.csv"))
    args = ap.parse_args()

    people = db.load()
    if not people:
        print("DB bos")
        sys.exit(1)

    print(f"Model yukleniyor... (det_size={args.det_size})")
    app = build_app(args.det_size)
    antispoof = None if args.no_antispoof else AntiSpoof()
    active = None if args.no_challenge else ActiveLiveness()

    cam = cv2.VideoCapture(args.camera)
    if not cam.isOpened():
        print("Kamera acilamadi")
        sys.exit(1)

    # Warmup
    for _ in range(5):
        cam.read()

    print(f"{args.seconds} sn olcum basliyor...")
    t_end = time.time() + args.seconds
    samples: list[tuple[float, float, float, float, float]] = []
    # (detect_ms, anti_ms, mesh_ms, match_ms, total_ms)

    while time.time() < t_end:
        ok, frame = cam.read()
        if not ok:
            continue

        t0 = time.perf_counter()
        faces = app.get(frame)
        t_det = time.perf_counter()

        # anti-spoof
        if antispoof and faces:
            for f in faces:
                antispoof.predict(frame, f.bbox)
        t_anti = time.perf_counter()

        # mesh
        if active:
            active.analyze_frame(frame)
        t_mesh = time.perf_counter()

        # match
        for f in faces:
            emb = f.normed_embedding.astype(np.float32)
            db.match(emb, people, 0.5)
        t_match = time.perf_counter()

        samples.append((
            (t_det - t0) * 1000,
            (t_anti - t_det) * 1000,
            (t_mesh - t_anti) * 1000,
            (t_match - t_mesh) * 1000,
            (t_match - t0) * 1000,
        ))

    cam.release()
    if not samples:
        print("Hic ornek alinamadi")
        sys.exit(1)

    arr = np.array(samples)
    cols = ["detect", "antispoof", "mesh", "match", "total"]
    print(f"\nN = {len(samples)} frame\n")
    print(f"{'stage':>10} {'mean':>8} {'p50':>8} {'p95':>8} {'p99':>8} {'max':>8}")
    for i, col in enumerate(cols):
        c = arr[:, i]
        print(f"{col:>10} {c.mean():>8.2f} {np.percentile(c, 50):>8.2f} "
              f"{np.percentile(c, 95):>8.2f} {np.percentile(c, 99):>8.2f} "
              f"{c.max():>8.2f}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        w.writerows(samples)
    print(f"\nCSV: {args.out}")
    print(f"Rapor hedefi: total p95 < 200 ms -> "
          f"{'GECER' if np.percentile(arr[:,4], 95) < 200 else 'KALIR'}")


if __name__ == "__main__":
    main()
