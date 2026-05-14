"""Bulk-enroll a directory of `<name>/<image>.jpg` into the local pickle DB.

The server reads `DB_PATH` (defaults to embeddings.pkl) at import time, so the
typical workflow is:

    1. python bulk_enroll.py ./gallery --db /tmp/run_001.pkl
    2. scp /tmp/run_001.pkl ec2-user@...:/tmp/
    3. ssh ec2-user@... 'docker cp /tmp/run_001.pkl taxi-server:/app/data/embeddings.pkl'
    4. ssh ec2-user@... 'docker restart taxi-server'

For each subject's directory we pick the highest-quality frame (by
det_score × blur) as the enrollment shot. Lower-quality candidates are
skipped unless --allow-low-quality is set, in which case the first image is
forced in.

Usage
-----
    python bulk_enroll.py /path/to/gallery_dir
    python bulk_enroll.py /path/to/gallery_dir --db /tmp/test.pkl
    python bulk_enroll.py /path/to/gallery_dir --allow-low-quality

Gallery directory layout:
    gallery_dir/
        Alice_Yilmaz/
            01.jpg
            02.jpg
        Bob_Demir/
            01.jpg
        ...
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Make the server package importable when running from face-mac/eval/.
THIS = Path(__file__).resolve()
sys.path.insert(0, str(THIS.parent.parent / "server"))

from db import FaceDB            # type: ignore  # noqa: E402
from recognition import Recognizer  # type: ignore  # noqa: E402


SUPPORTED_EXTS = (".jpg", ".jpeg", ".png")


def pick_best(recognizer: Recognizer, paths: list[Path]) -> tuple[Path, dict] | None:
    """Return the (path, face) of the highest-scoring quality-passing image,
    or None if every image fails."""
    best: tuple[Path, dict, float] | None = None
    for p in paths:
        with open(p, "rb") as f:
            jpeg = f.read()
        face = recognizer.best_face(jpeg)
        if not face:
            continue
        if not recognizer.is_quality(face):
            continue
        # weight by detection confidence × sharpness; clamp blur so a single
        # very-sharp shot doesn't dominate.
        score = face["det_score"] * min(face["blur"], 200.0)
        if best is None or score > best[2]:
            best = (p, face, score)
    if best is None:
        return None
    return best[0], best[1]


def force_first(recognizer: Recognizer, paths: list[Path]) -> tuple[Path, dict] | None:
    """For --allow-low-quality: take the first detected face regardless of
    quality gates."""
    for p in paths:
        with open(p, "rb") as f:
            jpeg = f.read()
        face = recognizer.best_face(jpeg)
        if face:
            return p, face
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("gallery", type=Path,
                    help="Directory containing <name>/<image>.jpg subfolders")
    ap.add_argument("--db",
                    default=os.environ.get(
                        "DB_PATH",
                        str(Path(__file__).resolve().parent.parent / "server" / "embeddings.pkl"),
                    ),
                    help="Pickle DB path (default: server/embeddings.pkl)")
    ap.add_argument("--allow-low-quality", action="store_true",
                    help="Skip quality gate; useful for off-frontal shots")
    ap.add_argument("--clear", action="store_true",
                    help="Start the target DB from scratch instead of appending")
    args = ap.parse_args()

    if not args.gallery.is_dir():
        print(f"not a directory: {args.gallery}", file=sys.stderr)
        return 1

    subjects = sorted(p for p in args.gallery.iterdir() if p.is_dir())
    if not subjects:
        print("no subject folders found", file=sys.stderr)
        return 1

    if args.clear and os.path.exists(args.db):
        os.remove(args.db)
        print(f"[bulk_enroll] cleared {args.db}")

    recognizer = Recognizer()
    db = FaceDB(args.db)
    enrolled, skipped = 0, 0
    print(f"[bulk_enroll] gallery={args.gallery}  db={args.db}  "
          f"subjects={len(subjects)}")
    for sub in subjects:
        name = sub.name
        imgs = sorted(p for p in sub.iterdir() if p.suffix.lower() in SUPPORTED_EXTS)
        if not imgs:
            print(f"  - {name:24s} SKIP (no images)")
            skipped += 1
            continue
        pick = (force_first(recognizer, imgs)
                if args.allow_low_quality
                else pick_best(recognizer, imgs))
        if not pick:
            print(f"  - {name:24s} SKIP (no quality face in {len(imgs)} images)")
            skipped += 1
            continue
        chosen_path, face = pick
        db.add(name, face["embedding"])
        enrolled += 1
        print(f"  + {name:24s} OK   <- {chosen_path.name}  "
              f"det={face['det_score']:.2f} blur={face['blur']:.1f} "
              f"yaw={face['yaw']:.1f}")

    print(f"\n[bulk_enroll] done. enrolled={enrolled} skipped={skipped} "
          f"db_size={len(db)} at {args.db}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
