import time
import uuid
import asyncio
import json
import logging
from datetime import datetime
from typing import List, Optional, Set
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
        self._loop: Optional[asyncio.AbstractEventLoop] = None
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
        msg_text = json.dumps(payload, default=str)
        for ws in self._ws_subscribers:
            try:
                await ws.send_text(msg_text)
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

                    # Grace period: newly registered cameras (< 60s old) should stay CONNECTING
                    # rather than immediately flip to OFFLINE on first connection attempt failure
                    if new_status == "OFFLINE" and cam.created_at:
                        age_seconds = (datetime.utcnow() - cam.created_at).total_seconds()
                        if age_seconds < 60:
                            new_status = "CONNECTING"

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
                    event = None
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

                    # Immediate WebSocket broadcast to all connected clients
                    try:
                        all_cams = db.query(Camera).all()
                        status_list = [
                            {
                                "camera_id": c.camera_id,
                                "name": c.camera_name,
                                "bop_site": c.bop_site,
                                "status": "ONLINE" if c.status in ("HEALTHY", "ONLINE") else c.status,
                                "fps": round(c.fps or 0.0, 1),
                                "resolution": c.resolution or "1920x1080",
                                "last_seen": c.last_seen_at.isoformat() if c.last_seen_at else None,
                                "priority": c.priority
                            }
                            for c in all_cams
                        ]
                        payload = {
                            "type": "HEALTH_UPDATE",
                            "timestamp": datetime.utcnow().isoformat(),
                            "camera_id": camera_id,
                            "new_status": new_status,
                            "cameras": status_list
                        }
                        if self._loop and self._loop.is_running():
                            asyncio.run_coroutine_threadsafe(self.broadcast_health_update(payload), self._loop)
                    except Exception as berr:
                        logger.debug(f"Immediate health broadcast notice: {berr}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to record status transition for {camera_id}: {e}")

    async def start(self):
        """Starts periodic health audit task."""
        if self._running:
            return
        self._running = True
        try:
            self._loop = asyncio.get_running_loop()
        except Exception:
            pass
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info("Health Monitor service started.")


    async def stop(self):
        """Stops periodic health audit task."""
        self._running = False
        if self._task:
            self._task.cancel()
        logger.info("Health Monitor service stopped.")

    async def _monitor_loop(self):
        """Periodic audit loop checking frame staleness and database sync without blocking event loop."""
        while self._running:
            try:
                all_statuses = await asyncio.to_thread(self._sync_audit_cameras)
                if self._ws_subscribers and all_statuses:
                    await self.broadcast_health_update({
                        "event": "HEALTH_AUDIT",
                        "timestamp": datetime.utcnow().isoformat(),
                        "cameras": all_statuses
                    })
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health monitor loop error: {e}")

            interval = max(10.0, float(getattr(settings, "HEALTH_CHECK_INTERVAL_SEC", 15.0)))
            await asyncio.sleep(interval)

    def _sync_audit_cameras(self) -> list:
        """Audits all configured cameras against live stream state in a background worker thread."""
        db = SessionLocal()
        all_statuses = []
        try:
            from app.services.health.system_health_service import system_health_service
            try:
                system_health_service.evaluate_maintenance_expirations()
            except Exception:
                pass

            cameras = db.query(Camera).all()
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
                            password=decrypted_pw,
                            stream_type=cam.stream_type or "main"
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
                            try:
                                q_metrics = camera_quality_analyzer.analyze_frame(frame)
                                cam.image_quality_score = q_metrics["image_quality_score"]
                                cam.tampering_detected = q_metrics["tampering_detected"]
                            except Exception:
                                pass

                    all_statuses.append({
                        "camera_id": cam.camera_id,
                        "camera_name": cam.camera_name,
                        "bop_site": cam.bop_site,
                        "status": "ONLINE" if cam.status in ("HEALTHY", "ONLINE") else cam.status,
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
                    all_statuses.append({
                        "camera_id": cam.camera_id,
                        "camera_name": cam.camera_name,
                        "bop_site": cam.bop_site,
                        "status": "OFFLINE",
                        "priority": cam.priority or "NORMAL",
                        "fps": 0.0,
                        "resolution": cam.resolution,
                        "quality_score": 0.0,
                        "tampering_detected": False,
                        "last_seen_at": cam.last_seen_at.isoformat() if cam.last_seen_at else None,
                        "enabled": False
                    })

            db.commit()
            return all_statuses

        except Exception as e:
            logger.error(f"Error auditing cameras: {e}")
            return all_statuses
        finally:
            db.close()

health_monitor = HealthMonitor()
