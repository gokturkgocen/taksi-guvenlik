"""JSONL event logger. Her karar frame'i icin bir satir.

Analiz: `python evaluation/analyze_events.py events.jsonl`

Satir semasi:
{
  "ts": 1698765432.12,
  "track_id": 3,
  "decision": "MATCH" | "UNKNOWN" | "SPOOF_CNN" | "SPOOF_MOTION"
              | "CHALLENGE_WAIT" | "PENDING",
  "name": "Gokturk" | null,
  "sim": 0.72,
  "real_score": 0.87,
  "motion": 3.2,
  "blinks": 2,
  "yaw_range": 0.18,
  "n_obs": 15
}
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any


class EventLog:
    def __init__(self, path: str | Path = "events.jsonl"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.f = open(self.path, "a", encoding="utf-8", buffering=1)  # line buffered
        self.f.write(json.dumps({"ts": time.time(), "event": "start"}) + "\n")

    def log(self, **fields: Any) -> None:
        fields["ts"] = time.time()
        self.f.write(json.dumps(fields, ensure_ascii=False, default=_json_default) + "\n")

    def close(self) -> None:
        try:
            self.f.write(json.dumps({"ts": time.time(), "event": "stop"}) + "\n")
            self.f.close()
        except Exception:
            pass


def _json_default(o: Any) -> Any:
    # numpy float/int hallet
    try:
        import numpy as np
        if isinstance(o, (np.floating,)):
            return float(o)
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
    except ImportError:
        pass
    return str(o)
