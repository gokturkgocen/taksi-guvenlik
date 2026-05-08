"""Pickle-based face DB. L2-normalized embeddings, cosine similarity match."""
from __future__ import annotations

import os
import pickle
from typing import Tuple

import numpy as np


class FaceDB:
    """Tiny in-memory + on-disk face database.

    Schema: list[(name: str, embedding: np.ndarray[float32, 512], normalized)]
    """

    def __init__(self, path: str):
        self.path = path
        self.entries: list[tuple[str, np.ndarray]] = []
        if os.path.exists(path):
            with open(path, "rb") as f:
                self.entries = pickle.load(f)

    def add(self, name: str, embedding: np.ndarray) -> None:
        emb = embedding.astype(np.float32)
        emb = emb / max(np.linalg.norm(emb), 1e-9)
        self.entries.append((name, emb))
        self.save()

    def remove(self, name: str) -> int:
        before = len(self.entries)
        self.entries = [(n, e) for n, e in self.entries if n != name]
        self.save()
        return before - len(self.entries)

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        with open(self.path, "wb") as f:
            pickle.dump(self.entries, f)

    def match(self, embedding: np.ndarray, threshold: float = 0.4) -> Tuple[bool, str, float]:
        if not self.entries:
            return False, "", 0.0
        emb = embedding.astype(np.float32)
        emb = emb / max(np.linalg.norm(emb), 1e-9)
        best_name = ""
        best_sim = -1.0
        for name, db_emb in self.entries:
            sim = float(np.dot(emb, db_emb))
            if sim > best_sim:
                best_sim = sim
                best_name = name
        return best_sim >= threshold, best_name, best_sim

    def __len__(self) -> int:
        return len(self.entries)
