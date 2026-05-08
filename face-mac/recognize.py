"""Canli yuz tanima + anti-spoofing + temporal smoothing + aktif liveness.

Pipeline: detect -> track(IoU) -> anti-spoof -> blink/yaw -> match -> emit
Karar her track icin son N olcumun MEDIAN'i + aktif challenge (blink veya
kafa cevirme) uzerinden verilir. Tek frame gurultusu elenir, duvardaki
fotograf gibi saldirilar garantili reddedilir.

MATCH olursa MatchEmitter USB-serial uzerinden STM32'ye `MATCH:<name>;<sim>\\n`
gonderir. STM32 HM-10 BLE uzerinden Android'e aktarir, Android arama baslatir.

Kullanim:
    python recognize.py                                  # config.yaml default
    python recognize.py --serial /dev/tty.usbmodem1234   # STM32 bagli
    python recognize.py --camera 1                       # USB webcam
    python recognize.py --no-antispoof --no-challenge    # sadece tanima debug
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import cv2
import numpy as np
import yaml
from insightface.app import FaceAnalysis

import db
from antispoof import AntiSpoof
from emitter import MatchEmitter
from event_log import EventLog
from liveness_challenge import ActiveLiveness
from tracker import Tracker


# ─── Sabitler ─────────────────────────────────────────────────────────────
COLOR_MATCH = (0, 0, 255)       # kirmizi (dikkat!)
COLOR_UNKNOWN = (0, 200, 0)     # yesil (gecis OK ama DB'de yok)
COLOR_SPOOF = (0, 165, 255)     # turuncu (SPOOF)
COLOR_PENDING = (200, 200, 200) # gri (bekle / challenge yok)


# ─── Yardimcilar ──────────────────────────────────────────────────────────
def build_app(det_size: int = 640) -> FaceAnalysis:
    app = FaceAnalysis(
        name="buffalo_l",
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )
    app.prepare(ctx_id=0, det_size=(det_size, det_size))
    return app


def draw_face(frame, bbox, label, color):
    x1, y1, x2, y2 = [int(v) for v in bbox]
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    cv2.rectangle(frame, (x1, y1 - th - 10), (x1 + tw + 10, y1), color, -1)
    cv2.putText(frame, label, (x1 + 5, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)


def load_config(path: str | Path) -> dict:
    p = Path(path)
    if not p.exists():
        print(f"[config] {p} bulunamadi, tamamen CLI/default kullaniliyor.")
        return {}
    with open(p) as f:
        return yaml.safe_load(f) or {}


def cget(cfg: dict, dotted: str, default=None):
    """Config'ten 'recognition.threshold' gibi nokta notasyonuyla oku."""
    cur = cfg
    for part in dotted.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return default
        cur = cur[part]
    return cur


