import os
import cv2
import math
import logging
import numpy as np
from typing import List, Tuple, Optional, Any
from app.config import settings

logger = logging.getLogger("ibvap.face.embedding")

def validate_embedding(vec: Any, expected_dim: int = 128) -> Tuple[bool, Optional[str]]:
    """
    Strictly validates biometric embedding vector properties:
    - Must be a non-empty list of numeric values
    - Must match configured dimensionality exactly (e.g. 128)
    - Must contain only finite real numbers (no NaN, no Inf)
    - Must not be all zeros
    """
    if vec is None:
        return False, "Biometric embedding vector is required."
    if not isinstance(vec, (list, tuple)):
        return False, f"Embedding must be a list of floats, got {type(vec).__name__}."
    if len(vec) != expected_dim:
        return False, f"Embedding dimensionality mismatch: expected {expected_dim}-d vector, got {len(vec)}-d."
    
    for i, val in enumerate(vec):
        if not isinstance(val, (int, float)):
            return False, f"Embedding element at index {i} is not a valid number."
        if math.isnan(val) or math.isinf(val):
            return False, f"Embedding element at index {i} contains non-finite value (NaN or Inf)."
    
    # Check non-trivial vector
    arr = np.array(vec, dtype=np.float32)
    norm = float(np.linalg.norm(arr))
    if norm < 1e-6:
        return False, "Embedding vector cannot be empty or zero-norm."
    
    return True, None

def compute_cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Computes standard cosine similarity between two normalized feature vectors:
    sim = (u . v) / (||u|| * ||v||)
    Returns 0.0 on malformed, NaN, or dimension mismatch.
    """
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0

    valid1, _ = validate_embedding(vec1, expected_dim=len(vec1))
    valid2, _ = validate_embedding(vec2, expected_dim=len(vec2))
    if not valid1 or not valid2:
        return 0.0

    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    dot = np.dot(a, b)
    similarity = dot / (norm_a * norm_b)
    if math.isnan(similarity) or math.isinf(similarity):
        return 0.0
    return round(float(np.clip(similarity, 0.0, 1.0)), 4)

class FaceEmbeddingEngine:
    """
    Neural Face Embedding Extractor with SFace/ArcFace ONNX support.
    Safely reports FACE_MODEL_LOADED, FACE_MODEL_UNAVAILABLE, or FACE_MODEL_ERROR.
    Never fabricates fake biometric vectors when model is unprovisioned.
    """
    def __init__(self, vector_dim: int = 128, model_path: Optional[str] = None):
        self.vector_dim = vector_dim
        self.model_path = model_path or getattr(settings, "FACE_MODEL_PATH", "face_recognition_sface.onnx")
        self.model = None
        self.is_loaded = False
        self.status = "FACE_MODEL_UNAVAILABLE"
        self._initialize_model()

    def _initialize_model(self):
        """Attempts to load real SFace/ONNX neural face recognizer if model file is present."""
        resolved_path = self._resolve_model_path(self.model_path)
        if not resolved_path or not os.path.exists(resolved_path):
            self.status = "FACE_MODEL_UNAVAILABLE"
            self.is_loaded = False
            logger.info(f"Face recognition neural weights not found at '{self.model_path}'. Status: {self.status}.")
            return

        try:
            # Attempt to create SFace recognizer via OpenCV DNN module
            if hasattr(cv2, "FaceRecognizerSF"):
                self.model = cv2.FaceRecognizerSF.create(resolved_path, "")
                self.is_loaded = True
                self.status = "FACE_MODEL_LOADED"
                logger.info(f"Face recognizer model successfully loaded from '{resolved_path}'.")
            else:
                self.model = cv2.dnn.readNet(resolved_path)
                self.is_loaded = True
                self.status = "FACE_MODEL_LOADED"
                logger.info(f"Generic ONNX face model loaded from '{resolved_path}'.")
        except Exception as e:
            self.status = "FACE_MODEL_ERROR"
            self.is_loaded = False
            logger.error(f"Failed to load face recognition model from '{resolved_path}': {e}")

    def _resolve_model_path(self, path: str) -> Optional[str]:
        if not path:
            return None
        if os.path.isabs(path) and os.path.exists(path):
            return path
        
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        possible_paths = [
            os.path.join(base_dir, path),
            os.path.join(base_dir, "models", path),
            os.path.join(base_dir, "weights", path),
        ]
        for p in possible_paths:
            if os.path.exists(p):
                return p
        return None

    def extract_embedding(self, face_image: np.ndarray) -> Optional[List[float]]:
        """
        Extracts real normalized L2 feature vector from facial image using loaded neural network.
        Returns None if model is unavailable or face image is empty.
        Does NOT fabricate heuristic or pseudo-random biometric embeddings.
        """
        if not self.is_loaded or self.model is None:
            return None

        if face_image is None or face_image.size == 0:
            return None

        try:
            # Standardize face image to 112x112
            resized = cv2.resize(face_image, (112, 112), interpolation=cv2.INTER_AREA)
            
            if hasattr(self.model, "feature"):
                # OpenCV SFace interface
                feat = self.model.feature(resized)
                arr = feat.flatten()
            else:
                blob = cv2.dnn.blobFromImage(resized, 1.0 / 127.5, (112, 112), (127.5, 127.5, 127.5), swapRB=True)
                self.model.setInput(blob)
                out = self.model.forward()
                arr = out.flatten()

            norm = float(np.linalg.norm(arr))
            if norm > 0:
                arr = arr / norm
            
            vec = [round(float(x), 5) for x in arr[:self.vector_dim].tolist()]
            return vec
        except Exception as e:
            logger.error(f"Error during neural face embedding extraction: {e}")
            return None

# Global Singleton
face_embedding_engine = FaceEmbeddingEngine(vector_dim=128)
