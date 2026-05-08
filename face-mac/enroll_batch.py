"""Toplu enrollment: klasor yapisi -> DB.

Beklenen klasor yapisi:
    known_faces/
        Gokturk/
            foto1.jpg
            foto2.jpg
        Ekin/
            foto1.jpg
            foto2.png
        ...

Her alt klasor bir kisi. Icindeki tum fotolar embedding'e cevrilir,
ortalama alinir, normalize edilir. Ayni isim varsa DB'de guncellenir.

Kullanim:
    python enroll_batch.py known_faces/
    python enroll_batch.py known_faces/ --force   # mevcutlari da yeniden hesapla
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np
from insightface.app import FaceAnalysis

import db


IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def build_app() -> FaceAnalysis:
    app = FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )
    app.prepare(ctx_id=0, det_size=(640, 640))
    return app


def embed_image(app: FaceAnalysis, img: np.ndarray) -> np.ndarray | None:
    faces = app.get(img)
    if not faces:
        return None
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return face.normed_embedding.astype(np.float32)


def process_person(app: FaceAnalysis, folder: Path) -> np.ndarray | None:
    embs: list[np.ndarray] = []
    for p in sorted(folder.iterdir()):
        if p.suffix.lower() not in IMG_EXTS:
            continue
        img = cv2.imread(str(p))
        if img is None:
            print(f"  !! okunamadi: {p.name}")
            continue
        emb = embed_image(app, img)
        if emb is None:
            print(f"  !! yuz yok: {p.name}")
            continue
        embs.append(emb)
        print(f"  OK {p.name}")

    if not embs:
        return None
    mean = np.mean(np.stack(embs), axis=0)
    mean /= np.linalg.norm(mean)
    return mean.astype(np.float32)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", type=Path, help="Ana klasor (icinde kisi adli alt klasorler)")
    ap.add_argument("--force", action="store_true", help="DB'de olsa bile yeniden hesapla")
    args = ap.parse_args()

    if not args.folder.is_dir():
        print(f"Klasor bulunamadi: {args.folder}", file=sys.stderr)
        sys.exit(1)

    people = db.load()
    existing = {p.name for p in people}
    print(f"Mevcut DB: {len(people)} kisi")

    print("Model yukleniyor...")
    app = build_app()

    updated = 0
    skipped = 0
    subdirs = [d for d in sorted(args.folder.iterdir()) if d.is_dir()]
    if not subdirs:
        print(f"Alt klasor yok: {args.folder}")
        sys.exit(1)

    for sub in subdirs:
        name = sub.name
        if name in existing and not args.force:
            print(f"[{name}] zaten DB'de, atlandi (--force ile zorla)")
            skipped += 1
            continue

        print(f"\n[{name}] isleniyor:")
        emb = process_person(app, sub)
        if emb is None:
            print(f"  HATA: hicbir foto embedding'e cevrilemedi, atlaniyor")
            continue

        people = [p for p in people if p.name != name]
        people.append(db.Person(name=name, embedding=emb))
        updated += 1

    db.save(people)
    print(f"\nBitti. Guncellenen: {updated}  Atlanan: {skipped}  Toplam DB: {len(people)}")


if __name__ == "__main__":
    main()
