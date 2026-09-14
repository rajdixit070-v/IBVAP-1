import time
import threading
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
import numpy as np

from app.services.ai.detector import YOLOObjectDetector
from app.services.ai.tracker import ByteTracker, STrack
from app.schemas.ai import CameraAIStatus, CameraAICounters, TrackedObject, Point2D, BoundingBox
from app.services.stream_manager import stream_manager
from app.config import settings

logger = logging.getLogger("ibvap.ai.pipeline")

class CameraAIWorker:
    """
    Dedicated asynchronous worker thread for a single camera stream.
    Consumes frames from the StreamManager non-blocking buffer at target inference FPS,
    runs YOLO detection, updates ByteTrack tracker, and dispatches real-time telemetry.
    """
    def __init__(
        self,
        camera_id: str,
        detector: YOLOObjectDetector,
        target_fps: float = 10.0,
        input_size: int = 640,
        broadcast_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None
    ):
        self.camera_id = camera_id
        self.detector = detector
        self.target_fps = target_fps
        self.input_size = input_size
        self.broadcast_callback = broadcast_callback

        self.thresholds: Dict[str, float] = {
            "person": 0.40,
            "vehicle": 0.45,
            "animal": 0.35,
            "drone": 0.30,
            "other": 0.40
        }

        self.tracker = ByteTracker(camera_id=camera_id)
        self.is_running = False
        self.thread: Optional[threading.Thread] = None
        self._last_frame_count = -1
        
        # Health and performance metrics
        self.status = "STARTING" # ACTIVE, STARTING, PAUSED, ERROR, NO_STREAM
        self.inference_fps = 0.0
        self.latency_ms = 0.0
        self.frames_processed = 0
        self.frames_skipped = 0
        self.error_message: Optional[str] = None

        self.latest_tracks: List[STrack] = []
        self.latest_counters = CameraAICounters()
        
        # FPS calculation window
        self._fps_counter = 0
        self._fps_window_start = time.time()

    def update_config(self, config_obj_or_dict: Any):
        """Dynamically applies tuned AI thresholds and pipeline settings."""
        if config_obj_or_dict is None:
            return

        if hasattr(config_obj_or_dict, "__dict__"):
            data = {k: v for k, v in config_obj_or_dict.__dict__.items() if not k.startswith("_")}
        elif isinstance(config_obj_or_dict, dict):
            data = config_obj_or_dict
        else:
            return

        if "target_fps" in data and data["target_fps"] is not None:
            self.target_fps = max(1.0, min(30.0, float(data["target_fps"])))

        if "input_size" in data and data["input_size"] is not None:
            self.input_size = int(data["input_size"])

        # Update per-camera class confidence thresholds
        for k in ("person", "vehicle", "animal", "drone", "other"):
            conf_key = f"conf_{k}"
            if conf_key in data and data[conf_key] is not None:
                self.thresholds[k] = float(data[conf_key])

        # Update ByteTrack tracker parameters
        track_thresh = data.get("track_thresh")
        match_thresh = data.get("match_thresh")
        max_lost_frames = data.get("max_lost_frames")
        max_trajectory_length = data.get("max_trajectory_length")
        self.tracker.update_params(
            track_thresh=track_thresh,
            match_thresh=match_thresh,
            max_lost_frames=max_lost_frames,
            max_history=max_trajectory_length
        )

        # Handle enabled state toggle
        if "enabled" in data and data["enabled"] is not None:
            should_run = bool(data["enabled"])
            if should_run and not self.is_running:
                self.start()
            elif not should_run and self.is_running:
                self.stop()

    def start(self):
        """Starts the asynchronous AI inference worker thread."""
        if self.is_running:
            return
        self.is_running = True
        self.status = "ACTIVE"
        self.error_message = None
        self.thread = threading.Thread(target=self._worker_loop, name=f"AIWorker-{self.camera_id}", daemon=True)
        self.thread.start()
        logger.info(f"AI Pipeline worker started for camera {self.camera_id} at target {self.target_fps} FPS.")

    def stop(self):
        """Stops the worker thread cleanly."""
        self.is_running = False
        self.status = "PAUSED"
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.0)
        self.thread = None
        self.tracker.reset()
        self.latest_tracks.clear()
        logger.info(f"AI Pipeline worker stopped for camera {self.camera_id}.")

    def _worker_loop(self):
        """Continuous frame ingestion, detection, and tracking loop."""
        while self.is_running:
            loop_start = time.time()
            min_frame_interval = 1.0 / max(1.0, self.target_fps)
            
            streamer = stream_manager.get_streamer(self.camera_id)
            if not streamer or not getattr(streamer, "_running", False):
                self.status = "NO_STREAM"
                time.sleep(0.5)
                continue

            # Optimize CPU: skip redundant inference if camera streamer hasn't produced a new frame
            curr_count = getattr(streamer, "_frame_count", -1)
            if curr_count != -1 and curr_count == self._last_frame_count:
                time.sleep(0.01)
                continue

            frame = streamer.get_latest_frame()
            if frame is None:
                self.status = "NO_STREAM"
                time.sleep(0.2)
                continue

            self._last_frame_count = curr_count

            try:
                # 1. Execute YOLO Object Detection with camera-specific tuned thresholds
                det_start = time.time()
                detections = self.detector.detect(
                    frame,
                    camera_id=self.camera_id,
                    input_size=self.input_size,
                    thresholds=self.thresholds
                )

                # 1b. Modulate detection confidence based on observable camera quality (Phase 11)
                try:
                    from app.services.health.camera_quality_analyzer import camera_quality_analyzer
                    q_res = camera_quality_analyzer.analyze_frame(frame)
                    conf_mult = q_res.get("confidence_multiplier", 1.0)
                    if conf_mult < 0.99:
                        for d in detections:
                            if hasattr(d, 'confidence'):
                                d.confidence = round(d.confidence * conf_mult, 3)
                            elif isinstance(d, dict) and 'confidence' in d:
                                d['confidence'] = round(d['confidence'] * conf_mult, 3)
                except Exception as qe:
                    logger.debug(f"Quality modulation bypass on {self.camera_id}: {qe}")
                
                # 2. Update ByteTrack Multi-Frame Tracker
                active_tracks = self.tracker.update(detections)
                det_end = time.time()

                # 2b. Execute Virtual Perimeter & Behavioural Analytics (Phase 3)
                try:
                    from app.services.intelligence.zone_analyzer import zone_intelligence_service
                    h, w = frame.shape[:2]
                    zone_tracker = zone_intelligence_service.get_tracker(self.camera_id)
                    zone_tracker.analyze_tracks(active_tracks, frame_width=w, frame_height=h, frame=frame)
                except Exception as ze:
                    logger.error(f"Perimeter analysis error on {self.camera_id}: {ze}")

                # 2c. Execute ANPR & Face Analytics (Phase 4)
                try:
                    from app.services.anpr.anpr_service import anpr_service
                    from app.services.face.face_service import face_service

                    for trk in active_tracks:
                        if trk.category == "vehicle":
                            anpr_service.process_vehicle_track(self.camera_id, frame, trk)
                        elif trk.category == "person":
                            face_service.process_person_track(self.camera_id, frame, trk)
                except Exception as p4e:
                    logger.error(f"ANPR/Face processing error on {self.camera_id}: {p4e}")

                # 3. Calculate Latency & Performance Metrics
                self.latency_ms = round((det_end - det_start) * 1000.0, 1)
                self.frames_processed += 1
                self.latest_tracks = active_tracks
                self.status = "ACTIVE"
                self.error_message = None

                # Compute Object Counts
                people = sum(1 for t in active_tracks if t.category == "person")
                vehicles = sum(1 for t in active_tracks if t.category == "vehicle")
                animals = sum(1 for t in active_tracks if t.category == "animal")
                other = sum(1 for t in active_tracks if t.category not in ["person", "vehicle", "animal"])
                self.latest_counters = CameraAICounters(
                    people=people,
                    vehicles=vehicles,
                    animals=animals,
                    other=other,
                    total_tracks=len(active_tracks)
                )

                # Track Real Inference FPS
                self._fps_counter += 1
                now = time.time()
                elapsed = now - self._fps_window_start
                if elapsed >= 1.0:
                    self.inference_fps = round(self._fps_counter / elapsed, 1)
                    self._fps_counter = 0
                    self._fps_window_start = now

                # 4. Dispatch Telemetry to WebSocket Subscribers
                if self.broadcast_callback:
                    telemetry_payload = {
                        "event": "AI_DETECTION_TELEMETRY",
                        "camera_id": self.camera_id,
                        "timestamp": datetime.utcnow().isoformat(),
                        "status": self.status,
                        "inference_fps": self.inference_fps,
                        "latency_ms": self.latency_ms,
                        "counters": self.latest_counters.dict(),
                        "tracks": [t.to_dict() for t in active_tracks]
                    }
                    self.broadcast_callback(self.camera_id, telemetry_payload)

            except Exception as e:
                logger.error(f"Error in AI worker loop for {self.camera_id}: {e}", exc_info=True)
                self.status = "ERROR"
                self.error_message = str(e)

            # Throttle to target FPS
            elapsed_total = time.time() - loop_start
            sleep_time = max(0.005, min_frame_interval - elapsed_total)
            time.sleep(sleep_time)

    def get_status_schema(self) -> CameraAIStatus:
        return CameraAIStatus(
            camera_id=self.camera_id,
            status=self.status,
            inference_fps=self.inference_fps,
            latency_ms=self.latency_ms,
            frames_processed=self.frames_processed,
            frames_skipped=self.frames_skipped,
            active_tracks_count=len(self.latest_tracks),
            counters=self.latest_counters,
            device=self.detector.device_used,
            model_name=self.detector.model_name,
            error_message=self.error_message
        )

