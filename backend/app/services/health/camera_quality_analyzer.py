import cv2
import numpy as np
import logging
from typing import Dict, Any, Tuple

logger = logging.getLogger("ibvap.health.quality")

class CameraQualityAnalyzer:
    """
    Analyzes raw video frames for optical blur, luminance brightness, contrast,
    and visual camera tampering / lens obstruction.
    Modulates downstream AI detection confidence based on observable quality.
    """

    @staticmethod
    def analyze_frame(frame: np.ndarray) -> Dict[str, Any]:
        """
        Analyzes a single BGR frame and computes quality and tampering metrics.
        """
        if frame is None or frame.size == 0:
            return {
                "blur_score": 0.0,
                "brightness_score": 0.0,
                "contrast_score": 0.0,
                "image_quality_score": 0.0,
                "low_light_confidence": 0.2,
                "tampering_detected": True,
                "tampering_reason": "Missing or empty video frame",
                "confidence_multiplier": 0.4
            }

        # Optimize performance: downsample high-res frames for fast metric calculation
        h, w = frame.shape[:2]
        if w > 320:
            scale = 320.0 / w
            small = cv2.resize(frame, (320, max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
        else:
            small = frame

        # Convert to grayscale
        if len(small.shape) == 3:
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        else:
            gray = small

        # 1. Optical Blur (Laplacian variance: higher = sharper, < 80 = blurred)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        blur_var = float(laplacian.var())

        # 2. Brightness (Mean pixel intensity 0 - 255)
        mean_brightness = float(np.mean(gray))

        # 3. Contrast (Standard deviation of pixel intensity)
        contrast = float(np.std(gray))

        # 4. Low-light confidence factor (0.0 to 1.0)
        # Optimal luminance range ~ 70-170
        if mean_brightness < 30:
            low_light_conf = max(0.3, mean_brightness / 100.0)
        elif mean_brightness > 225:
            low_light_conf = max(0.4, (255 - mean_brightness) / 100.0)
        else:
            low_light_conf = 0.95

        # 5. Potential Tampering / Obstruction Detection
        tampering = False
        tamper_reason = None

        if mean_brightness < 12.0 and contrast < 8.0:
            tampering = True
            tamper_reason = "Potential camera obstruction: Full-frame extreme darkness / covered lens"
        elif blur_var < 15.0 and contrast < 12.0:
            tampering = True
            tamper_reason = "Potential camera obstruction: Uniform blur / spray or lens occlusion"

        # 6. Composite Image Quality Score (0 to 100)
        # Blur component (0 to 40 pts)
        blur_pts = min(40.0, (blur_var / 250.0) * 40.0)
        # Brightness component (0 to 30 pts)
        if 60 <= mean_brightness <= 180:
            bright_pts = 30.0
        else:
            dist = min(abs(mean_brightness - 60), abs(mean_brightness - 180))
            bright_pts = max(5.0, 30.0 - (dist / 4.0))
        # Contrast component (0 to 30 pts)
        contrast_pts = min(30.0, (contrast / 60.0) * 30.0)

        quality_score = round(max(5.0, min(100.0, blur_pts + bright_pts + contrast_pts)), 1)
        if tampering:
            quality_score = min(quality_score, 20.0)

        # 7. Confidence Multiplier for downstream AI analytics
        # Good video quality keeps multiplier near 1.0; poor video lowers confidence down to 0.45
        conf_multiplier = max(0.45, min(1.0, quality_score / 100.0))

        return {
            "blur_score": round(blur_var, 1),
            "brightness_score": round(mean_brightness, 1),
            "contrast_score": round(contrast, 1),
            "image_quality_score": quality_score,
            "low_light_confidence": round(low_light_conf, 2),
            "tampering_detected": tampering,
            "tampering_reason": tamper_reason,
            "confidence_multiplier": round(conf_multiplier, 2)
        }

camera_quality_analyzer = CameraQualityAnalyzer()
