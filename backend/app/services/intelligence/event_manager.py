import json
import uuid
import logging
import threading
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.security_event import SecurityEvent
from app.models.audit_log import SecurityAuditLog
from app.schemas.security_event import SecurityEventResponse, RiskFactor, EventTimelineEntry
from app.services.intelligence.risk_engine import risk_engine

logger = logging.getLogger("ibvap.intelligence.events")

class SecurityEventManager:
    """
    Centralized Security Event Bus & Deduplication Manager.
    Records confirmed security incidents, manages lifecycle state transitions,
    and broadcasts events in real time to connected WebSocket dashboards.
    """
    def __init__(self):
        self._lock = threading.RLock()
        # Cooldown map: (camera_id, zone_id, track_id, event_type) -> (event_id, timestamp)
        self._active_incident_map: Dict[str, Dict[str, Any]] = {}
        self.ws_subscribers: List[Callable] = []

    def register_ws_client(self, send_fn: Callable):
        with self._lock:
            if send_fn not in self.ws_subscribers:
                self.ws_subscribers.append(send_fn)

    def unregister_ws_client(self, send_fn: Callable):
        with self._lock:
            if send_fn in self.ws_subscribers:
                self.ws_subscribers.remove(send_fn)

    def dispatch_security_event(
        self,
        camera_id: str,
        track_id: int,
        object_type: str,
        event_type: str,
        zone_id: Optional[str] = None,
        zone_name: Optional[str] = None,
        zone_type: str = "RESTRICTED",
        is_night: bool = False,
        is_forbidden_direction: bool = False,
        is_loitering: bool = False,
        is_stationary_vehicle: bool = False,
        is_group: bool = False,
        is_rapid_movement: bool = False,
        confidence: float = 0.90,
        bbox: Optional[Dict[str, float]] = None,
        direction: Optional[str] = None,
        speed: float = 0.0,
        timeline_message: Optional[str] = None
    ) -> Optional[SecurityEvent]:
        """
        Creates or updates a security event with risk score calculation,
        temporal deduplication, and real-time WebSocket distribution.
        """
        key = f"{camera_id}:{zone_id or 'none'}:{track_id}:{event_type}"
        now = datetime.utcnow()

        # Calculate Risk Score & Breakdown
        risk_score, risk_level, factors = risk_engine.calculate_risk(
            event_type=event_type,
            zone_type=zone_type,
            is_night=is_night,
            is_forbidden_direction=is_forbidden_direction,
            is_loitering=is_loitering,
            is_stationary_vehicle=is_stationary_vehicle,
            is_group=is_group,
            is_rapid_movement=is_rapid_movement,
            detection_confidence=confidence
        )

        db: Session = SessionLocal()
        try:
            with self._lock:
                existing_entry = self._active_incident_map.get(key)
                
                # Check for active event to update timeline and avoid duplicate rows
                if existing_entry:
                    event_id = existing_entry["event_id"]
                    event_record = db.query(SecurityEvent).filter(SecurityEvent.event_id == event_id).first()
                    
                    if event_record and event_record.status in ["ACTIVE", "DETECTED", "CONFIRMED"]:
                        # Append timeline entry
                        timeline = json.loads(event_record.timeline_json or '[]')
                        if timeline_message:
                            timeline.append({
                                "timestamp": now.strftime("%H:%M:%S"),
                                "message": timeline_message
                            })
                            event_record.timeline_json = json.dumps(timeline[-20:]) # Keep last 20 entries

                        event_record.risk_score = max(event_record.risk_score, risk_score)
                        event_record.risk_level = risk_level
                        event_record.factors_json = json.dumps(factors)
                        event_record.last_bbox_json = json.dumps(bbox) if bbox else None
                        event_record.last_direction = direction
                        event_record.last_speed = speed
                        event_record.last_updated_at = now
                        db.commit()
                        db.refresh(event_record)

                        # Broadcast update
                        self._broadcast_event("SECURITY_EVENT_UPDATED", event_record)
                        return event_record

                # Otherwise create a brand new security event
                new_event_id = f"EVT-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
                
                initial_timeline = [
                    {
                        "timestamp": now.strftime("%H:%M:%S"),
                        "message": timeline_message or f"{object_type.capitalize()} #{track_id} triggered {event_type.replace('_', ' ').title()}"
                    }
                ]

                event_record = SecurityEvent(
                    event_id=new_event_id,
                    camera_id=camera_id,
                    zone_id=zone_id,
                    zone_name=zone_name,
                    track_id=track_id,
                    object_type=object_type,
                    event_type=event_type,
                    severity="CRITICAL" if risk_level == "CRITICAL" else "HIGH" if risk_level == "HIGH" else "MEDIUM",
                    risk_score=risk_score,
                    risk_level=risk_level,
                    status="ACTIVE",
                    environment="NIGHT" if is_night else "DAY",
                    factors_json=json.dumps(factors),
                    timeline_json=json.dumps(initial_timeline),
                    last_bbox_json=json.dumps(bbox) if bbox else None,
                    last_direction=direction,
                    last_speed=speed,
                    started_at=now,
                    last_updated_at=now
                )

                db.add(event_record)
                db.commit()
                db.refresh(event_record)

                self._active_incident_map[key] = {
                    "event_id": new_event_id,
                    "created_at": now
                }

                logger.info(f"Generated {event_type} on {camera_id} (Track #{track_id}, Risk: {risk_score} {risk_level})")
                self._broadcast_event("NEW_SECURITY_EVENT", event_record)

                # Feed to Phase 6 Alert Engine
                try:
                    from app.services.alert.alert_engine import alert_engine
                    alert_engine.process_security_event(event_record)
                except Exception as alert_err:
                    logger.warning(f"Alert engine notification notice: {alert_err}")

                return event_record

        except Exception as e:
            logger.error(f"Failed to persist security event: {e}", exc_info=True)
            return None
        finally:
            db.close()

    def _broadcast_event(self, event_name: str, event_record: SecurityEvent):
        """Pushes structured security event payload to connected WebSockets."""
        payload = {
            "event": event_name,
            "data": {
                "id": event_record.id,
                "event_id": event_record.event_id,
                "camera_id": event_record.camera_id,
                "zone_id": event_record.zone_id,
                "zone_name": event_record.zone_name,
                "track_id": event_record.track_id,
                "object_type": event_record.object_type,
                "event_type": event_record.event_type,
                "severity": event_record.severity,
                "risk_score": event_record.risk_score,
                "risk_level": event_record.risk_level,
                "status": event_record.status,
                "environment": event_record.environment,
                "factors": json.loads(event_record.factors_json or '[]'),
                "timeline": json.loads(event_record.timeline_json or '[]'),
                "last_direction": event_record.last_direction,
                "last_speed": event_record.last_speed,
                "started_at": event_record.started_at.isoformat(),
                "last_updated_at": event_record.last_updated_at.isoformat()
            }
        }

        with self._lock:
            subscribers = list(self.ws_subscribers)

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
                        if dead in self.ws_subscribers:
                            self.ws_subscribers.remove(dead)
                    except ValueError:
                        pass

    def broadcast_sync_event(self, payload: dict):
        """Broadcasts external/sync event payload directly to WebSockets."""
        with self._lock:
            subscribers = list(self.ws_subscribers)

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
                        if dead in self.ws_subscribers:
                            self.ws_subscribers.remove(dead)
                    except ValueError:
                        pass

# Global Singleton
security_event_manager = SecurityEventManager()