class AIPipelineManager:
    """
    Global AI Pipeline Manager.
    Orchestrates shared YOLO models, per-camera workers, WebSocket dispatching, and dynamic configuration.
    """
    def __init__(self):
        self.detector = YOLOObjectDetector(model_name=getattr(settings, "YOLO_MODEL_PATH", "yolov8n.pt"), device="auto")
        self.workers: Dict[str, CameraAIWorker] = {}
        self.ws_subscribers: Dict[str, List[Any]] = {} # camera_id -> list of websocket connections
        self._lock = threading.Lock()

    def register_camera(
        self,
        camera_id: str,
        target_fps: float = 10.0,
        auto_start: bool = True
    ) -> CameraAIWorker:
        """Registers a camera with the AI inference pipeline."""
        with self._lock:
            if camera_id in self.workers:
                return self.workers[camera_id]

            worker = CameraAIWorker(
                camera_id=camera_id,
                detector=self.detector,
                target_fps=target_fps,
                broadcast_callback=self._broadcast_telemetry
            )
            # Try to populate worker with saved database thresholds
            try:
                from app.database import SessionLocal
                from app.models.ai_config import CameraAIConfig
                with SessionLocal() as db:
                    cfg = db.query(CameraAIConfig).filter(CameraAIConfig.camera_id == camera_id).first()
                    if cfg:
                        worker.update_config(cfg)
            except Exception:
                pass

            self.workers[camera_id] = worker
            if auto_start and worker.status != "PAUSED":
                worker.start()
            return worker

    def update_camera_config(self, camera_id: str, config: Any):
        """Updates AI configuration for an active camera worker."""
        with self._lock:
            worker = self.workers.get(camera_id)
        if not worker:
            worker = self.register_camera(camera_id, auto_start=getattr(config, "enabled", True))
        if worker:
            worker.update_config(config)

    def unregister_camera(self, camera_id: str):
        """Unregisters and stops an AI camera worker."""
        with self._lock:
            worker = self.workers.pop(camera_id, None)
        if worker:
            worker.stop()

    def unregister_all(self):
        """Stops and unregisters all AI camera workers gracefully."""
        with self._lock:
            workers = list(self.workers.values())
            self.workers.clear()
            self.ws_subscribers.clear()

        logger.info(f"Stopping {len(workers)} active AI camera workers...")
        for worker in workers:
            try:
                worker.stop()
            except Exception as e:
                logger.error(f"Error stopping AI worker {worker.camera_id}: {e}")

    def shutdown(self):
        """Graceful shutdown alias for unregister_all."""
        self.unregister_all()

    def stop_all(self):
        """Stop all workers alias for unregister_all."""
        self.unregister_all()

    def ensure_worker_running(self, camera_id: str) -> Optional[CameraAIWorker]:
        """Ensures an AI worker is active for a camera if registered/enabled."""
        with self._lock:
            worker = self.workers.get(camera_id)
            if worker and worker.is_running:
                return worker
        return self.register_camera(camera_id, auto_start=True)

    def enable_camera(self, camera_id: str) -> bool:
        """Enables AI processing for a camera."""
        with self._lock:
            worker = self.workers.get(camera_id)
            if not worker:
                worker = self.register_camera(camera_id, auto_start=True)
                return True
            worker.start()
            return True

    def shutdown_all(self):
        """Stops all camera AI processing workers immediately."""
        with self._lock:
            workers = list(self.workers.values())
            self.workers.clear()
        for worker in workers:
            try:
                worker._running = False
            except Exception:
                pass

    def get_camera_status(self, camera_id: str) -> CameraAIStatus:
        """Returns the real-time AI status for a specific camera."""
        worker = self.workers.get(camera_id)
        if not worker:
            worker = self.ensure_worker_running(camera_id)
        if worker:
            return worker.get_status_schema()
        return CameraAIStatus(
            camera_id=camera_id,
            status="STARTING",
            counters=CameraAICounters(),
            device=self.detector.device_used,
            model_name=self.detector.model_name
        )

    def get_all_statuses(self) -> List[CameraAIStatus]:
        """Returns AI statuses for all registered cameras."""
        return [w.get_status_schema() for w in self.workers.values()]

    def get_camera_tracks(self, camera_id: str) -> List[Dict[str, Any]]:
        """Returns list of active tracked objects for a camera."""
        worker = self.workers.get(camera_id)
        if worker:
            return [t.to_dict() for t in worker.latest_tracks]
        return []

    def update_thresholds(self, thresholds: Dict[str, float]):
        """Updates class confidence thresholds globally."""
        self.detector.update_thresholds(thresholds)

    def register_ws_subscriber(self, camera_id: str, websocket_send_fn: Callable):
        """Registers a WebSocket connection to receive AI telemetry."""
        self.ensure_worker_running(camera_id)
        with self._lock:
            if camera_id not in self.ws_subscribers:
                self.ws_subscribers[camera_id] = []
            self.ws_subscribers[camera_id].append(websocket_send_fn)

    def unregister_ws_subscriber(self, camera_id: str, websocket_send_fn: Callable):
        """Unregisters a WebSocket subscriber."""
        with self._lock:
            if camera_id in self.ws_subscribers:
                try:
                    self.ws_subscribers[camera_id].remove(websocket_send_fn)
                except ValueError:
                    pass

    def _broadcast_telemetry(self, camera_id: str, payload: Dict[str, Any]):
        """Pushes telemetry payload to all active WebSocket listeners for this camera."""
        with self._lock:
            subscribers = list(self.ws_subscribers.get(camera_id, []))

        dead_subscribers = []
        for send_fn in subscribers:
            try:
                send_fn(payload)
            except Exception:
                dead_subscribers.append(send_fn)

        if dead_subscribers:
            with self._lock:
                for dead in dead_subscribers:
                    try:
                        if dead in self.ws_subscribers.get(camera_id, []):
                            self.ws_subscribers[camera_id].remove(dead)
                    except (ValueError, KeyError):
                        pass

# Global Singleton Instance
ai_pipeline_manager = AIPipelineManager()