# ─── Main ─────────────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", type=str, default="config.yaml")
    # CLI override'lar — yaml varsayilanini ezer
    ap.add_argument("--threshold", type=float)
    ap.add_argument("--spoof-threshold", type=float)
    ap.add_argument("--motion-threshold", type=float)
    ap.add_argument("--yaw-range-threshold", type=float)
    ap.add_argument("--min-obs", type=int)
    ap.add_argument("--det-size", type=int)
    ap.add_argument("--every", type=int)
    ap.add_argument("--camera")
    ap.add_argument("--serial", type=str, help="STM32 serial port (/dev/tty.usbmodem...)")
    ap.add_argument("--baud", type=int, default=9600)
    ap.add_argument("--cooldown", type=float, help="Ayni kisiye emit cooldown (sn)")
    ap.add_argument("--no-antispoof", action="store_true")
    ap.add_argument("--no-challenge", action="store_true")
    ap.add_argument("--log", type=str, help="JSONL event log yolu")
    args = ap.parse_args()

    cfg = load_config(args.config)

    # CLI > config > default
    threshold = args.threshold if args.threshold is not None else cget(cfg, "recognition.threshold", 0.5)
    det_size = args.det_size if args.det_size is not None else cget(cfg, "recognition.det_size", 640)
    every = args.every if args.every is not None else cget(cfg, "recognition.every", 3)
    spoof_thr = args.spoof_threshold if args.spoof_threshold is not None else cget(cfg, "antispoof.spoof_threshold", 0.6)
    motion_thr = args.motion_threshold if args.motion_threshold is not None else cget(cfg, "antispoof.motion_threshold", 1.5)
    antispoof_on = cget(cfg, "antispoof.enabled", True) and not args.no_antispoof
    yaw_thr = args.yaw_range_threshold if args.yaw_range_threshold is not None else cget(cfg, "challenge.yaw_range_threshold", 0.12)
    challenge_on = cget(cfg, "challenge.enabled", True) and not args.no_challenge
    min_obs = args.min_obs if args.min_obs is not None else cget(cfg, "tracker.min_obs", 1)
    iou_thr = cget(cfg, "tracker.iou_thr", 0.3)
    max_missed = cget(cfg, "tracker.max_missed", 10)
    serial_port = args.serial or cget(cfg, "emitter.serial_port", None)
    baud = args.baud or cget(cfg, "emitter.baud", 9600)
    cooldown = args.cooldown if args.cooldown is not None else cget(cfg, "emitter.cooldown_s", 10.0)
    log_path = args.log or cget(cfg, "log.path", "events.jsonl")
    camera = args.camera if args.camera is not None else cget(cfg, "camera", 0)
    # camera stringse URL (IP webcam) olabilir; int ise webcam indeksi
    try:
        camera = int(camera)
    except (TypeError, ValueError):
        pass  # string URL kalsin

    # ─── DB ──────────────────────────────────────────────────────────────
    people = db.load()
    if not people:
        print("DB bos. Once `python enroll.py <isim> --webcam` ile kayit yap.")
        return
    print(f"DB yuklendi: {len(people)} kisi -> {[p.name for p in people]}")

    # ─── Modeller ────────────────────────────────────────────────────────
    print("Face model (buffalo_l) yukleniyor...")
    app = build_app(det_size=det_size)

    antispoof: AntiSpoof | None = None
    if antispoof_on:
        print("Anti-spoofing (MiniFASNet ensemble) yukleniyor...")
        antispoof = AntiSpoof()

    active: ActiveLiveness | None = None
    if challenge_on:
        print("Aktif liveness (mediapipe FaceMesh) yukleniyor...")
        active = ActiveLiveness()

    tracker = Tracker(iou_thr=iou_thr, max_missed=max_missed)
    emitter = MatchEmitter(port=serial_port, baud=baud, cooldown_s=cooldown)
    event_log = EventLog(log_path)
    print(f"Event log: {log_path}")

    # ─── Kamera ──────────────────────────────────────────────────────────
    cam = cv2.VideoCapture(camera)
    if not cam.isOpened():
        print(f"Kamera acilamadi: {camera}")
        emitter.close()
        event_log.close()
        return

    last_t = time.time()
    fps = 0.0
    frame_idx = 0
    draw_queue: list[tuple] = []

    try:
        while True:
            ok, frame = cam.read()
            if not ok:
                break

            if frame_idx % every == 0:
                t0 = time.perf_counter()
                faces = app.get(frame)
                bboxes = [f.bbox for f in faces]
                tracks = tracker.update(bboxes)

                mesh_results = active.analyze_frame(frame) if active is not None else []

                draw_queue = []
                for face, track in zip(faces, tracks):
                    track.push_crop(frame)

                    if antispoof is not None:
                        _, real_score = antispoof.predict(frame, face.bbox)
                        track.real_scores.append(real_score)

                    if active is not None and mesh_results:
                        fx = float((face.bbox[0] + face.bbox[2]) / 2)
                        fy = float((face.bbox[1] + face.bbox[3]) / 2)
                        mesh = ActiveLiveness.match((fx, fy), mesh_results)
                        if mesh is not None:
                            track.push_ear(mesh["ear"])
                            track.push_yaw(mesh["yaw"])

                    emb = face.normed_embedding.astype(np.float32)
                    rec = db.match(emb, people, threshold)
                    track.match_history.append(
                        (rec[0].name, rec[1]) if rec is not None else None
                    )

                    n_obs = len(track.match_history)
                    med_motion = track.smoothed_motion()
                    med_real = track.smoothed_real_score() if antispoof else 1.0
                    blinks = track.blink_count
                    yaw_rng = track.yaw_range()
                    challenge_passed = (blinks >= 1) or (yaw_rng >= yaw_thr)

                    decision = "PENDING"
                    name_out = None
                    sim_out = 0.0

                    if n_obs < min_obs or len(track.motion_history) < min_obs - 1:
                        label = f"... ({n_obs}/{min_obs})"
                        color = COLOR_PENDING
                    else:
                        spoof_by_cnn = antispoof is not None and med_real < spoof_thr
                        spoof_by_motion = motion_thr > 0 and med_motion < motion_thr
                        if spoof_by_cnn or spoof_by_motion:
                            reason = []
                            if spoof_by_cnn:
                                reason.append(f"cnn={med_real:.2f}")
                                decision = "SPOOF_CNN"
                            if spoof_by_motion:
                                reason.append(f"mot={med_motion:.2f}")
                                decision = "SPOOF_MOTION" if decision == "PENDING" else decision
                            label = f"SPOOF [{' '.join(reason)}]"
                            color = COLOR_SPOOF
                        elif active is not None and not challenge_passed:
                            decision = "CHALLENGE_WAIT"
                            label = f"KIRP/CEVIR  blk={blinks} yaw={yaw_rng:.2f}"
                            color = COLOR_PENDING
                        else:
                            dom = track.dominant_match()
                            live_tag = (f"[live {med_real:.2f} mot {med_motion:.2f} "
                                        f"blk {blinks} yaw {yaw_rng:.2f}]")
                            if dom is None:
                                decision = "UNKNOWN"
                                label = f"Unknown {live_tag}"
                                color = COLOR_UNKNOWN
                            else:
                                name_out, sim_out = dom
                                decision = "MATCH"
                                label = f"MATCH: {name_out} ({sim_out:.2f}) {live_tag}"
                                color = COLOR_MATCH

                    # ─── Event log ─────────────────────────────────────
                    event_log.log(
                        track_id=track.id,
                        decision=decision,
                        name=name_out,
                        sim=round(sim_out, 4),
                        real_score=round(med_real, 4),
                        motion=round(med_motion, 4),
                        blinks=blinks,
                        yaw_range=round(yaw_rng, 4),
                        n_obs=n_obs,
                        proc_ms=round((time.perf_counter() - t0) * 1000, 2),
                    )

                    # ─── Emit ──────────────────────────────────────────
                    if decision == "MATCH" and name_out:
                        emitter.emit(
                            name_out, sim_out,
                            meta={
                                "track": track.id,
                                "real": round(med_real, 2),
                                "blinks": blinks,
                                "yaw": round(yaw_rng, 2),
                            },
                        )

                    draw_queue.append((face.bbox, label, color))

            frame_idx += 1

            for bbox, label, color in draw_queue:
                draw_face(frame, bbox, label, color)

            now = time.time()
            dt = now - last_t
            last_t = now
            fps = 0.9 * fps + 0.1 * (1.0 / dt if dt > 0 else 0.0)

            parts = ["track"]
            if antispoof: parts.append("AS")
            if active: parts.append("chal")
            if emitter.serial is not None: parts.append("serial")
            mode = "+".join(parts)

            cv2.putText(
                frame,
                f"{fps:4.1f} FPS  thr={threshold:.2f}  spoof={spoof_thr:.2f}  "
                f"{mode}  n={len(draw_queue)}",
                (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2,
            )

            cv2.imshow("Taksi Guvenlik", frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break
    finally:
        cam.release()
        cv2.destroyAllWindows()
        emitter.close()
        event_log.close()


if __name__ == "__main__":
    main()
