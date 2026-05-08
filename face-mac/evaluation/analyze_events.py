"""events.jsonl okur, karar dagilimi + timeline + latency histogrami uretir.

matplotlib yoksa sadece konsol ozeti verir.

Kullanim:
    python evaluation/analyze_events.py events.jsonl
    python evaluation/analyze_events.py events.jsonl --out plots/
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path


def load(path: Path) -> list[dict]:
    events = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return events


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("log", type=Path)
    ap.add_argument("--out", type=Path, default=None, help="Grafik klasoru (opsiyonel)")
    args = ap.parse_args()

    events = load(args.log)
    decisions = [e for e in events if "decision" in e]
    print(f"Toplam event: {len(events)}  karar: {len(decisions)}")

    if not decisions:
        return

    # Karar dagilimi
    counter = Counter(e["decision"] for e in decisions)
    print("\nKarar dagilimi:")
    for dec, cnt in counter.most_common():
        print(f"  {dec:>20} {cnt:>6}  ({cnt/len(decisions)*100:5.1f}%)")

    # MATCH'ler
    matches = [e for e in decisions if e["decision"] == "MATCH"]
    if matches:
        name_counter = Counter(e.get("name") for e in matches)
        print(f"\nMATCH'ler ({len(matches)} frame):")
        for name, cnt in name_counter.most_common():
            sims = [e["sim"] for e in matches if e.get("name") == name]
            print(f"  {name:>15}  {cnt:>4} frame  sim_ort={sum(sims)/len(sims):.2f}")

    # Latency (proc_ms)
    procs = [e.get("proc_ms") for e in decisions if e.get("proc_ms")]
    if procs:
        procs.sort()
        n = len(procs)
        p50 = procs[n // 2]
        p95 = procs[int(n * 0.95)]
        p99 = procs[int(n * 0.99)]
        print(f"\nproc_ms: n={n}  p50={p50:.1f}  p95={p95:.1f}  p99={p99:.1f}  "
              f"max={procs[-1]:.1f}")

    # Grafik
    if args.out:
        try:
            import matplotlib.pyplot as plt
        except ImportError:
            print("matplotlib yok, grafik uretilmiyor (pip install matplotlib)")
            return

        args.out.mkdir(parents=True, exist_ok=True)

        # 1) Karar dagilimi pie
        fig, ax = plt.subplots(figsize=(7, 7))
        ax.pie(counter.values(), labels=counter.keys(), autopct="%.1f%%")
        ax.set_title("Karar dagilimi")
        fig.savefig(args.out / "decisions_pie.pdf")
        plt.close(fig)

        # 2) Latency histogram
        if procs:
            fig, ax = plt.subplots(figsize=(9, 5))
            ax.hist(procs, bins=50, edgecolor="black")
            ax.axvline(200, color="r", ls="--", label="200 ms hedef")
            ax.set_xlabel("proc_ms")
            ax.set_ylabel("adet")
            ax.set_title(f"Pipeline gecikmesi (n={len(procs)})")
            ax.legend()
            fig.savefig(args.out / "latency_hist.pdf")
            plt.close(fig)

        # 3) Timeline — real_score, motion, blink sayisi
        ts = [e["ts"] for e in decisions]
        t0 = ts[0]
        t_rel = [t - t0 for t in ts]
        reals = [e.get("real_score", 0) for e in decisions]
        motions = [e.get("motion", 0) for e in decisions]
        blinks = [e.get("blinks", 0) for e in decisions]

        fig, axes = plt.subplots(3, 1, figsize=(10, 8), sharex=True)
        axes[0].plot(t_rel, reals, ".", markersize=2)
        axes[0].axhline(0.6, color="r", ls="--", label="spoof_thr")
        axes[0].set_ylabel("real_score")
        axes[0].legend()
        axes[1].plot(t_rel, motions, ".", markersize=2, color="green")
        axes[1].axhline(1.5, color="r", ls="--", label="motion_thr")
        axes[1].set_ylabel("motion")
        axes[1].legend()
        axes[2].plot(t_rel, blinks, ".", markersize=2, color="purple")
        axes[2].set_ylabel("blink count")
        axes[2].set_xlabel("zaman (sn)")
        fig.suptitle("Event timeline")
        fig.savefig(args.out / "timeline.pdf")
        plt.close(fig)

        print(f"\nGrafikler: {args.out}/")


if __name__ == "__main__":
    main()
