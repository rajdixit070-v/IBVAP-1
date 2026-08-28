import time
import uuid
import asyncio
import logging
from datetime import datetime
from typing import List, Set
from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.camera import Camera
from app.models.health_log import CameraHealthLog
from app.models.health_models import HealthEvent
from app.core.security import decrypt_credential
from app.services.stream_manager import stream_manager
from app.services.health.camera_quality_analyzer import camera_quality_analyzer

logger = logging.getLogger("ibvap.health_monitor")

class HealthMonitor:
    """
    Continuous background monitor ensuring camera health,
    detecting stalled streams, persisting diagnostic logs,
    evaluating optical quality and tampering, and pushing real-time health events.
    """
    def __init__(self):
        self._running = False
        self._task: asyncio.Task = None
        self._ws_subscribers: Set[WebSocket] = set()
        self._interruption_tracker = {} # camera_id -> started_at

        # Register listener with stream manager
        stream_manager.register_status_listener(self._handle_status_transition)

    def register_ws_client(self, websocket: WebSocket):
        """Adds a connected WebSocket client to receive health updates."""
        self._ws_subscribers.add(websocket)

    def unregister_ws_client(self, websocket: WebSocket):
        """Removes a disconnected WebSocket client."""
        self._ws_subscribers.discard(websocket)

    async def broadcast_health_update(self, payload: dict):
        """Broadcasts JSON health payload to all connected clients."""
        dead_sockets = []
        for ws in self._ws_subscribers:
            try:
                await ws.send_json(payload)
            except Exception:
                dead_sockets.append(ws)
        for dead in dead_sockets:
            self._ws_subscribers.discard(dead)

    def _handle_status_transition(self, camera_id: str, new_status: str, meta: dict):
        """Logs status transition events to database and health events."""
        try:
            db = SessionLocal()
            try:
                cam = db.query(Camera).filter(Camera.camera_id == camera_id).first()
                if cam:
                    if cam.is_maintenance:
                        # Suppress failure transitions during authorized maintenance
                        cam.status = "MAINTENANCE"
                        db.commit()
                        return

                    old_status = cam.status
                    cam.status = new_status
                    if meta.get("fps"):
                        cam.fps = meta.get("fps")
                    if meta.get("resolution"):
                        cam.resolution = meta.get("resolution")
                    if new_status in ["HEALTHY", "ONLINE"]:
                        cam.last_seen_at = datetime.utcnow()

                    # Create diagnostic log
                    log_entry = CameraHealthLog(
                        camera_id=camera_id,
                        event_type="STATUS_CHANGE",
                        status=new_status,
                        details=meta.get("error") or f"State transitioned from {old_status} to {new_status}",
                        fps=meta.get("fps", 0.0),
                        timestamp=datetime.utcnow()
                    )
                    db.add(log_entry)

                    # Interruption tracking
                    now = datetime.utcnow()
                    if new_status in ["OFFLINE", "DEGRADED", "ERROR"]:
                        if camera_id not in self._interruption_tracker:
                            self._interruption_tracker[camera_id] = now
                            event = HealthEvent(
                                event_id=f"HLT-{now.strftime('%Y%m%d%H%M%S')}-{camera_id[:8]}-OFF-{uuid.uuid4().hex[:4].upper()}",
                                event_type="STREAM_INTERRUPTION" if new_status == "DEGRADED" else "CAMERA_OFFLINE",
                                source_type="CAMERA",
                                source_id=camera_id,
                                severity="HIGH" if cam.priority == "CRITICAL" else "MEDIUM",
                                status="DETECTED",
                                title=f"Stream Interruption: {camera_id}",
                                description=f"Camera {camera_id} transitioned to {new_status}: {meta.get('error', 'Signal lost')}",
                                started_at=now,
                                detected_at=now
                            )
                            db.add(event)
                    elif new_status in ["HEALTHY", "ONLINE"]:
                        if camera_id in self._interruption_tracker:
                            started = self._interruption_tracker.pop(camera_id)
                            downtime = (now - started).total_seconds()
                            event = HealthEvent(
                                event_id=f"HLT-{now.strftime('%Y%m%d%H%M%S')}-{camera_id[:8]}-REC-{uuid.uuid4().hex[:4].upper()}",
                                event_type="CAMERA_RECOVERED",
                                source_type="CAMERA",
                                source_id=camera_id,
                                severity="LOW",
                                status="RECOVERED",
                                title=f"Stream Recovered: {camera_id}",
                                description=f"Camera {camera_id} returned to service after {downtime:.1f}s interruption.",
                                started_at=started,
                                detected_at=started,
                                recovered_at=now,
                                downtime_seconds=downtime
                            )
                            db.add(event)

                    db.commit()

                    # Trigger system-health alert
                    if event:
                        try:
                            from app.services.alert.alert_engine import alert_engine
                            alert_engine.process_health_event(event)
                        except Exception as aerr:
                            logger.warning(f"Health alert generation notice: {aerr}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to record status transition for {camera_id}: {e}")

    async def start(self):
        """Starts periodic health audit task."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info("Health Monitor service started.")

    async def stop(self):
        """Stops periodic health audit task."""
        self._running = False
        if self._task:
            self._task.cancel()
        logger.info("Health Monitor service stopped.")

    async def _monitor_loop(self):
        """Periodic audit loop checking frame staleness and database sync."""
        while self._running:
            try:
                await self._audit_cameras()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health monitor loop error: {e}")

            await asyncio.sleep(settings.HEALTH_CHECK_INTERVAL_SEC)

    async def _audit_cameras(self):
        """Audits all configured cameras against live stream state and evaluates quality."""
        db = SessionLocal()
        try:
            from app.services.health.system_health_service import system_health_service
            system_health_service.evaluate_maintenance_expirations()

            cameras = db.query(Camera).all()
            all_statuses = []
            now = time.time()

            for cam in cameras:
                if cam.is_maintenance:
                    cam.status = "MAINTENANCE"
                    continue

                if cam.enabled:
                    streamer = stream_manager.get_streamer(cam.camera_id)
                    
                    # If camera enabled but not active in stream manager, start it
                    if not streamer:
                        decrypted_pw = decrypt_credential(cam.encrypted_password)
                        streamer = stream_manager.start_camera(
                            camera_id=cam.camera_id,
                            camera_name=cam.camera_name,
                            bop_site=cam.bop_site,
                            rtsp_url=cam.rtsp_url,
                            username=cam.username,
                            password=decrypted_pw
                        )

                    # Check for frame timeout
                    if streamer and streamer._running:
                        last_frame_t = streamer._latest_frame_time
                        if last_frame_t and (now - last_frame_t) > settings.RTSP_FRAME_TIMEOUT_SEC:
                            if streamer.status == "HEALTHY":
                                streamer._update_status("DEGRADED", f"No frames received for {now - last_frame_t:.1f}s")

                        # Sync back to DB entity
                        cam.status = streamer.status
                        cam.fps = streamer.fps
                        if streamer.resolution:
                            cam.resolution = streamer.resolution
                        if streamer.last_seen_at:
                            cam.last_seen_at = streamer.last_seen_at

                        # Analyze optical quality & tampering on latest frame
                        frame = streamer.get_latest_frame()
                        if frame is not None:
                            q_metrics = camera_quality_analyzer.analyze_frame(frame)
                            cam.image_quality_score = q_metrics["image_quality_score"]
                            cam.tampering_detected = q_metrics["tampering_detected"]

                    all_statuses.append({
                        "camera_id": cam.camera_id,
                        "camera_name": cam.camera_name,
                        "bop_site": cam.bop_site,
                        "status": cam.status,
                        "priority": cam.priority or "NORMAL",
                        "fps": round(cam.fps, 1),
                        "resolution": cam.resolution,
                        "quality_score": cam.image_quality_score or 88.0,
                        "tampering_detected": cam.tampering_detected or False,
                        "last_seen_at": cam.last_seen_at.isoformat() if cam.last_seen_at else None,
                        "enabled": cam.enabled
                    })
                else:
                    stream_manager.stop_camera(cam.camera_id)
                    cam.status = "OFFLINE"
                    cam.fps = 0.0

            db.commit()

            # Broadcast updated statuses to WebSocket clients
            if self._ws_subscribers:
                await self.broadcast_health_update({
                    "event": "HEALTH_AUDIT",
                    "timestamp": datetime.utcnow().isoformat(),
                    "cameras": all_statuses
                })

        except Exception as e:
            logger.error(f"Error auditing cameras: {e}")
        finally:
            db.close()

health_monitor = HealthMonitor()
