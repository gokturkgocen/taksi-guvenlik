"""FAR / FRR olcumu — farkli threshold'larda yanlis kabul/ret oranlari.

FAR (False Accept Rate): DB'de OLMAYAN biri yanlislikla tanindi mi
FRR (False Reject Rate):  DB'de OLAN biri yanlislikla tanimadi mi

Cikti: CSV. Tezde ROC egrisi + EER noktasi bu CSV'den uretilir.

Kullanim:
    python evaluation/test_far_frr.py \\
        --known known_faces/ \\
        --unknown unknown_faces/ \\
        --out results_far_frr.csv
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

import cv2
import numpy as np
from insightface.app import FaceAnalysis

# face-mac kokunu path'e ekle
sys.path.insert(0, str(Path(__file__).parent.parent))
import db


IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
THRESHOLDS = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70]


def build_app() -> FaceAnalysis:
    app = FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )
    app.prepare(ctx_id=0, det_size=(640, 640))
    return app


def embed(app: FaceAnalysis, img: np.ndarray) -> np.ndarray | None:
    faces = app.get(img)
    if not faces:
        return None
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return face.normed_embedding.astype(np.float32)


def iter_images(folder: Path):
    for p in sorted(folder.rglob("*")):
        if p.is_file() and p.suffix.lower() in IMG_EXTS:
            yield p


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--known", type=Path, required=True,
                    help="DB'deki kisilerin test fotolari (genelde enroll'dan farkli pozlar)")
    ap.add_argument("--unknown", type=Path, required=True,
                    help="DB'de OLMAYAN yabanci yuzlerin fotolari (LFW subset vb.)")
    ap.add_argument("--out", type=Path, default=Path("results_far_frr.csv"))
    args = ap.parse_args()

    people = db.load()
    if not people:
        print("DB bos — once enroll yap")
        sys.exit(1)
    print(f"DB: {len(people)} kisi — {[p.name for p in people]}")

    app = build_app()

    # KNOWN: dogru kisi tanindi mi (FRR icin)
    # UNKNOWN: yanlislikla tanindi mi (FAR icin)
    known_scores: list[tuple[str, str | None, float]] = []  # (gt_name, pred_name, sim)
    unknown_scores: list[tuple[str | None, float]] = []     # (pred_name, sim)

    print("\n[KNOWN] test ediliyor:")
    for sub in sorted(args.known.iterdir()):
        if not sub.is_dir():
            continue
        gt_name = sub.name
        for p in iter_images(sub):
            img = cv2.imread(str(p))
            if img is None:
                continue
            emb = embed(app, img)
            if emb is None:
                print(f"  skip (yuz yok): {p}")
                continue
            # En yakin esleseni bul (threshold'siz)
            sims = np.array([float(np.dot(emb, pp.embedding)) for pp in people])
            idx = int(np.argmax(sims))
            known_scores.append((gt_name, people[idx].name, float(sims[idx])))
            print(f"  {p.name}  gt={gt_name}  top={people[idx].name}  sim={sims[idx]:.3f}")

    print("\n[UNKNOWN] test ediliyor:")
    for p in iter_images(args.unknown):
        img = cv2.imread(str(p))
        if img is None:
            continue
        emb = embed(app, img)
        if emb is None:
            continue
        sims = np.array([float(np.dot(emb, pp.embedding)) for pp in people])
        idx = int(np.argmax(sims))
        unknown_scores.append((people[idx].name, float(sims[idx])))
        print(f"  {p.name}  top={people[idx].name}  sim={sims[idx]:.3f}")

    # Threshold sweep
    print(f"\n{'thr':>5} {'FAR':>8} {'FRR':>8} {'acc':>8}")
    rows = []
    for thr in THRESHOLDS:
        fa = sum(1 for _, s in unknown_scores if s >= thr)
        far = fa / max(1, len(unknown_scores))
        # FRR: known icin ya es yanlis ya sim < thr
        fr = sum(1 for gt, pred, s in known_scores if s < thr or pred != gt)
        frr = fr / max(1, len(known_scores))
        total = len(known_scores) + len(unknown_scores)
        correct = (len(known_scores) - fr) + (len(unknown_scores) - fa)
        acc = correct / max(1, total)
        print(f"{thr:>5.2f} {far:>8.3f} {frr:>8.3f} {acc:>8.3f}")
        rows.append((thr, far, frr, acc, fa, len(unknown_scores), fr, len(known_scores)))

    # EER yaklasik (FAR ~ FRR)
    best = min(rows, key=lambda r: abs(r[1] - r[2]))
    print(f"\nEER yaklasik threshold={best[0]:.2f} FAR={best[1]:.3f} FRR={best[2]:.3f}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["threshold", "FAR", "FRR", "accuracy", "FA", "N_unknown", "FR", "N_known"])
        w.writerows(rows)
    print(f"CSV: {args.out}")


if __name__ == "__main__":
    main()
