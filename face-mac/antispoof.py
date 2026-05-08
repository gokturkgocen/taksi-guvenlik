"""Silent-Face-Anti-Spoofing wrapper (MiniVision MiniFASNet ensemble).

MiniVision'in orijinal kodu her predict cagrisinda modeli diskten yeniden
yukluyor -> cok yavas. Bu wrapper iki modeli start'ta bir kez yukleyip
cache'ler. InsightFace'ten gelen bbox'u [x1,y1,x2,y2] formatinda alir,
MiniVision'in [x,y,w,h] formatina cevirir.

API:
    detector = AntiSpoof()
    is_real, score = detector.predict(frame_bgr, bbox_xyxy)
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn.functional as F

from src.generate_patches import CropImage
from src.model_lib.MiniFASNet import (
    MiniFASNetV1, MiniFASNetV1SE, MiniFASNetV2, MiniFASNetV2SE,
)
from src.utility import get_kernel, parse_model_name

_MODEL_MAPPING = {
    "MiniFASNetV1": MiniFASNetV1,
    "MiniFASNetV2": MiniFASNetV2,
    "MiniFASNetV1SE": MiniFASNetV1SE,
    "MiniFASNetV2SE": MiniFASNetV2SE,
}

_MODEL_DIR = Path(__file__).parent / "antispoof_models"


class AntiSpoof:
    """MiniFASNet ensemble. Iki model toplam skorla karar verir."""

    def __init__(self, model_dir: Path = _MODEL_DIR, device: str = "cpu"):
        self.device = torch.device(device)
        self.cropper = CropImage()
        self.models: list[tuple[torch.nn.Module, float, int, int]] = []  # (model, scale, h, w)

        for pth in sorted(model_dir.glob("*.pth")):
            h, w, model_type, scale = parse_model_name(pth.name)
            kernel = get_kernel(h, w)
            model = _MODEL_MAPPING[model_type](conv6_kernel=kernel).to(self.device)

            state_dict = torch.load(pth, map_location=self.device, weights_only=True)
            # Bazi weight'ler DataParallel'den geliyor (module. prefix), temizle
            first = next(iter(state_dict))
            if first.startswith("module."):
                state_dict = {k[7:]: v for k, v in state_dict.items()}
            model.load_state_dict(state_dict)
            model.eval()
            self.models.append((model, scale, h, w))

        if not self.models:
            raise RuntimeError(f"Model bulunamadi: {model_dir}")

    def predict(self, frame_bgr: np.ndarray, bbox_xyxy: np.ndarray) -> tuple[bool, float]:
        """
        Args:
            frame_bgr: tam frame (BGR, HxWx3)
            bbox_xyxy: [x1, y1, x2, y2] InsightFace'ten gelen bbox
        Returns:
            (is_real, real_score): real_score 0-1 arasi, 0.5 uzeri canli
        """
        x1, y1, x2, y2 = [int(v) for v in bbox_xyxy]
        bbox_xywh = [x1, y1, x2 - x1, y2 - y1]

        # Ensemble: her modelin softmax'ini topla
        # MiniFASNet cikisi 3 sinifli: [spoof_2d, real, spoof_3d_mask] genelde.
        # Onlarin kodunda argmax == 1 -> real.
        prediction = np.zeros((1, 3), dtype=np.float32)
        for model, scale, h, w in self.models:
            crop_cfg = {
                "org_img": frame_bgr,
                "bbox": bbox_xywh,
                "scale": scale,
                "out_w": w,
                "out_h": h,
                "crop": scale is not None,
            }
            patch = self.cropper.crop(**crop_cfg)
            # ONEMLI: MiniVision'in kendi ToTensor'u 255'e BOLMEZ (functional.py'da
            # `.div(255)` bilerek kaldirilmis). Model 0-255 float input bekliyor.
            tensor = torch.from_numpy(patch.transpose(2, 0, 1)).float().unsqueeze(0)
            tensor = tensor.to(self.device)
            with torch.no_grad():
                logits = model(tensor)
                probs = F.softmax(logits, dim=1).cpu().numpy()
            prediction += probs

        label = int(np.argmax(prediction))
        score = float(prediction[0, label] / len(self.models))
        is_real = label == 1
        # Real sinif skorunu dondur (GUI icin daha anlamli)
        real_score = float(prediction[0, 1] / len(self.models))
        return is_real, real_score
