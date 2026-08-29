import os
import time
import logging
import threading
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Any
import numpy as np
import cv2

logger = logging.getLogger("ibvap.ai.detector")

from app.config import settings

# Category mapping for border surveillance operations
CATEGORY_MAPPINGS = {
    # Person
    "person": "person",
    
    # Vehicles
    "car": "vehicle",
    "truck": "vehicle",
    "bus": "vehicle",
    "motorcycle": "vehicle",
    "bicycle": "vehicle",
    "airplane": "vehicle",
    "boat": "vehicle",
    "train": "vehicle",
    
    # Animals (Border wildlife & livestock)
    "bird": "animal",
    "cat": "animal",
    "dog": "animal",
    "horse": "animal",
    "sheep": "animal",
    "cow": "animal",
    "elephant": "animal",
    "bear": "animal",
    "zebra": "animal",
    "giraffe": "animal",
    
    # Dedicated Drone / UAV classes (when trained model weights present)
    "drone": "drone",
    "uav": "drone",
    "quadcopter": "drone",
}

class YOLOObjectDetector:
    """
    Real-time Object Detection engine powered by the YOLO architecture.
    Supports person, vehicle, animal, and specialized drone detection with
    configurable per-class thresholds, NMS filtering, and hardware acceleration fallback.
    """
    def __init__(
        self,
        model_name: Optional[str] = None,
        device: str = "auto",
        conf_thresholds: Optional[Dict[str, float]] = None
    ):
        self.model_name = model_name or getattr(settings, "YOLO_MODEL_PATH", "yolov8n.pt")
        self.device_setting = device
        self.model = None
        self.is_loaded = False
        self.status = "UNAVAILABLE"
        self.drone_status = "NOT CONFIGURED"
        self.device_used = "CPU"
        self._inference_lock = threading.Lock()
        
        # Default configurable thresholds
        self.thresholds = {
            "person": 0.40,
            "vehicle": 0.45,
            "animal": 0.35,
            "drone": 0.30,
            "other": 0.40
        }
        if conf_thresholds:
            self.thresholds.update(conf_thresholds)

        self._initialize_model()

    def update_thresholds(self, new_thresholds: Dict[str, float]):
        """Dynamically updates class confidence thresholds."""
        self.thresholds.update(new_thresholds)

    def _initialize_model(self):
        """Loads YOLO model with hardware detection and CPU fallback."""
        try:
            import torch
            from ultralytics import YOLO

            # Determine device
            if self.device_setting == "cuda" and torch.cuda.is_available():
                self.device_used = "CUDA"
            elif self.device_setting == "cpu":
                self.device_used = "CPU"
            else:
                self.device_used = "CUDA" if torch.cuda.is_available() else "CPU"

            model_filename = f"{self.model_name}.pt" if not self.model_name.endswith((".pt", ".onnx", ".engine")) else self.model_name
            
            # Resolve relative model paths robustly across launch locations
            if not os.path.isabs(model_filename) and not os.path.exists(model_filename):
                base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
                possible_paths = [
                    os.path.join(base_dir, model_filename),
                    os.path.join(base_dir, "models", model_filename),
                    os.path.join(base_dir, "weights", model_filename),
                ]
                for p in possible_paths:
                    if os.path.exists(p):
                        model_filename = p
                        break

            logger.info(f"Loading YOLO detector '{model_filename}' on {self.device_used}...")
            
            self.model = YOLO(model_filename)
            self.is_loaded = True
            self.status = "LOADED"
            
            # Check if drone classes are present in loaded model
            if self.model and hasattr(self.model, "names") and isinstance(self.model.names, dict):
                has_drone_class = any(c in str(v).lower() for v in self.model.names.values() for c in ["drone", "uav", "quadcopter"])
                self.drone_status = "LOADED" if has_drone_class else "NOT CONFIGURED"
            
            logger.info(f"YOLO detector '{model_filename}' successfully initialized on {self.device_used}. Drone status: {self.drone_status}.")
        except Exception as e:
            logger.error(f"Failed to load YOLO model '{self.model_name}': {e}.")
            self.is_loaded = False
            self.status = "UNAVAILABLE"
            self.drone_status = "NOT CONFIGURED"
            self.device_used = "CPU (Fallback)"

    def detect(
        self,
        frame: np.ndarray,
        camera_id: str,
        input_size: int = 640
    ) -> List[Dict[str, Any]]:
        """
        Executes inference on a BGR image frame.
        Returns list of detections: [{class_name, category, confidence, bbox: {x, y, width, height}, timestamp, camera_id}]
        """
        if frame is None or frame.size == 0:
            return []

        orig_h, orig_w = frame.shape[:2]
        timestamp = datetime.utcnow()
        detections = []

        if self.is_loaded and self.model is not None:
            try:
                # Run YOLO inference with thread safety
                with self._inference_lock:
                    results = self.model(
                        frame,
                        imgsz=input_size,
                        device=0 if self.device_used == "CUDA" else "cpu",
                        verbose=False,
                        conf=0.25 # Base threshold, filtered individually below
                    )

                if results and len(results) > 0:
                    r = results[0]
                    boxes = r.boxes

                    for i in range(len(boxes)):
                        cls_id = int(boxes.cls[i].item())
                        class_name = self.model.names.get(cls_id, f"class_{cls_id}").lower()
                        conf = float(boxes.conf[i].item())
                        category = CATEGORY_MAPPINGS.get(class_name, "other")

                        # Apply category-specific confidence threshold
                        min_conf = self.thresholds.get(category, self.thresholds.get("other", 0.40))
                        if conf < min_conf:
                            continue

                        # Extract bounding box in xyxy pixel coordinates
                        xyxy = boxes.xyxy[i].cpu().numpy()
                        x1, y1, x2, y2 = xyxy
                        
                        # Clip to frame boundary
                        x1 = max(0, min(orig_w - 1, float(x1)))
                        y1 = max(0, min(orig_h - 1, float(y1)))
                        x2 = max(x1 + 1, min(orig_w, float(x2)))
                        y2 = max(y1 + 1, min(orig_h, float(y2)))

                        w = x2 - x1
                        h = y2 - y1

                        detections.append({
                            "class_name": class_name,
                            "category": category,
                            "confidence": round(conf, 3),
                            "bbox": {
                                "x": round(x1, 1),
                                "y": round(y1, 1),
                                "width": round(w, 1),
                                "height": round(h, 1)
                            },
                            "timestamp": timestamp,
                            "camera_id": camera_id
                        })

                return detections

            except Exception as e:
                logger.error(f"Inference error on camera {camera_id}: {e}")
                return []

        # Return empty list cleanly if model is not loaded or frame cannot be processed
        return []
