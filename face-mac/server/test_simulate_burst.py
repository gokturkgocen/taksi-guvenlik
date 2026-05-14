"""Simulate an ESP32 burst: send N frames of one JPEG to /search and print result.

Usage:
    python test_simulate_burst.py photo.jpg http://localhost:8000/search
    python test_simulate_burst.py photo.jpg http://192.168.1.50:8000/search --frames 10
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import uuid

import requests


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("image_path")
    p.add_argument("url", help="e.g. http://localhost:8000/search")
    p.add_argument("--frames", type=int, default=10)
    p.add_argument("--shared-secret", default=os.environ.get("SHARED_SECRET", ""),
                   help="Sent as X-Shared-Secret header (default: $SHARED_SECRET)")
    args = p.parse_args()

    with open(args.image_path, "rb") as f:
        jpeg = f.read()

    sid = str(uuid.uuid4())
    print(f"[test] session_id={sid} url={args.url} frames={args.frames}")

    base_headers = {"Content-Type": "application/octet-stream"}
    if args.shared_secret:
        base_headers["X-Shared-Secret"] = args.shared_secret

    t0 = time.time()
    last = None
    for i in range(1, args.frames + 1):
        r = requests.post(
            args.url,
            data=jpeg,
            headers={
                **base_headers,
                "X-Session-Id": sid,
                "X-Frame-Index": str(i),
                "X-Frame-Total": str(args.frames),
            },
            timeout=30,
        )
        last = r.json()
        print(f"[test] frame {i}/{args.frames}: {last}")
    dt = time.time() - t0
    print(f"[test] total {dt:.2f}s; final: {last}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
