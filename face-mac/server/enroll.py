"""Enroll a face into the local pickle DB.

Usage:
    python enroll.py /path/to/photo.jpg "Ali_Yilmaz_001"
    python enroll.py --db /tmp/test.pkl photo.jpg "Test"
"""
from __future__ import annotations

import argparse
import os
import sys

from db import FaceDB
from recognition import Recognizer


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("image_path")
    p.add_argument("name")
    p.add_argument(
        "--db",
        default=os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "embeddings.pkl")),
    )
    p.add_argument("--allow-low-quality", action="store_true",
                   help="Skip quality gate (use for off-frontal enrollment shots)")
    args = p.parse_args()

    if not os.path.isfile(args.image_path):
        print(f"not a file: {args.image_path}", file=sys.stderr)
        return 1

    with open(args.image_path, "rb") as f:
        jpeg = f.read()

    recognizer = Recognizer()
    face = recognizer.best_face(jpeg)
    if not face:
        print("no face detected", file=sys.stderr)
        return 1
    if not args.allow_low_quality and not recognizer.is_quality(face):
        print(
            f"face quality too low: det={face['det_score']:.2f} "
            f"yaw={face['yaw']:.1f} blur={face['blur']:.1f}",
            file=sys.stderr,
        )
        print("rerun with --allow-low-quality to force", file=sys.stderr)
        return 1

    db = FaceDB(args.db)
    db.add(args.name, face["embedding"])
    print(f"enrolled: {args.name} (db={args.db}, size={len(db)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
