"""FAR / FRR evaluation harness for the taxi face-recognition service.

Sends a directory of probe images to the running /search endpoint as
N-frame bursts (matching ESP32-CAM behaviour), records per-probe results,
then sweeps the cosine threshold offline to compute FAR, FRR, equal-error
rate (EER) and the operating point that maximises true accepts.

Dataset layout
--------------
    <dataset_root>/
        <identity_name>/
            img_1.jpg
            img_2.jpg
            ...
        <other_identity>/
            ...

Usage
-----
    python far_frr.py \
        --dataset ./test_set \
        --gallery alice,bob,carol \
        --server http://18.192.45.175:8000 \
        --frames 10 \
        --out results/run_2026_05_14.csv

Conventions
-----------
- Folder name = ground-truth identity.
- Names listed in --gallery are expected to be enrolled in the server DB.
  Probes under those folders are "genuine" attempts.
- Folders NOT listed in --gallery are "impostor" attempts; any match is a
  false accept regardless of which gallery name comes back.

Outputs
-------
- A per-probe CSV (one row per image) with similarity / matched name /
  category (genuine|impostor) / passed-quality flag.
- A summary CSV with FAR, FRR, TA, TR at every threshold step.
- An EER and operating-point report printed to stdout.
- An optional ROC plot (PNG) if matplotlib is available.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
import uuid
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

import requests


# -------------------------------------------------------------------------
# Data model
# -------------------------------------------------------------------------


@dataclass
class ProbeResult:
    """Single probe result, one row in the output CSV."""

    image_path: str
    actual_identity: str
    category: str            # "genuine" | "impostor"
    matched_name: str
    similarity: float        # 0.0 if server returned no similarity (e.g. quality fail)
    quality_passed: bool     # True if server actually scored the burst
    server_match: bool       # what the server decided at its own threshold
    frames_used: int
    frames_total: int
    liveness_score: float
    error: str = ""


# -------------------------------------------------------------------------
# Probe → server burst
# -------------------------------------------------------------------------


def send_burst(server: str, jpeg: bytes, frames: int, timeout: float = 30.0,
               shared_secret: str = "") -> dict:
    """Send the same JPEG as an N-frame burst (matches ESP32-CAM behaviour
    when filming a still subject). Returns the parsed final-frame JSON."""
    sid = str(uuid.uuid4())
    last: dict = {}
    base_headers = {"Content-Type": "application/octet-stream"}
    if shared_secret:
        base_headers["X-Shared-Secret"] = shared_secret
    for i in range(1, frames + 1):
        r = requests.post(
            f"{server.rstrip('/')}/search",
            data=jpeg,
            headers={
                **base_headers,
                "X-Session-Id": sid,
                "X-Frame-Index": str(i),
                "X-Frame-Total": str(frames),
            },
            timeout=timeout,
        )
        r.raise_for_status()
        last = r.json()
    return last


def collect_probes(dataset_root: Path) -> list[tuple[Path, str]]:
    """Walk dataset_root and return (image_path, identity) pairs."""
    out: list[tuple[Path, str]] = []
    for identity_dir in sorted(p for p in dataset_root.iterdir() if p.is_dir()):
        for img in sorted(identity_dir.iterdir()):
            if img.suffix.lower() in (".jpg", ".jpeg", ".png"):
                out.append((img, identity_dir.name))
    return out


def run_probes(
    dataset_root: Path,
    gallery: set[str],
    server: str,
    frames: int,
    sleep_s: float = 0.0,
    shared_secret: str = "",
) -> list[ProbeResult]:
    """Send every probe in the dataset to the server, return raw results."""
    probes = collect_probes(dataset_root)
    print(f"[harness] dataset={dataset_root}  probes={len(probes)}  "
          f"gallery={sorted(gallery)}", flush=True)
    results: list[ProbeResult] = []
    for n, (img_path, identity) in enumerate(probes, 1):
        category = "genuine" if identity in gallery else "impostor"
        try:
            with open(img_path, "rb") as f:
                jpeg = f.read()
            final = send_burst(server, jpeg, frames=frames,
                               shared_secret=shared_secret)
        except Exception as e:                            # noqa: BLE001
            results.append(ProbeResult(
                image_path=str(img_path),
                actual_identity=identity,
                category=category,
                matched_name="",
                similarity=0.0,
                quality_passed=False,
                server_match=False,
                frames_used=0,
                frames_total=frames,
                liveness_score=0.0,
                error=repr(e),
            ))
            print(f"[{n}/{len(probes)}] ERROR  {img_path}: {e}", flush=True)
            continue

        quality_passed = "similarity" in final
        sim = float(final.get("similarity", 0.0))
        rec = ProbeResult(
            image_path=str(img_path),
            actual_identity=identity,
            category=category,
            matched_name=str(final.get("name", "")),
            similarity=sim,
            quality_passed=quality_passed,
            server_match=bool(final.get("match", False)),
            frames_used=int(final.get("frames_used", 0)),
            frames_total=int(final.get("frames_total", frames)),
            liveness_score=float(final.get("liveness_score", 0.0)),
        )
        results.append(rec)
        print(f"[{n}/{len(probes)}] {category:8s} actual={identity:20s} "
              f"→ matched={rec.matched_name:20s} sim={sim:.4f} "
              f"q={quality_passed}", flush=True)
        if sleep_s > 0:
            time.sleep(sleep_s)
    return results


# -------------------------------------------------------------------------
# Threshold sweep / metrics
# -------------------------------------------------------------------------


@dataclass
class ThresholdPoint:
    threshold: float
    far: float
    frr: float
    true_accept: int
    false_accept: int
    true_reject: int
    false_reject: int


def sweep_thresholds(
    results: list[ProbeResult],
    steps: Iterable[float] | None = None,
) -> list[ThresholdPoint]:
    """For each candidate threshold, count TA/FA/TR/FR and compute FAR/FRR.

    Genuine probe (actual ∈ gallery):
        - accept iff matched_name == actual_identity AND similarity ≥ τ
        - TA if accepted, FR otherwise

    Impostor probe (actual ∉ gallery):
        - accept iff similarity ≥ τ  (any name → FA regardless of which name)
        - FA if accepted, TR otherwise
    """
    if steps is None:
        steps = [round(x * 0.01, 2) for x in range(0, 101)]
    genuine = [r for r in results if r.category == "genuine"]
    impostor = [r for r in results if r.category == "impostor"]
    n_gen = max(len(genuine), 1)
    n_imp = max(len(impostor), 1)

    out: list[ThresholdPoint] = []
    for tau in steps:
        ta = fr = fa = tr = 0
        for r in genuine:
            accept = (r.matched_name == r.actual_identity
                      and r.quality_passed
                      and r.similarity >= tau)
            if accept:
                ta += 1
            else:
                fr += 1
        for r in impostor:
            accept = r.quality_passed and r.similarity >= tau
            if accept:
                fa += 1
            else:
                tr += 1
        out.append(ThresholdPoint(
            threshold=tau,
            far=fa / n_imp,
            frr=fr / n_gen,
            true_accept=ta,
            false_accept=fa,
            true_reject=tr,
            false_reject=fr,
        ))
    return out


def find_eer(points: list[ThresholdPoint]) -> ThresholdPoint:
    """Threshold where FAR and FRR cross. Returns the closest point."""
    return min(points, key=lambda p: abs(p.far - p.frr))


def find_optimal(points: list[ThresholdPoint], max_far: float = 0.01) -> ThresholdPoint:
    """Highest true-accept count under a max-FAR constraint."""
    feasible = [p for p in points if p.far <= max_far]
    if not feasible:
        return points[0]
    return max(feasible, key=lambda p: p.true_accept)


# -------------------------------------------------------------------------
# Output
# -------------------------------------------------------------------------


def write_probe_csv(results: list[ProbeResult], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(asdict(results[0]).keys()) if results else []
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in results:
            w.writerow(asdict(r))


def write_sweep_csv(points: list[ThresholdPoint], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(asdict(points[0]).keys()) if points else []
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for p in points:
            w.writerow(asdict(p))


def maybe_plot_roc(points: list[ThresholdPoint], path: Path) -> bool:
    """Plot FAR-vs-FRR (ROC-like) curve. Returns True if plot was created."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:
        return False
    fars = [p.far for p in points]
    frrs = [p.frr for p in points]
    eer = find_eer(points)
    plt.figure(figsize=(6, 5), dpi=150)
    plt.plot(fars, frrs, "-", color="#11162A", linewidth=1.5)
    plt.scatter([eer.far], [eer.frr], color="#C2902F", s=60, zorder=5,
                label=f"EER ≈ {eer.far:.3f} @ τ={eer.threshold:.2f}")
    plt.xlabel("False Accept Rate (FAR)")
    plt.ylabel("False Reject Rate (FRR)")
    plt.title("Operating curve — taxi face-rec")
    plt.grid(True, alpha=0.25, linewidth=0.5)
    plt.legend()
    plt.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(path)
    plt.close()
    return True


