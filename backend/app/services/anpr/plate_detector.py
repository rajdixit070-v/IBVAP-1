import cv2
import numpy as np
from typing import Tuple, Optional, Dict, Any

def crop_plate_region(frame: np.ndarray, vehicle_bbox: Dict[str, float]) -> Optional[np.ndarray]:
    """
    Crops the candidate license plate zone from the lower half of the vehicle bounding box.
    """
    if frame is None or frame.size == 0:
        return None

    h, w = frame.shape[:2]
    vx = max(0, int(vehicle_bbox["x"]))
    vy = max(0, int(vehicle_bbox["y"]))
    vw = max(10, int(vehicle_bbox["width"]))
    vh = max(10, int(vehicle_bbox["height"]))

    # Clamp vehicle coords to frame boundaries
    vx2 = min(w, vx + vw)
    vy2 = min(h, vy + vh)
    
    if vx2 <= vx or vy2 <= vy:
        return None

    vehicle_crop = frame[vy:vy2, vx:vx2]
    if vehicle_crop.shape[0] < 20 or vehicle_crop.shape[1] < 20:
        return None

    # Focus on lower 50% central region of the vehicle
    vc_h, vc_w = vehicle_crop.shape[:2]
    p_top = int(vc_h * 0.50)
    p_bottom = int(vc_h * 0.95)
    p_left = int(vc_w * 0.15)
    p_right = int(vc_w * 0.85)

    plate_zone = vehicle_crop[p_top:p_bottom, p_left:p_right]
    if plate_zone.size == 0:
        return None

    return plate_zone

def preprocess_plate_image(plate_crop: np.ndarray) -> np.ndarray:
    """
    Enhances license plate crop with contrast equalization, denoising, and adaptive binarization.
    """
    if plate_crop is None or plate_crop.size == 0:
        return plate_crop

    # 1. Resize to standardized OCR height (e.g. 80px)
    h, w = plate_crop.shape[:2]
    target_h = 80
    scale = target_h / max(1.0, float(h))
    target_w = max(160, int(w * scale))
    resized = cv2.resize(plate_crop, (target_w, target_h), interpolation=cv2.INTER_CUBIC)

    # 2. Grayscale conversion
    if len(resized.shape) == 3:
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    else:
        gray = resized

    # 3. CLAHE Contrast Equalization
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # 4. Bilateral Filter Denoise
    denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)

    return denoised

def estimate_plate_quality(plate_crop: np.ndarray) -> Tuple[float, bool]:
    """
    Evaluates resolution, sharpness (Laplacian variance), and contrast.
    Returns (quality_score 0.0 - 1.0, is_acceptable).
    """
    if plate_crop is None or plate_crop.size == 0:
        return 0.0, False

    h, w = plate_crop.shape[:2]
    if h < 18 or w < 40:
        return 0.2, False

    if len(plate_crop.shape) == 3:
        gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = plate_crop

    # Sharpness via Laplacian Variance
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    
    # Contrast via standard deviation
    contrast = np.std(gray)

    # Normalized score
    sharpness_score = min(1.0, lap_var / 250.0)
    contrast_score = min(1.0, contrast / 50.0)
    quality = (sharpness_score * 0.6) + (contrast_score * 0.4)

    is_acceptable = bool(quality >= 0.35 and lap_var > 30.0)
    return round(float(quality), 2), is_acceptable
