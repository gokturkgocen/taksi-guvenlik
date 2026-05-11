"""InsightFace pipeline: detect → embed → quality filter.

Wraps buffalo_l (RetinaFace + ArcFace R100). CPU-only ONNX runtime to keep
behaviour identical between Mac (Phase 1) and Linux EC2 (Phase 2).
"""
from __future__ import annotations

from typing import Optional

import cv2
import numpy as np
from insightface.app import FaceAnalysis


class Recognizer:
    def __init__(self, model_name: str = "buffalo_l", det_size: int = 640):
        self.app = FaceAnalysis(name=model_name, providers=["CPUExecutionProvider"])
        self.app.prepare(ctx_id=-1, det_size=(det_size, det_size))

    def best_face(self, jpeg_bytes: bytes) -> Optional[dict]:
        arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        faces = self.app.get(img)
        if not faces:
            return None
        face = max(faces, key=_bbox_area)
        return {
            "embedding": face.embedding.astype(np.float32),
            "det_score": float(face.det_score),
            "bbox": [int(x) for x in face.bbox],
            "yaw": float(face.pose[1]) if getattr(face, "pose", None) is not None else 0.0,
            "blur": _blur_score(img, face.bbox),
        }

    @staticmethod
    def is_quality(
        face: dict,
        min_det_score: float = 0.7,
        min_area: int = 80 * 80,
        max_yaw_deg: float = 30.0,
        min_blur: float = 10.0,
    ) -> bool:
        if face["det_score"] < min_det_score:
            return False
        if _bbox_area_from_list(face["bbox"]) < min_area:
            return False
        if abs(face["yaw"]) > max_yaw_deg:
            return False
        if face["blur"] < min_blur:
            return False
        return True


def _bbox_area(face) -> int:
    x1, y1, x2, y2 = face.bbox
    return int(max(0, x2 - x1) * max(0, y2 - y1))


def _bbox_area_from_list(bbox: list[int]) -> int:
    x1, y1, x2, y2 = bbox
    return max(0, x2 - x1) * max(0, y2 - y1)


def _blur_score(img: np.ndarray, bbox) -> float:
    x1, y1, x2, y2 = (int(v) for v in bbox)
    h, w = img.shape[:2]
    x1 = max(0, x1); y1 = max(0, y1)
    x2 = min(w, x2); y2 = min(h, y2)
    if x2 <= x1 or y2 <= y1:
        return 0.0
    crop = img[y1:y2, x1:x2]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())
