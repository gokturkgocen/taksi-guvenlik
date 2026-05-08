"""Yeni kisi kaydetme.

Kullanim:
    python enroll.py <isim> <foto1.jpg> [foto2.jpg ...]
    python enroll.py <isim> --webcam         # webcam'den 5 frame yakala

Birden fazla foto verildiginde embedding'lerin ortalamasi alinir.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from insightface.app import FaceAnalysis

import db


def build_app() -> FaceAnalysis:
    app = FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )
    # Enroll'da kaliteli embedding icin 640 tutuyoruz (tek seferlik).
    app.prepare(ctx_id=0, det_size=(640, 640))
    return app


def embed_image(app: FaceAnalysis, image: np.ndarray) -> np.ndarray | None:
    faces = app.get(image)
    if not faces:
        return None
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return face.normed_embedding.astype(np.float32)


def from_files(app: FaceAnalysis, paths: list[Path]) -> list[np.ndarray]:
    embs: list[np.ndarray] = []
    for p in paths:
        img = cv2.imread(str(p))
        if img is None:
            print(f"  {p} okunamadi, atlaniyor")
            continue
        emb = embed_image(app, img)
        if emb is None:
            print(f"  {p} icinde yuz bulunamadi, atlaniyor")
            continue
        embs.append(emb)
        print(f"OK  {p.name}")
    return embs


def from_webcam(app: FaceAnalysis, count: int = 5) -> list[np.ndarray]:
    cam = cv2.VideoCapture(0)
    if not cam.isOpened():
        print("Webcam acilamadi", file=sys.stderr)
        sys.exit(1)

    print(f"Webcam acildi. {count} frame yakalanacak. Kameraya bakin...")
    time.sleep(1.0)

    embs: list[np.ndarray] = []
    while len(embs) < count:
        ok, frame = cam.read()
        if not ok:
            continue
        emb = embed_image(app, frame)
        label = f"Yakalandi: {len(embs)}/{count}"
        if emb is not None:
            embs.append(emb)
            label += " [OK]"
            cv2.rectangle(frame, (0, 0), (frame.shape[1], frame.shape[0]), (0, 255, 0), 6)
        cv2.putText(frame, label, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)
        cv2.imshow("Enroll (ESC iptal)", frame)
        if cv2.waitKey(1) == 27:
            break
        time.sleep(0.3)

    cam.release()
    cv2.destroyAllWindows()
    return embs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("name", help="Kisi adi")
    ap.add_argument("images", nargs="*", type=Path, help="Fotograf dosyalari")
    ap.add_argument("--webcam", action="store_true", help="Webcam'den yakala")
    args = ap.parse_args()

    if not args.webcam and not args.images:
        ap.error("En az bir fotograf verin veya --webcam kullanin")

    app = build_app()
    embs = from_webcam(app) if args.webcam else from_files(app, args.images)

    if not embs:
        print("Embedding cikarilamadi, kayit iptal.", file=sys.stderr)
        sys.exit(1)

    mean = np.mean(np.stack(embs), axis=0)
    mean /= np.linalg.norm(mean)

    people = db.load()
    people = [p for p in people if p.name != args.name]
    people.append(db.Person(name=args.name, embedding=mean.astype(np.float32)))
    db.save(people)

    print(f"\nOK '{args.name}' kaydedildi. DB'de toplam {len(people)} kisi.")


if __name__ == "__main__":
    main()
