import os
import cv2
import time
import uuid
import hashlib
import logging
import threading
import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional, List

from edge_agent.config import LocalCameraConfig, EdgeAgentConfig
from edge_agent.storage import EdgeLocalStorage

logger = logging.getLogger("ibvap.edge.ai_worker")

class EdgeCameraWorker(threading.Thread):
    """
    Dedicated worker thread per camera.
    Consumes local RTSP on the Outpost LAN, runs YOLO inference,
    creates tactical evidence snapshots, and buffers detections into local storage.
    """

    def __init__(self, camera_cfg: LocalCameraConfig, agent_cfg: EdgeAgentConfig, storage: EdgeLocalStorage):
        super().__init__(daemon=True, name=f"Worker-{camera_cfg.camera_id}")
        self.camera_cfg = camera_cfg
        self.agent_cfg = agent_cfg
        self.storage = storage
        self.running = True
        self.is_connected = False
        self.fps = 0.0
        self.last_detection_time: Dict[int, float] = {} # track_id -> last_alert_time
        
        # Load YOLO model
        self.model = None
        self._load_yolo()

    def _load_yolo(self):
        try:
            from ultralytics import YOLO
            model_path = self.agent_cfg.yolo_model_path
            if not os.path.exists(model_path):
                # Fallback to yolov8n.pt in root if present
                if os.path.exists("models/yolov8n.pt"):
                    model_path = "models/yolov8n.pt"
            self.model = YOLO(model_path)
            logger.info(f"Loaded Edge YOLO detector from '{model_path}' for camera {self.camera_cfg.camera_id}")
        except Exception as e:
            logger.warning(f"Could not load local YOLO model ({e}). Using simulated edge vision pipeline.")
            self.model = None

    def stop(self):
        self.running = False

    def run(self):
        logger.info(f"Starting local RTSP ingestion for {self.camera_cfg.camera_id} -> {self.camera_cfg.rtsp_url}")
        
        # Determine source
        src = self.camera_cfg.rtsp_url
        if src.startswith("webcam://") or src.startswith("device://"):
            try:
                src = int(src.replace("webcam://", "").replace("device://", ""))
            except ValueError:
                src = 0

        cap = None
        reconnect_delay = 3.0

        while self.running:
            try:
                if cap is None or not cap.isOpened():
                    logger.info(f"Connecting to camera {self.camera_cfg.camera_id}...")
                    cap = cv2.VideoCapture(src)
                    if not cap.isOpened():
                        self.is_connected = False
                        time.sleep(reconnect_delay)
                        continue
                    self.is_connected = True
                    logger.info(f"Connected to camera {self.camera_cfg.camera_id} successfully.")

                ret, frame = cap.read()
                if not ret or frame is None:
                    self.is_connected = False
                    cap.release()
                    cap = None
                    time.sleep(reconnect_delay)
                    continue

                # Run AI detection
                self._process_frame(frame)

                # Cap processing rate according to detection_fps
                time.sleep(1.0 / max(1.0, self.agent_cfg.detection_fps))

            except Exception as e:
                logger.error(f"Error in camera worker {self.camera_cfg.camera_id}: {e}", exc_info=True)
                time.sleep(reconnect_delay)

        if cap:
            cap.release()
        logger.info(f"Worker for {self.camera_cfg.camera_id} stopped.")

    def _process_frame(self, frame: np.ndarray):
        """Runs YOLO detection and buffers intrusions to local store-and-forward queue."""
        h, w = frame.shape[:2]
        detections = []

        if self.model is not None:
            try:
                results = self.model(frame, conf=self.agent_cfg.confidence_threshold, verbose=False)
                for r in results:
                    boxes = r.boxes
                    if boxes is None:
                        continue
                    for box in boxes:
                        cls_id = int(box.cls[0])
                        cls_name = self.model.names.get(cls_id, "unknown").lower()
                        conf = float(box.conf[0])
                        xyxy = box.xyxy[0].tolist()

                        # Check for tactical target classes: person, car, truck, bus, motorcycle, animal
                        cat = "other"
                        if cls_name == "person":
                            cat = "person"
                        elif cls_name in ["car", "truck", "bus", "motorcycle"]:
                            cat = "vehicle"
                        elif cls_name in ["dog", "horse", "cow", "sheep", "bird"]:
                            cat = "animal"

                        if cat != "other":
                            detections.append({
                                "class": cls_name,
                                "category": cat,
                                "confidence": conf,
                                "bbox": {
                                    "x": int(xyxy[0]),
                                    "y": int(xyxy[1]),
                                    "w": int(xyxy[2] - xyxy[0]),
                                    "h": int(xyxy[3] - xyxy[1])
                                }
                            })
            except Exception as e:
                logger.debug(f"Inference error: {e}")

        # If detections found, trigger tactical event and forensic photo
        for idx, det in enumerate(detections):
            now = time.time()
            # Debounce: alert max once every 15s per object category on same camera
            cat = det["category"]
            last_t = self.last_detection_time.get(cat, 0.0)
            if now - last_t < 15.0:
                continue
            self.last_detection_time[cat] = now

            # Save forensic snapshot JPEG locally
            evd_path, sha256_hash = self._save_forensic_snapshot(frame, det)

            event_id = f"EVT-EDGE-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
            priority = "CRITICAL" if cat == "person" else "HIGH" if cat == "vehicle" else "MEDIUM"
            risk_score = 85 if cat == "person" else 65 if cat == "vehicle" else 40

            event_payload = {
                "event_id": event_id,
                "node_id": self.agent_cfg.node_id,
                "camera_id": self.camera_cfg.camera_id,
                "track_id": idx + 1,
                "object_type": det["class"],
                "event_type": f"EDGE_{cat.upper()}_DETECTED",
                "severity": "CRITICAL" if priority == "CRITICAL" else "HIGH",
                "risk_score": risk_score,
                "risk_level": "HIGH" if risk_score >= 70 else "MEDIUM",
                "priority": priority,
                "confidence": round(det["confidence"], 2),
                "bbox": det["bbox"],
                "evidence_checksum": sha256_hash,
                "timestamp": datetime.utcnow().isoformat()
            }

            self.storage.buffer_event(
                event_dict=event_payload,
                evidence_file_path=evd_path,
                evidence_checksum=sha256_hash
            )

    def _save_forensic_snapshot(self, frame: np.ndarray, det: Dict[str, Any]) -> tuple[str, str]:
        """Draws HUD header & tactical bounding box, writes JPEG, and computes SHA-256."""
        annotated = frame.copy()
        h, w = annotated.shape[:2]
        bbox = det["bbox"]
        cat = det["category"]

        color = (0, 0, 230) if cat == "person" else (0, 180, 255) if cat == "vehicle" else (0, 230, 0)

        # Draw Target Box
        x1, y1 = bbox["x"], bbox["y"]
        x2, y2 = x1 + bbox["w"], y1 + bbox["h"]
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

        # Draw Label Banner
        label = f"EDGE-AI: {det['class'].upper()} ({int(det['confidence'] * 100)}%)"
        cv2.rectangle(annotated, (x1, max(0, y1 - 22)), (x1 + len(label) * 9, y1), color, -1)
        cv2.putText(annotated, label, (x1 + 3, max(14, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

        # Draw HUD Header
        hud_text = f"IBVAP EDGE [{self.agent_cfg.node_id}] • CAM: {self.camera_cfg.camera_id} • UTC: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"
        cv2.rectangle(annotated, (0, 0), (w, 24), (10, 15, 25), -1)
        cv2.putText(annotated, hud_text, (10, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 255), 1)

        evd_filename = f"EVD-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6].upper()}.jpg"
        evd_dir = os.path.join(self.storage.evidence_dir, self.camera_cfg.camera_id)
        os.makedirs(evd_dir, exist_ok=True)
        evd_path = os.path.join(evd_dir, evd_filename)

        cv2.imwrite(evd_path, annotated, [cv2.IMWRITE_JPEG_QUALITY, 90])

        # Compute SHA-256
        with open(evd_path, "rb") as f:
            file_bytes = f.read()
            sha256 = hashlib.sha256(file_bytes).hexdigest()

        return evd_path, sha256
