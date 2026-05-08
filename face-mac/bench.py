"""Benchmark: detection + embedding + DB match sureleri."""
from __future__ import annotations

import time

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
    app.prepare(ctx_id=0, det_size=(640, 640))
    return app


def fake_db(n: int) -> list[db.Person]:
    out = []
    for i in range(n):
        v = np.random.randn(512).astype(np.float32)
        v /= np.linalg.norm(v)
        out.append(db.Person(name=f"fake_{i}", embedding=v))
    return out


def time_it(fn, repeat: int = 20) -> float:
    fn()  # warmup
    t0 = time.perf_counter()
    for _ in range(repeat):
        fn()
    return (time.perf_counter() - t0) * 1000 / repeat


def main() -> None:
    print("Model yukleniyor...")
    app = build_app()

    cam = cv2.VideoCapture(0)
    time.sleep(0.5)
    ok, frame = cam.read()
    cam.release()
    if not ok:
        print("Webcam okunamadi, dummy frame kullaniliyor")
        frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)

    print(f"Frame boyutu: {frame.shape}\n")

    t_detect = time_it(lambda: app.get(frame), repeat=10)
    print(f"Detection + embedding (tum pipeline): {t_detect:7.1f} ms  ({1000/t_detect:5.1f} FPS)")

    faces = app.get(frame)
    if not faces:
        print("\nUyari: bu frame'de yuz yok, DB match dummy embedding ile olculuyor")
        query = np.random.randn(512).astype(np.float32)
        query /= np.linalg.norm(query)
    else:
        query = faces[0].normed_embedding.astype(np.float32)

    print("\nDB eslesme suresi (cosine similarity):")
    for n in [1, 10, 50, 100, 1_000, 10_000, 100_000]:
        people = fake_db(n)
        t = time_it(lambda: db.match(query, people, threshold=0.5), repeat=50)
        print(f"  N={n:>7,} kisi:  {t:8.3f} ms")


if __name__ == "__main__":
    main()
