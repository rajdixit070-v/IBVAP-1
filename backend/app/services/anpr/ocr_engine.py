import re
import cv2
import logging
import numpy as np
from typing import Tuple, Optional

logger = logging.getLogger("ibvap.anpr.ocr")

# Regex pattern for Indian/Standard License Plates (e.g. UP32AB1234, DL01C8899, MH12DE1432, US/UK alphanumeric)
STANDARD_PLATE_REGEX = re.compile(r'^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$')
GENERIC_PLATE_REGEX = re.compile(r'^[A-Z0-9]{5,12}$')

def normalize_plate_number(raw_text: str) -> str:
    """
    Standardizes license plate text:
    - Removes spaces, hyphens, dots, special symbols
    - Converts to uppercase
    - Cleans non-alphanumeric characters
    """
    if not raw_text:
        return ""

    cleaned = re.sub(r'[^A-Za-z0-9]', '', raw_text).upper()
    return cleaned

class OCREngine:
    """
    Pluggable License Plate OCR Engine.
    Handles image parsing, text normalization, and confidence scoring.
    """
    def __init__(self):
        self._reader = None
        self._initialized = False

    def _lazy_init(self):
        if not self._initialized:
            self._initialized = True

    def recognize(self, plate_image: np.ndarray, synthetic_hint: Optional[str] = None) -> Tuple[str, str, float]:
        """
        Executes OCR on enhanced plate crop.
        Returns: (raw_text, normalized_text, confidence)
        """
        if plate_image is None or plate_image.size == 0:
            return "", "", 0.0

        if synthetic_hint:
            norm = normalize_plate_number(synthetic_hint)
            return synthetic_hint, norm, 0.94

        raw_text = ""
        confidence = 0.0

        # Try to use pytesseract if available in python environment and binary installed
        try:
            import pytesseract
            raw_text = pytesseract.image_to_string(
                plate_image,
                config='--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            ).strip()
            confidence = 0.88 if len(raw_text) >= 5 else (0.40 if raw_text else 0.0)
        except Exception as e:
            logger.debug(f"OCR execution skipped or Tesseract engine not found: {e}")
            raw_text = ""
            confidence = 0.0

        norm = normalize_plate_number(raw_text)
        if not norm:
            return "", "", 0.0

        # Apply standard plate format confidence boost if matching syntax
        if STANDARD_PLATE_REGEX.match(norm):
            confidence = min(0.98, confidence + 0.08)
        elif not GENERIC_PLATE_REGEX.match(norm):
            confidence = max(0.20, confidence - 0.30)

        return raw_text, norm, round(confidence, 2)

# Global OCR Singleton
ocr_engine = OCREngine()
