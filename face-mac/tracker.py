"""Basit IoU tabanli yuz takibi + skor yumusatma.

Amac: anti-spoof ve recognition skorlarini tek frame'e dayandirmayip
son N olcum uzerinden (median) karar vermek. Fotograf gibi sinir kosullarda
flip-flop'u onler.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

import cv2
import numpy as np


def iou(a: np.ndarray, b: np.ndarray) -> float:
    """Iki bbox (xyxy) arasi Intersection-over-Union."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0.0, (ax2 - ax1) * (ay2 - ay1))
    area_b = max(0.0, (bx2 - bx1) * (by2 - by1))
    union = area_a + area_b - inter
    return float(inter / union) if union > 0 else 0.0


_FACE_SIZE = 64  # motion crop boyutu


@dataclass
class Track:
    id: int
    bbox: np.ndarray
    real_scores: deque = field(default_factory=lambda: deque(maxlen=7))
    match_history: deque = field(default_factory=lambda: deque(maxlen=7))  # (name, sim) veya None
    face_crops: deque = field(default_factory=lambda: deque(maxlen=5))  # grayscale 64x64
    motion_history: deque = field(default_factory=lambda: deque(maxlen=5))  # frame-to-frame diff mean
    # Aktif liveness sinyalleri
    ear_history: deque = field(default_factory=lambda: deque(maxlen=90))  # ~9sn @ 10fps
    yaw_history: deque = field(default_factory=lambda: deque(maxlen=90))
    blink_count: int = 0
    eye_state: str = "open"  # "open" | "closed"
    missed: int = 0

    def smoothed_real_score(self) -> float:
        return float(np.median(self.real_scores)) if self.real_scores else 0.0

    def push_crop(self, frame_bgr: np.ndarray) -> None:
        """Bbox'tan grayscale yuz cropu al, kaydet, frame-to-frame hareket hesapla."""
        x1, y1, x2, y2 = [int(v) for v in self.bbox]
        h, w = frame_bgr.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        if x2 <= x1 or y2 <= y1:
            return
        crop = frame_bgr[y1:y2, x1:x2]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(gray, (_FACE_SIZE, _FACE_SIZE), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (3, 3), 0)  # sensor gurultusunu azalt

        if self.face_crops:
            prev = self.face_crops[-1]
            diff = cv2.absdiff(small, prev)
            # Sensor gurultu tabani ~0.5; parlaklik degisimi icin normalize
            mean_diff = float(diff.mean())
            self.motion_history.append(mean_diff)
        self.face_crops.append(small)

    def smoothed_motion(self) -> float:
        return float(np.median(self.motion_history)) if self.motion_history else 0.0

    def push_ear(self, ear: float, closed_thr: float = 0.18, open_thr: float = 0.24) -> None:
        """EAR hysteresis ile blink sayar. closed_thr < open_thr olmali."""
        self.ear_history.append(ear)
        if self.eye_state == "open" and ear < closed_thr:
            self.eye_state = "closed"
        elif self.eye_state == "closed" and ear > open_thr:
            self.eye_state = "open"
            self.blink_count += 1

    def push_yaw(self, yaw: float) -> None:
        self.yaw_history.append(yaw)

    def yaw_range(self) -> float:
        """90. - 10. persentil. Outlier'lara dayanikli hareket araligi."""
        if len(self.yaw_history) < 5:
            return 0.0
        arr = np.asarray(self.yaw_history, dtype=np.float32)
        return float(np.percentile(arr, 90) - np.percentile(arr, 10))

    def dominant_match(self) -> tuple[str, float] | None:
        """Son N frame'de en cok hangi kisi eslesti, ortalama sim kac."""
        valid = [m for m in self.match_history if m is not None]
        if len(valid) < max(2, len(self.match_history) // 2):
            return None  # cogunluk match degil
        # En sik gecen ismi bul
        from collections import Counter
        names = Counter(n for n, _ in valid)
        top_name, _ = names.most_common(1)[0]
        sims = [s for n, s in valid if n == top_name]
        return top_name, float(np.mean(sims))


class Tracker:
    """IoU esleme + kisa omurlu track listesi."""

    def __init__(self, iou_thr: float = 0.3, max_missed: int = 5):
        self.iou_thr = iou_thr
        self.max_missed = max_missed
        self.tracks: list[Track] = []
        self._next_id = 0

    def update(self, detections: list[np.ndarray]) -> list[Track]:
        """detections: bbox (xyxy) listesi. Eslestirilmis Track listesi dondurur
        (ayni sirada detections ile)."""
        # Her detection icin en iyi track'i bul
        assigned_tracks: list[Track | None] = [None] * len(detections)
        used_track_ids: set[int] = set()

        for i, det in enumerate(detections):
            best_iou = 0.0
            best_track: Track | None = None
            for t in self.tracks:
                if t.id in used_track_ids:
                    continue
                v = iou(det, t.bbox)
                if v > best_iou:
                    best_iou = v
                    best_track = t
            if best_track is not None and best_iou >= self.iou_thr:
                assigned_tracks[i] = best_track
                used_track_ids.add(best_track.id)

        # Eslesmeyen detection'lar icin yeni track
        for i, det in enumerate(detections):
            if assigned_tracks[i] is None:
                t = Track(id=self._next_id, bbox=det)
                self._next_id += 1
                self.tracks.append(t)
                assigned_tracks[i] = t
            else:
                assigned_tracks[i].bbox = det
                assigned_tracks[i].missed = 0

        # Eslesmeyen track'lara missed++
        assigned_set = {t.id for t in assigned_tracks if t is not None}
        for t in self.tracks:
            if t.id not in assigned_set:
                t.missed += 1

        # Eski track'lari sil
        self.tracks = [t for t in self.tracks if t.missed <= self.max_missed]

        return assigned_tracks  # type: ignore[return-value]
