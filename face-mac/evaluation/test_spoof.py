"""Anti-spoof saldiri detection rate olcumu.

`spoof_samples/` altinda her alt klasor bir saldiri tipini temsil eder
(ornek: print/, screen/, replay/). Icindeki .mp4 dosyalarinin her frame'i
canli/spoof karari icin gecirilir. `pass_rate = spoof kabul orani` —
dusuk olmali.

Kullanim:
    python evaluation/test_spoof.py --attacks spoof_samples/

Cikti:
    attack    N_frame  cnn_reject_rate  motion_reject_rate  overall_reject_rate
    print     342      0.78             0.95                0.98
    screen    250      0.92             0.82                0.94
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import defaultdict, deque
from pathlib import Path

import cv2
import numpy as np
from insightface.app import FaceAnalysis

sys.path.insert(0, str(Path(__file__).parent.parent))
from antispoof import AntiSpoof


VID_EXTS = {".mp4", ".mov", ".avi", ".mkv"}
SPOOF_THR = 0.6
MOTION_THR = 1.5


def build_app() -> FaceAnalysis:
    app = FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection"],
        providers=["CPUExecutionProvider"],
    )
    app.prepare(ctx_id=0, det_size=(640, 640))
    return app


def crop_grayscale(frame: np.ndarray, bbox) -> np.ndarray | None:
    x1, y1, x2, y2 = [int(v) for v in bbox]
    h, w = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    if x2 <= x1 or y2 <= y1:
        return None
    gray = cv2.cvtColor(frame[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
    return cv2.resize(gray, (64, 64), interpolation=cv2.INTER_AREA)


def process_video(path: Path, app, anti) -> dict:
    cap = cv2.VideoCapture(str(path))
    cnn_scores: list[float] = []
    motions: list[float] = []
    prev_crop = None
    n_face_frame = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        faces = app.get(frame)
        if not faces:
            continue
        n_face_frame += 1
        face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        _, real = anti.predict(frame, face.bbox)
        cnn_scores.append(real)
        crop = crop_grayscale(frame, face.bbox)
        if crop is not None and prev_crop is not None:
            motions.append(float(cv2.absdiff(crop, prev_crop).mean()))
        if crop is not None:
            prev_crop = crop
    cap.release()

    cnn_rejected = sum(1 for s in cnn_scores if s < SPOOF_THR)
    motion_rejected = sum(1 for m in motions if m < MOTION_THR)
    overall_rejected = sum(
        1 for i in range(len(cnn_scores))
        if cnn_scores[i] < SPOOF_THR or (i < len(motions) and motions[i] < MOTION_THR)
    )
    return {
        "video": path.name,
        "n": n_face_frame,
        "cnn_reject_rate": cnn_rejected / max(1, len(cnn_scores)),
        "motion_reject_rate": motion_rejected / max(1, len(motions)),
        "overall_reject_rate": overall_rejected / max(1, len(cnn_scores)),
        "cnn_mean": float(np.mean(cnn_scores)) if cnn_scores else 0.0,
        "motion_mean": float(np.mean(motions)) if motions else 0.0,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--attacks", type=Path, default=Path("spoof_samples"))
    ap.add_argument("--out", type=Path, default=Path("results_spoof.csv"))
    args = ap.parse_args()

    if not args.attacks.is_dir():
        print(f"Klasor yok: {args.attacks}")
        sys.exit(1)

    print("Model yukleniyor...")
    app = build_app()
    anti = AntiSpoof()

    rows: list[dict] = []
    for sub in sorted(args.attacks.iterdir()):
        if not sub.is_dir():
            continue
        attack = sub.name
        print(f"\n[{attack}]")
        for vid in sorted(sub.iterdir()):
            if vid.suffix.lower() not in VID_EXTS:
                continue
            print(f"  {vid.name} isleniyor...")
            r = process_video(vid, app, anti)
            r["attack"] = attack
            print(f"    n={r['n']}  cnn_rej={r['cnn_reject_rate']:.2f}  "
                  f"mot_rej={r['motion_reject_rate']:.2f}  "
                  f"overall={r['overall_reject_rate']:.2f}  "
                  f"cnn_mean={r['cnn_mean']:.2f}  mot_mean={r['motion_mean']:.2f}")
            rows.append(r)

    if not rows:
        print("Hic video bulunamadi.")
        sys.exit(1)

    # Attack bazinda aggregate
    print(f"\n{'attack':>12} {'videos':>8} {'cnn_rej':>10} {'mot_rej':>10} {'overall':>10}")
    agg: dict[str, list] = defaultdict(list)
    for r in rows:
        agg[r["attack"]].append(r)
    for atk, lst in agg.items():
        cnn = np.mean([r["cnn_reject_rate"] for r in lst])
        mot = np.mean([r["motion_reject_rate"] for r in lst])
        ov = np.mean([r["overall_reject_rate"] for r in lst])
        print(f"{atk:>12} {len(lst):>8} {cnn:>10.3f} {mot:>10.3f} {ov:>10.3f}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "attack", "video", "n",
            "cnn_reject_rate", "motion_reject_rate", "overall_reject_rate",
            "cnn_mean", "motion_mean",
        ])
        w.writeheader()
        w.writerows(rows)
    print(f"\nCSV: {args.out}")


if __name__ == "__main__":
    main()
