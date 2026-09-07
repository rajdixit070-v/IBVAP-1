import time
import logging
import asyncio
import threading
from typing import Dict, Optional, List, Callable
import numpy as np

from app.services.rtsp_streamer import RTSPStreamer

logger = logging.getLogger("ibvap.stream_manager")

class StreamManager:
    """
    Global coordinator for all active camera video ingestion streamers.
    Provides thread-safe access to latest video frames, MJPEG generation,
    and real-time status dispatching.
    """
    _instance: Optional['StreamManager'] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(StreamManager, cls).__new__(cls)
            cls._instance._streamers: Dict[str, RTSPStreamer] = {}
            cls._instance._status_listeners: List[Callable[[str, str, dict], None]] = []
            cls._instance._lock = threading.Lock()
        return cls._instance

    def register_status_listener(self, callback: Callable[[str, str, dict], None]):
        """Registers a callback for camera health/status transitions."""
        with self._lock:
            if callback not in self._status_listeners:
                self._status_listeners.append(callback)

    def _on_camera_status_change(self, camera_id: str, new_status: str, meta: dict):
        """Dispatches status updates to all registered listeners."""
        with self._lock:
            listeners = list(self._status_listeners)
        for listener in listeners:
            try:
                listener(camera_id, new_status, meta)
            except Exception as e:
                logger.error(f"Listener execution error: {e}")

    def start_camera(
        self,
        camera_id: str,
        camera_name: str,
        bop_site: str,
        rtsp_url: str,
        username: Optional[str] = None,
        password: Optional[str] = None
    ) -> RTSPStreamer:
        """Starts video ingestion for a given camera with thread-safe duplicate protection."""
        old_streamer = None
        with self._lock:
            if camera_id in self._streamers:
                streamer = self._streamers[camera_id]
                # Check if URL/credentials changed
                if (streamer.base_rtsp_url != rtsp_url or 
                    streamer.username != username or 
                    streamer.password != password):
                    logger.info(f"[{camera_id}] Updating stream configuration...")
                    old_streamer = self._streamers.pop(camera_id, None)
                else:
                    if not streamer._running:
                        streamer.start()
                    return streamer

        if old_streamer:
            try:
                old_streamer.stop()
            except Exception as e:
                logger.debug(f"Error stopping old streamer: {e}")

        streamer = RTSPStreamer(
            camera_id=camera_id,
            camera_name=camera_name,
            bop_site=bop_site,
            rtsp_url=rtsp_url,
            username=username,
            password=password,
            on_status_change=self._on_camera_status_change
        )
        with self._lock:
            self._streamers[camera_id] = streamer
        streamer.start()
        return streamer

    def stop_camera(self, camera_id: str):
        """Stops and removes an active streamer."""
        with self._lock:
            streamer = self._streamers.pop(camera_id, None)
        if streamer:
            streamer.stop()

    def ensure_camera_running(self, camera_id: str) -> Optional[RTSPStreamer]:
        """
        Ensures a camera streamer is actively running in memory.
        If not running and camera is enabled in database, starts it immediately.
        """
        streamer = self.get_streamer(camera_id)
        if streamer and getattr(streamer, "_running", False):
            return streamer

        try:
            from app.database import SessionLocal
            from app.models.camera import Camera
            from app.core.security import decrypt_credential

            db = SessionLocal()
            try:
                cam = db.query(Camera).filter(Camera.camera_id == camera_id).first()
                if cam and cam.enabled:
                    decrypted_pw = decrypt_credential(cam.encrypted_password) if cam.encrypted_password else None
                    return self.start_camera(
                        camera_id=cam.camera_id,
                        camera_name=cam.camera_name,
                        bop_site=cam.bop_site,
                        rtsp_url=cam.rtsp_url,
                        username=cam.username,
                        password=decrypted_pw
                    )
            finally:
                db.close()
        except Exception as e:
            logger.debug(f"Could not auto-start camera {camera_id}: {e}")
        return streamer

    def get_streamer(self, camera_id: str) -> Optional[RTSPStreamer]:
        """Retrieves active streamer instance for a camera."""
        with self._lock:
            return self._streamers.get(camera_id)

    def get_latest_frame(self, camera_id: str) -> Optional[np.ndarray]:
        """Retrieves raw BGR frame from buffer."""
        streamer = self.ensure_camera_running(camera_id)
        if streamer:
            return streamer.get_latest_frame()
        return None

    def get_latest_jpeg(self, camera_id: str) -> Optional[bytes]:
        """Retrieves pre-encoded JPEG bytes from buffer."""
        streamer = self.ensure_camera_running(camera_id)
        if streamer:
            return streamer.get_latest_jpeg()
        return None

    def get_status(self, camera_id: str) -> Optional[dict]:
        """Returns health & stream metrics for a specific camera."""
        streamer = self.ensure_camera_running(camera_id)
        if streamer:
            return streamer.get_status_info()
        return None

    def get_all_statuses(self) -> Dict[str, dict]:
        """Returns status dictionary for all active cameras."""
        with self._lock:
            streamers_snapshot = list(self._streamers.items())
        return {cam_id: s.get_status_info() for cam_id, s in streamers_snapshot}

    def _get_offline_placeholder_jpeg(self, camera_id: str) -> bytes:
        """Generates dynamic dark tactical placeholder JPEG with timestamp for offline stream."""
        import cv2
        from datetime import datetime
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame[:] = (15, 20, 25) # Dark tactical slate
        
        # Grid lines
        for y in range(0, 480, 60):
            cv2.line(frame, (0, y), (640, y), (30, 35, 42), 1)
        for x in range(0, 640, 80):
            cv2.line(frame, (x, 0), (x, 480), (30, 35, 42), 1)

        # Top HUD bar
        cv2.rectangle(frame, (0, 0), (640, 40), (10, 14, 18), -1)
        cv2.putText(frame, f"IBVAP CCTV // NODE: {camera_id}", (15, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (220, 225, 235), 1)
        timestamp_str = datetime.now().strftime("%d-%b-%Y %H:%M:%S")
        cv2.putText(frame, timestamp_str, (430, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 210, 255), 1)
            
        cv2.rectangle(frame, (120, 170), (520, 310), (22, 28, 36), -1)
        cv2.rectangle(frame, (120, 170), (520, 310), (50, 60, 75), 1)
        
        cv2.putText(frame, "STANDBY / CONNECTING", (170, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (80, 140, 255), 2)
        cv2.putText(frame, f"Awaiting Video Stream Signal...", (185, 255), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 170, 185), 1)
        cv2.putText(frame, "Auto-Reconnecting Ingestion Engine Active", (155, 285), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 190, 130), 1)

        # Bottom HUD bar
        cv2.rectangle(frame, (0, 450), (640, 480), (10, 14, 18), -1)
        cv2.putText(frame, "STATUS: SEARCHING PROTOCOL // RTSP • WEBCAM • HTTP • UDP", (15, 470), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (120, 135, 150), 1)
        
        _, jpeg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
        return jpeg.tobytes()

    async def generate_mjpeg_stream(self, camera_id: str, fps_limit: float = 25.0):
        """
        Asynchronous generator emitting multipart MJPEG frame chunks.
        Used for native browser <img> or <video> live preview.
        When camera is offline, emits clean status placeholder.
        """
        frame_interval = 1.0 / max(1.0, fps_limit)
        self.ensure_camera_running(camera_id)
        
        while True:
            streamer = self.get_streamer(camera_id)
            if not streamer or not getattr(streamer, "_running", False):
                streamer = self.ensure_camera_running(camera_id)

            if not streamer or not getattr(streamer, "_running", False) or streamer.status == "OFFLINE":
                offline_jpeg = self._get_offline_placeholder_jpeg(camera_id)
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(offline_jpeg)).encode('utf-8') + b"\r\n\r\n" +
                    offline_jpeg + b"\r\n"
                )
                await asyncio.sleep(0.08)
                continue

            jpeg_bytes = streamer.get_latest_jpeg()
            if jpeg_bytes:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(jpeg_bytes)).encode('utf-8') + b"\r\n\r\n" +
                    jpeg_bytes + b"\r\n"
                )
            else:
                offline_jpeg = self._get_offline_placeholder_jpeg(camera_id)
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(offline_jpeg)).encode('utf-8') + b"\r\n\r\n" +
                    offline_jpeg + b"\r\n"
                )
                await asyncio.sleep(0.05)
                continue
            await asyncio.sleep(frame_interval)


    def shutdown_all(self):
        """Gracefully shuts down all camera streamers on application exit."""
        with self._lock:
            streamers = list(self._streamers.values())
            self._streamers.clear()
        
        logger.info(f"Shutting down {len(streamers)} active camera streamers...")
        for streamer in streamers:
            try:
                streamer.stop()
            except Exception as e:
                logger.error(f"Error stopping streamer {streamer.camera_id}: {e}")

stream_manager = StreamManager()
