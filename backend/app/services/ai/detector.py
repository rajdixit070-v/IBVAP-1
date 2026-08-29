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
        self.drone_model = None
        self.is_loaded = False
        self.status = "NOT_CONFIGURED"
        self.error: Optional[str] = None
        self.drone_status = "NOT_CONFIGURED"
        self.drone_error: Optional[str] = None
        self.resolved_path: Optional[str] = None
        self.resolved_drone_path: Optional[str] = None
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

    @staticmethod
    def _resolve_path(path: Optional[str]) -> Optional[str]:
        """Resolves local model file path without triggering automatic external downloads."""
        if not path:
            return None
        # Clean extensions
        candidates = [path]
        if not path.endswith((".pt", ".onnx", ".engine")):
            candidates.append(f"{path}.pt")

        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

        for c in candidates:
            if os.path.isabs(c) and os.path.exists(c) and os.path.isfile(c):
                return c
            if os.path.exists(c) and os.path.isfile(c):
                return os.path.abspath(c)
            
            search_paths = [
                os.path.join(base_dir, c),
                os.path.join(base_dir, "models", c),
                os.path.join(base_dir, "weights", c),
                os.path.join(base_dir, "backend", c),
                os.path.join(base_dir, "backend", "models", c),
            ]
            for sp in search_paths:
                if os.path.exists(sp) and os.path.isfile(sp):
                    return os.path.abspath(sp)
        return None

    def _initialize_model(self):
        """Loads YOLO model with explicit file presence check, hardware detection and CPU fallback."""
        self.error = None
        self.drone_error = None
        self.is_loaded = False
        self.model = None
        self.drone_model = None

        # 1. Primary YOLO Model Check
        if not self.model_name:
            self.status = "NOT_CONFIGURED"
            logger.info("YOLO model not configured (YOLO_MODEL_PATH is empty).")
        else:
            self.resolved_path = self._resolve_path(self.model_name)
            if not self.resolved_path or not os.path.exists(self.resolved_path):
                self.status = "FILE_MISSING"
                self.error = f"YOLO model file not found at '{self.model_name}'."
                logger.warning(f"YOLO detector file missing at '{self.model_name}'. Status: {self.status}.")
            else:
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

                    logger.info(f"Loading YOLO detector '{self.resolved_path}' on {self.device_used}...")
                    self.model = YOLO(self.resolved_path)
                    self.is_loaded = True
                    self.status = "LOADED"
                    logger.info(f"YOLO detector successfully initialized from '{self.resolved_path}' on {self.device_used}.")
                except Exception as e:
                    self.is_loaded = False
                    self.status = "ERROR"
                    self.error = str(e)
                    logger.error(f"Failed to load YOLO model from '{self.resolved_path}': {e}")
                    self.device_used = "CPU (Fallback)"

        # 2. Dedicated Drone / UAV Model Check
        drone_path = getattr(settings, "DRONE_MODEL_PATH", None)
        if not drone_path:
            # Check if primary YOLO model has explicit drone class
            if self.is_loaded and self.model and hasattr(self.model, "names") and isinstance(self.model.names, dict):
                has_drone_class = any(c in str(v).lower() for v in self.model.names.values() for c in ["drone", "uav", "quadcopter"])
                self.drone_status = "LOADED" if has_drone_class else "NOT_CONFIGURED"
            else:
                self.drone_status = "NOT_CONFIGURED"
        else:
            self.resolved_drone_path = self._resolve_path(drone_path)
            if not self.resolved_drone_path or not os.path.exists(self.resolved_drone_path):
                self.drone_status = "FILE_MISSING"
                self.drone_error = f"Dedicated drone model file not found at '{drone_path}'."
                logger.warning(f"Drone detector file missing at '{drone_path}'. Status: {self.drone_status}.")
            else:
                try:
                    from ultralytics import YOLO
                    self.drone_model = YOLO(self.resolved_drone_path)
                    self.drone_status = "LOADED"
                    logger.info(f"Dedicated Drone detector successfully initialized from '{self.resolved_drone_path}'.")
                except Exception as e:
                    self.drone_status = "ERROR"
                    self.drone_error = str(e)
                    logger.error(f"Failed to load dedicated drone model from '{self.resolved_drone_path}': {e}")

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

        # 2. Run dedicated drone detector if loaded
        if self.drone_status == "LOADED" and self.drone_model is not None:
            try:
                with self._inference_lock:
                    drone_results = self.drone_model(
                        frame,
                        imgsz=input_size,
                        device=0 if self.device_used == "CUDA" else "cpu",
                        verbose=False,
                        conf=self.thresholds.get("drone", 0.30)
                    )
                if drone_results and len(drone_results) > 0:
                    d_boxes = drone_results[0].boxes
                    for i in range(len(d_boxes)):
                        cls_id = int(d_boxes.cls[i].item())
                        class_name = self.drone_model.names.get(cls_id, "drone").lower()
                        conf = float(d_boxes.conf[i].item())
                        min_conf = self.thresholds.get("drone", 0.30)
                        if conf < min_conf:
                            continue
                        xyxy = d_boxes.xyxy[i].cpu().numpy()
                        x1, y1, x2, y2 = xyxy
                        x1 = max(0, min(orig_w - 1, float(x1)))
                        y1 = max(0, min(orig_h - 1, float(y1)))
                        x2 = max(x1 + 1, min(orig_w, float(x2)))
                        y2 = max(y1 + 1, min(orig_h, float(y2)))
                        detections.append({
                            "class_name": class_name,
                            "category": "drone",
                            "confidence": round(conf, 3),
                            "bbox": {
                                "x": round(x1, 1),
                                "y": round(y1, 1),
                                "width": round(x2 - x1, 1),
                                "height": round(y2 - y1, 1)
                            },
                            "timestamp": timestamp,
                            "camera_id": camera_id
                        })
            except Exception as e:
                logger.error(f"Dedicated drone model inference error on camera {camera_id}: {e}")

        return detections
