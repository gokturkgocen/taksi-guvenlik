"""Flask service: receive multi-frame burst from ESP32, return aggregated MATCH/NOMATCH.

Endpoint:
    POST /search
    Headers:
        X-Session-Id: uuid (same across burst)
        X-Frame-Index: 1..N
        X-Frame-Total: N (e.g. 10)
    Body: JPEG bytes

    Returns:
        Intermediate frames: {"status":"continue", "frames_received": k, "frames_total": N}
        Final frame: {"match": bool, "name": str, "similarity": float,
                      "frames_used": int, "frames_total": int,
                      "liveness_score": float}

Phase 1: runs on Mac (LAN). Phase 2: runs on EC2 in Docker. Same code.
"""
from __future__ import annotations

import os
import time
from threading import Lock

import numpy as np
from flask import Flask, jsonify, request

from db import FaceDB
from recognition import Recognizer

app = Flask(__name__)

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "embeddings.pkl"))
THRESHOLD = float(os.environ.get("MATCH_THRESHOLD", "0.4"))
MIN_QUALITY_FRAMES = int(os.environ.get("MIN_QUALITY_FRAMES", "5"))
SESSION_TIMEOUT_S = int(os.environ.get("SESSION_TIMEOUT_S", "30"))

recognizer = Recognizer()
db = FaceDB(DB_PATH)

# session_id -> { "created": float, "faces": list[dict] }
_sessions: dict[str, dict] = {}
_lock = Lock()


def _cleanup_sessions() -> None:
    now = time.time()
    with _lock:
        stale = [k for k, v in _sessions.items() if now - v["created"] > SESSION_TIMEOUT_S]
        for k in stale:
            del _sessions[k]


@app.route("/health")
def health():
    return jsonify({"ok": True, "db_size": len(db), "open_sessions": len(_sessions)})


@app.route("/search", methods=["POST"])
def search():
    _cleanup_sessions()

    sid = request.headers.get("X-Session-Id", "").strip()
    try:
        idx = int(request.headers.get("X-Frame-Index", "1"))
        total = int(request.headers.get("X-Frame-Total", "1"))
    except ValueError:
        return jsonify({"error": "bad_index_headers"}), 400

    if not sid:
        return jsonify({"error": "missing_session_id"}), 400
    if total < 1 or idx < 1 or idx > total:
        return jsonify({"error": "bad_frame_indices"}), 400

    jpeg = request.get_data()
    if len(jpeg) < 1024:
        return jsonify({"error": "image_too_small", "size": len(jpeg)}), 400

    face = recognizer.best_face(jpeg)
    quality_ok = bool(face and recognizer.is_quality(face))

    # Diagnostic logging — show why each frame did or didn't pass quality.
    if face is None:
        print(f"[search] sid={sid[:8]} frame={idx}/{total} NO_FACE size={len(jpeg)}",
              flush=True)
    else:
        x1, y1, x2, y2 = face["bbox"]
        area = (x2 - x1) * (y2 - y1)
        print(
            f"[search] sid={sid[:8]} frame={idx}/{total} "
            f"det={face['det_score']:.2f} area={area} "
            f"yaw={face['yaw']:.1f} blur={face['blur']:.1f} ok={quality_ok}",
            flush=True,
        )

    with _lock:
        session = _sessions.setdefault(sid, {"created": time.time(), "faces": []})
        if quality_ok:
            session["faces"].append(face)

    if idx < total:
        return jsonify({
            "status": "continue",
            "frames_received": idx,
            "frames_total": total,
            "quality_ok_this_frame": quality_ok,
        })

    # final frame: aggregate and decide
    with _lock:
        session = _sessions.pop(sid, None)
    if not session:
        return jsonify({"error": "session_lost"}), 500

    faces = session["faces"]
    if len(faces) < MIN_QUALITY_FRAMES:
        return jsonify({
            "match": False,
            "reason": "insufficient_quality_frames",
            "frames_used": len(faces),
            "frames_total": total,
        })

    embeddings = np.stack([f["embedding"] for f in faces], axis=0)
    centroid = embeddings.mean(axis=0)

    # Passive liveness proxy: cross-frame embedding variance.
    # Too low → photo replay; healthy live face has small but non-zero variance.
    emb_std = float(np.std(embeddings, axis=0).mean())

    matched, name, sim = db.match(centroid, threshold=THRESHOLD)

    return jsonify({
        "match": bool(matched),
        "name": name if matched else "",
        "similarity": round(sim, 4),
        "frames_used": len(faces),
        "frames_total": total,
        "liveness_score": round(emb_std, 6),
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, threaded=True)
