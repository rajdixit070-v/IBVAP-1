import cv2
import math
import numpy as np
from typing import List, Tuple, Optional

def compute_cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Computes standard cosine similarity between two normalized feature vectors:
    sim = (u . v) / (||u|| * ||v||)
    """
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0

    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    dot = np.dot(a, b)
    similarity = dot / (norm_a * norm_b)
    return round(float(np.clip(similarity, 0.0, 1.0)), 4)

class FaceEmbeddingEngine:
    """
    Modular Face Embedding Extractor.
    Extracts standardized 128-d normalized L2 feature vectors.
    """
    def __init__(self, vector_dim: int = 128):
        self.vector_dim = vector_dim

    def extract_embedding(self, face_image: np.ndarray, seed_id: Optional[str] = None) -> List[float]:
        """
        Extracts L2 normalized 128-d embedding from facial image.
        Uses deterministic visual spatial frequencies and color moments.
        """
        if face_image is None or face_image.size == 0:
            return [0.0] * self.vector_dim

        # Standardize face image to 112x112
        resized = cv2.resize(face_image, (112, 112), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if len(resized.shape) == 3 else resized

        # Compute spatial grid moments (4x4 grid = 16 blocks, 8 features each = 128 features)
        features = []
        block_h, block_w = 28, 28
        for r in range(4):
            for c in range(4):
                block = gray[r * block_h : (r + 1) * block_h, c * block_w : (c + 1) * block_w]
                mean = float(np.mean(block)) / 255.0
                std = float(np.std(block)) / 128.0
                grad_x = float(np.mean(np.abs(cv2.Sobel(block, cv2.CV_64F, 1, 0, ksize=3)))) / 255.0
                grad_y = float(np.mean(np.abs(cv2.Sobel(block, cv2.CV_64F, 0, 1, ksize=3)))) / 255.0
                features.extend([mean, std, grad_x, grad_y, mean * std, grad_x * grad_y, mean + grad_x, std + grad_y])

        arr = np.array(features[:self.vector_dim], dtype=np.float32)
        norm = np.linalg.norm(arr)
        if norm > 0:
            arr = arr / norm

        return [round(float(x), 5) for x in arr.tolist()]

# Global Singleton
face_embedding_engine = FaceEmbeddingEngine(vector_dim=128)
