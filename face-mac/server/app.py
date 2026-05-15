"""Flask service: receive multi-frame burst from ESP32, return aggregated MATCH/NOMATCH.

Endpoint:
    POST /search
    Headers:
        X-Session-Id: uuid (same across burst)
        X-Frame-Index: 1..N
        X-Frame-Total: N (e.g. 10)
        X-Shared-Secret: <token>     (required only if SHARED_SECRET env is set)
    Body: JPEG bytes

    Returns:
        Intermediate frames: {"status":"continue", "frames_received": k, "frames_total": N}
        Final frame: {"match": bool, "name": str, "similarity": float,
                      "frames_used": int, "frames_total": int,
                      "liveness_score": float}

    GET /health   — DB size + open session count
    GET /metrics  — request counters, burst history, latency stats

Phase 1: runs on Mac (LAN). Phase 2: runs on EC2 in Docker. Same code.
"""
from __future__ import annotations

import json
import os
import sys
import time
from collections import deque
from threading import Lock

import numpy as np
from flask import Flask, jsonify, request

from auth import auth_bp
from db import FaceDB
from recognition import Recognizer

app = Flask(__name__)
app.register_blueprint(auth_bp)

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "embeddings.pkl"))
THRESHOLD = float(os.environ.get("MATCH_THRESHOLD", "0.4"))
MIN_QUALITY_FRAMES = int(os.environ.get("MIN_QUALITY_FRAMES", "5"))
SESSION_TIMEOUT_S = int(os.environ.get("SESSION_TIMEOUT_S", "30"))
SHARED_SECRET = os.environ.get("SHARED_SECRET", "").strip()

recognizer = Recognizer()
db = FaceDB(DB_PATH)

# session_id -> { "created": float, "faces": list[dict] }
_sessions: dict[str, dict] = {}
_lock = Lock()

# ---- metrics ----
_metrics_lock = Lock()
_metrics: dict[str, int | float] = {
    "started_at": time.time(),
    "search_calls": 0,
    "auth_rejects": 0,
    "bursts_completed": 0,
    "bursts_matched": 0,
    "bursts_nomatch": 0,
    "bursts_quality_failed": 0,
    "bursts_session_lost": 0,
}
# rolling window of last 100 burst latencies (seconds)
_recent_burst_latencies: deque[float] = deque(maxlen=100)


def _log_json(event: str, **fields: object) -> None:
    """Single-line JSON log. Easy to grep with `docker logs taxi-server | jq`."""
    payload = {"ts": round(time.time(), 3), "event": event, **fields}
    print(json.dumps(payload, ensure_ascii=False, default=str), flush=True, file=sys.stdout)


def _cleanup_sessions() -> None:
    now = time.time()
    with _lock:
        stale = [k for k, v in _sessions.items() if now - v["created"] > SESSION_TIMEOUT_S]
        for k in stale:
            del _sessions[k]


@app.before_request
def _auth_gate() -> object | None:
    """Reject /search calls missing X-Shared-Secret if SHARED_SECRET is set.

    /health and /metrics stay open so monitoring tools and operators can
    observe the service without holding the token.
    """
    if not SHARED_SECRET:
        return None
    if request.path != "/search":
        return None
    token = request.headers.get("X-Shared-Secret", "").strip()
    if token != SHARED_SECRET:
        with _metrics_lock:
            _metrics["auth_rejects"] += 1
        _log_json("auth_reject", path=request.path,
                  remote=request.headers.get("X-Forwarded-For", request.remote_addr))
        return jsonify({"error": "unauthorized"}), 401
    return None


@app.route("/health")
def health():
    return jsonify({"ok": True, "db_size": len(db), "open_sessions": len(_sessions)})


@app.route("/metrics")
def metrics():
    with _metrics_lock:
        snap = dict(_metrics)
        snap["uptime_s"] = round(time.time() - snap["started_at"], 1)
        lat = list(_recent_burst_latencies)
    if lat:
        lat_sorted = sorted(lat)
        snap["burst_latency_s_avg"] = round(sum(lat) / len(lat), 3)
        snap["burst_latency_s_p50"] = round(lat_sorted[len(lat) // 2], 3)
        snap["burst_latency_s_p95"] = round(lat_sorted[int(len(lat) * 0.95)], 3)
        snap["burst_latency_s_max"] = round(max(lat), 3)
    snap["db_size"] = len(db)
    snap["open_sessions"] = len(_sessions)
    snap["auth_enabled"] = bool(SHARED_SECRET)
    return jsonify(snap)


@app.route("/search", methods=["POST"])
def search():
    _cleanup_sessions()
    with _metrics_lock:
        _metrics["search_calls"] += 1

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
        with _metrics_lock:
            _metrics["bursts_session_lost"] += 1
        _log_json("burst_session_lost", session_id=sid)
        return jsonify({"error": "session_lost"}), 500

    burst_started = float(session["created"])
    faces = session["faces"]
    if len(faces) < MIN_QUALITY_FRAMES:
        with _metrics_lock:
            _metrics["bursts_completed"] += 1
            _metrics["bursts_quality_failed"] += 1
            _recent_burst_latencies.append(time.time() - burst_started)
        _log_json("burst_quality_failed",
                  session_id=sid, frames_used=len(faces), frames_total=total)
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

    with _metrics_lock:
        _metrics["bursts_completed"] += 1
        if matched:
            _metrics["bursts_matched"] += 1
        else:
            _metrics["bursts_nomatch"] += 1
        _recent_burst_latencies.append(time.time() - burst_started)
    _log_json(
        "burst_complete",
        session_id=sid,
        match=bool(matched),
        name=name if matched else "",
        similarity=round(sim, 4),
        liveness=round(emb_std, 6),
        frames_used=len(faces),
        frames_total=total,
        latency_s=round(time.time() - burst_started, 3),
    )

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
    _log_json("server_start", port=port, db_size=len(db),
              auth_enabled=bool(SHARED_SECRET),
              threshold=THRESHOLD, min_quality_frames=MIN_QUALITY_FRAMES)
    app.run(host="0.0.0.0", port=port, threaded=True)
