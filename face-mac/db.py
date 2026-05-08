"""Mock 'aranan sahis' veritabani. Embedding'leri pickle ile saklar."""
from __future__ import annotations

import pickle
from dataclasses import dataclass
from pathlib import Path

import numpy as np

DB_PATH = Path(__file__).parent / "embeddings.pkl"


@dataclass
class Person:
    name: str
    embedding: np.ndarray  # normalize edilmis 512-d vektor


def load() -> list[Person]:
    if not DB_PATH.exists():
        return []
    with DB_PATH.open("rb") as f:
        return pickle.load(f)


def save(people: list[Person]) -> None:
    with DB_PATH.open("wb") as f:
        pickle.dump(people, f)


def match(query: np.ndarray, people: list[Person], threshold: float) -> tuple[Person, float] | None:
    """Cosine similarity ile en yakin kisiyi bul. Esik altiysa None."""
    if not people:
        return None
    q = query / np.linalg.norm(query)
    sims = np.array([float(np.dot(q, p.embedding)) for p in people])
    idx = int(np.argmax(sims))
    if sims[idx] >= threshold:
        return people[idx], float(sims[idx])
    return None
