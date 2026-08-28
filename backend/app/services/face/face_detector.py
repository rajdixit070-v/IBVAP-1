import cv2
import numpy as np
from typing import Tuple, Optional, Dict, Any

def crop_face_region(frame: np.ndarray, person_bbox: Dict[str, float]) -> Optional[np.ndarray]:
    """
    Crops the candidate facial/head region (top 35% central area of person bbox).
    """
    if frame is None or frame.size == 0:
        return None

    h, w = frame.shape[:2]
    px = max(0, int(person_bbox["x"]))
    py = max(0, int(person_bbox["y"]))
    pw = max(10, int(person_bbox["width"]))
    ph = max(10, int(person_bbox["height"]))

    px2 = min(w, px + pw)
    py2 = min(h, py + ph)

    if px2 <= px or py2 <= py:
        return None

    person_crop = frame[py:py2, px:px2]
    if person_crop.shape[0] < 30 or person_crop.shape[1] < 20:
        return None

    pc_h, pc_w = person_crop.shape[:2]
    
    # Focus on top 35% of the person body (head zone)
    f_top = 0
    f_bottom = int(pc_h * 0.35)
    f_left = int(pc_w * 0.15)
    f_right = int(pc_w * 0.85)

    face_zone = person_crop[f_top:f_bottom, f_left:f_right]
    if face_zone.size == 0:
        return None

    return face_zone

def evaluate_face_quality(face_crop: np.ndarray) -> Tuple[float, bool]:
    """
    Quality gate checking face size, blurriness (Laplacian variance), and illumination.
    Returns: (quality_score 0.0 - 1.0, is_acceptable).
    """
    if face_crop is None or face_crop.size == 0:
        return 0.0, False

    h, w = face_crop.shape[:2]
    
    # Size check (must be at least 32x32)
    if h < 32 or w < 32:
        return 0.2, False

    if len(face_crop.shape) == 3:
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = face_crop

    # Sharpness / Blur check
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if lap_var < 35.0: # Too blurry
        return round(min(0.4, lap_var / 100.0), 2), False

    # Illumination check
    mean_bright = np.mean(gray)
    if mean_bright < 35 or mean_bright > 230: # Under/Over exposed
        return 0.35, False

    sharpness_score = min(1.0, lap_var / 200.0)
    size_score = min(1.0, (h * w) / (80.0 * 80.0))
    quality = (sharpness_score * 0.6) + (size_score * 0.4)

    is_acceptable = bool(quality >= 0.45)
    return round(float(quality), 2), is_acceptable