# -------------------------------------------------------------------------
# Entry point
# -------------------------------------------------------------------------


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dataset", required=True, type=Path,
                   help="Root directory with <identity>/<image.jpg> layout")
    p.add_argument("--gallery", required=True,
                   help="Comma-separated list of identities ENROLLED in the server DB")
    p.add_argument("--server", required=True,
                   help="Server base URL, e.g. http://18.192.45.175:8000")
    p.add_argument("--frames", type=int, default=10,
                   help="Frames per burst (server MIN_QUALITY_FRAMES applies)")
    p.add_argument("--sleep", type=float, default=0.0,
                   help="Sleep seconds between probes (rate-limit guard)")
    p.add_argument("--max-far", type=float, default=0.01,
                   help="Max acceptable FAR when choosing the operating point")
    p.add_argument("--out", type=Path, default=Path("results/probes.csv"),
                   help="Output CSV for per-probe rows")
    p.add_argument("--shared-secret", default=os.environ.get("SHARED_SECRET", ""),
                   help="Auth token, sent as X-Shared-Secret (default: $SHARED_SECRET)")
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if not args.dataset.exists():
        print(f"dataset not found: {args.dataset}", file=sys.stderr)
        return 1
    gallery = {g.strip() for g in args.gallery.split(",") if g.strip()}
    if not gallery:
        print("--gallery cannot be empty", file=sys.stderr)
        return 1

    # health check
    try:
        h = requests.get(f"{args.server.rstrip('/')}/health", timeout=5).json()
        print(f"[harness] server health: {h}", flush=True)
    except Exception as e:                                 # noqa: BLE001
        print(f"server unreachable at {args.server}: {e}", file=sys.stderr)
        return 1

    results = run_probes(args.dataset, gallery, args.server, args.frames,
                         args.sleep, shared_secret=args.shared_secret)
    write_probe_csv(results, args.out)
    points = sweep_thresholds(results)
    sweep_path = args.out.with_name(args.out.stem + "_sweep.csv")
    write_sweep_csv(points, sweep_path)
    roc_path = args.out.with_name(args.out.stem + "_roc.png")
    plotted = maybe_plot_roc(points, roc_path)

    eer = find_eer(points)
    op = find_optimal(points, max_far=args.max_far)
    n_gen = sum(1 for r in results if r.category == "genuine")
    n_imp = sum(1 for r in results if r.category == "impostor")
    n_fail = sum(1 for r in results if not r.quality_passed and not r.error)
    n_err = sum(1 for r in results if r.error)

    print("\n=== summary ===")
    print(f"  probes: {len(results)} (genuine={n_gen}, impostor={n_imp})")
    print(f"  quality-failed bursts: {n_fail}")
    print(f"  transport errors: {n_err}")
    print(f"  EER ≈ {eer.far:.4f}  @ threshold {eer.threshold:.2f}  (FRR {eer.frr:.4f})")
    print(f"  best @ FAR ≤ {args.max_far:.3f}: τ={op.threshold:.2f}  "
          f"TA={op.true_accept}  FA={op.false_accept}  "
          f"FAR={op.far:.4f}  FRR={op.frr:.4f}")
    print(f"\n  per-probe csv : {args.out}")
    print(f"  sweep    csv  : {sweep_path}")
    print(f"  roc plot      : {roc_path if plotted else '(matplotlib not installed)'}")
    print(f"\n  summary.json  :")
    summary = {
        "n_probes": len(results),
        "n_genuine": n_gen,
        "n_impostor": n_imp,
        "n_quality_failed": n_fail,
        "n_transport_errors": n_err,
        "server_threshold": "see server MATCH_THRESHOLD env (default 0.40)",
        "eer_threshold": eer.threshold,
        "eer_rate": eer.far,
        "operating_point": asdict(op),
        "operating_max_far": args.max_far,
    }
    summary_path = args.out.with_name(args.out.stem + "_summary.json")
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"  {summary_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
