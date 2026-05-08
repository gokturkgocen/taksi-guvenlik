"""Aktif liveness: mediapipe FaceMesh uzerinden EAR (blink) + yaw proxy.

Passive CNN (MiniFASNet) yuksek kaliteli baski fotografi kandirabilir. Aktif
sinyaller bu sorunu buyuk olcude cozer:
- EAR zaman serisi: gercek insan goz kirpar. Fotograf kirpmaz.
- Yaw proxy: burun ucunun goz-orta noktasina gore yatay offseti. Kafa
  cevirmesinde degisir; statik fotografta sabit kalir.

Track seviyesinde biriktirilip karar verilir (recognize.py).
"""
from __future__ import annotations

import cv2
import mediapipe as mp
import numpy as np

# Mediapipe FaceMesh 468-landmark indeksleri
_LEFT_EYE = [33, 160, 158, 133, 153, 144]
_RIGHT_EYE = [362, 385, 387, 263, 373, 380]
_NOSE_TIP = 1
_LEFT_EYE_OUTER = 33
_RIGHT_EYE_OUTER = 263


def _ear(pts: np.ndarray) -> float:
    """Eye Aspect Ratio. pts: 6x2."""
    v1 = np.linalg.norm(pts[1] - pts[5])
    v2 = np.linalg.norm(pts[2] - pts[4])
    h = np.linalg.norm(pts[0] - pts[3])
    return float((v1 + v2) / (2.0 * h)) if h > 0 else 0.0


class ActiveLiveness:
    """Her frame'de tum yuzlere FaceMesh cikarir, (center, ear, yaw) doner."""

    def __init__(self, max_faces: int = 4):
        self.mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=max_faces,
            refine_landmarks=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def analyze_frame(self, frame_bgr: np.ndarray) -> list[dict]:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        res = self.mesh.process(rgb)
        out: list[dict] = []
        if not res.multi_face_landmarks:
            return out
        h, w = frame_bgr.shape[:2]
        for lms in res.multi_face_landmarks:
            pts = np.array([(p.x * w, p.y * h) for p in lms.landmark], dtype=np.float32)
            ear = (_ear(pts[_LEFT_EYE]) + _ear(pts[_RIGHT_EYE])) / 2.0
            lo, ro = pts[_LEFT_EYE_OUTER], pts[_RIGHT_EYE_OUTER]
            eye_mid_x = (lo[0] + ro[0]) / 2.0
            eye_dist = abs(ro[0] - lo[0])
            nose_x = pts[_NOSE_TIP][0]
            yaw = float((nose_x - eye_mid_x) / eye_dist) if eye_dist > 0 else 0.0
            cx = float(pts[:, 0].mean())
            cy = float(pts[:, 1].mean())
            out.append({"center": (cx, cy), "ear": ear, "yaw": yaw})
        return out

    @staticmethod
    def match(face_center: tuple[float, float], mesh_results: list[dict],
              max_dist: float = 120.0) -> dict | None:
        """InsightFace bbox merkezine en yakin mesh sonucunu bul."""
        best = None
        best_d = max_dist
        for m in mesh_results:
            d = float(np.hypot(m["center"][0] - face_center[0],
                                m["center"][1] - face_center[1]))
            if d < best_d:
                best_d = d
                best = m
        return best
