import uuid
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.alert import Alert
from app.models.notification import Notification
from app.models.audit_log import SecurityAuditLog
from app.models.security_event import SecurityEvent
from app.models.health_models import HealthEvent

logger = logging.getLogger("ibvap.alert.engine")

class AlertEngine:
    """
    Central Alert Engine: Deduplication, SLA Deadlines, Escalations, Health Integration, and Live WebSocket Broadcasts.
    """
    def __init__(self):
        self._lock = threading.RLock()
        # Active track cooldown: (camera_id, track_id, event_type) -> alert_id
        self._active_alert_map: Dict[str, str] = {}
        self._ws_subscribers: List[Callable[[dict], None]] = []

    def register_ws_client(self, callback: Callable[[dict], None]):
        """Registers a thread-safe callback for live alert WebSocket streaming."""
        with self._lock:
            if callback not in self._ws_subscribers:
                self._ws_subscribers.append(callback)

    def unregister_ws_client(self, callback: Callable[[dict], None]):
        """Unregisters a WebSocket subscriber callback."""
        with self._lock:
            if callback in self._ws_subscribers:
                self._ws_subscribers.remove(callback)

    def _broadcast_alert(self, event_name: str, alert: Alert):
        """Pushes structured alert payloads to all registered WebSocket clients."""
        with self._lock:
            subscribers = list(self._ws_subscribers)

        evd_url = None
        evd_id = None
        if alert.event_id:
            try:
                db_sub = SessionLocal()
                try:
                    se = db_sub.query(SecurityEvent).filter(SecurityEvent.event_id == alert.event_id).first()
                    if se and se.evidence_id:
                        evd_id = se.evidence_id
                        evd_url = f"/api/v1/evidence/{se.evidence_id}/file"
                finally:
                    db_sub.close()
            except Exception:
                pass

        payload = {
            "type": "alert.event",
            "event": event_name,
            "data": {
                "id": alert.id,
                "alert_id": alert.alert_id,
                "event_id": alert.event_id,
                "camera_id": alert.camera_id,
                "bop_site": alert.bop_site,
                "title": alert.title,
                "priority": alert.priority,
                "risk_score": alert.risk_score,
                "status": alert.status,
                "assigned_to": alert.assigned_to,
                "is_escalated": alert.is_escalated,
                "evidence_id": evd_id,
                "evidence_url": evd_url,
                "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
                "acknowledged_by": alert.acknowledged_by,
                "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
                "resolved_by": alert.resolved_by,
                "resolution_notes": alert.resolution_notes,
                "escalation_deadline": alert.escalation_deadline.isoformat() if alert.escalation_deadline else None,
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
                "updated_at": alert.updated_at.isoformat() if alert.updated_at else None
            }
        }

        for sub in subscribers:
            try:
                sub(payload)
            except Exception as e:
                logger.debug(f"Failed to dispatch alert WebSocket message: {e}")

    def process_security_event(self, event: SecurityEvent) -> Optional[Alert]:
        """
        Evaluates incoming security events and creates or updates an active alert.
        Deduplicates continuing tracks to prevent notification spam.
        """
        db: Session = SessionLocal()
        try:
            # Map severity to priority
            priority = event.risk_level.upper()
            if priority not in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
                priority = "HIGH" if event.risk_score >= 60 else "MEDIUM"

            # Deduplication key for continuing tracks
            dedup_key = f"{event.camera_id}:{event.track_id}:{event.event_type}"
            now = datetime.utcnow()

            with self._lock:
                existing_alert_id = self._active_alert_map.get(dedup_key)
                if existing_alert_id:
                    # Update existing active alert
                    alert = db.query(Alert).filter(Alert.alert_id == existing_alert_id).first()
                    if alert and alert.status in ["NEW", "ACKNOWLEDGED", "ESCALATED"]:
                        alert.risk_score = max(alert.risk_score, event.risk_score)
                        alert.updated_at = now
                        db.commit()
                        db.refresh(alert)
                        self._broadcast_alert("ALERT_UPDATED", alert)
                        return alert

                # SLA Deadline configuration
                if priority == "CRITICAL":
                    deadline = now + timedelta(seconds=120)
                elif priority == "HIGH":
                    deadline = now + timedelta(seconds=300)
                else:
                    deadline = now + timedelta(seconds=600)

                # Generate new Alert
                new_alert_id = f"ALT-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                title = f"{priority} Threat: {event.event_type.replace('_', ' ').title()} on {event.camera_id}"
                
                alert = Alert(
                    alert_id=new_alert_id,
                    event_id=event.event_id,
                    camera_id=event.camera_id,
                    bop_site="BOP Alpha",
                    title=title,
                    priority=priority,
                    risk_score=event.risk_score,
                    status="NEW",
                    escalation_deadline=deadline,
                    created_at=now,
                    updated_at=now
                )
                db.add(alert)

                # In-app notification with forensic evidence proof & precise location
                evd_id = getattr(event, 'evidence_id', None)
                evd_url = f"/api/v1/evidence/{evd_id}/file" if evd_id else None

                # Query camera for precise outpost / GPS location
                from app.models.camera import Camera
                cam = db.query(Camera).filter(Camera.camera_id == event.camera_id).first()
                loc_desc = getattr(event, 'location_description', None)
                if not loc_desc and cam:
                    coords = f"(GPS: {cam.latitude:.4f}, {cam.longitude:.4f})" if cam.latitude and cam.longitude else ""
                    loc_desc = f"{cam.bop_site} // {cam.sector} // {cam.camera_name} {coords}".strip()
                if not loc_desc:
                    loc_desc = f"Perimeter Outpost // {event.camera_id}"

                notification = Notification(
                    alert_id=new_alert_id,
                    title=title,
                    message=f"Target {event.object_type.upper()} #{event.track_id} detected at {loc_desc} in zone '{event.zone_name or 'Border Sector'}'. Risk: {event.risk_score}/100.",
                    priority=priority,
                    read=False,
                    camera_id=event.camera_id,
                    location_description=loc_desc,
                    evidence_id=evd_id,
                    evidence_url=evd_url,
                    created_at=now
                )
                db.add(notification)

                db.commit()
                db.refresh(alert)

                self._active_alert_map[dedup_key] = new_alert_id
                logger.info(f"Generated Alert {new_alert_id} ({priority}) for Event {event.event_id}")
                self._broadcast_alert("ALERT_CREATED", alert)

                # Connect to Incident pipeline for CRITICAL and HIGH priority alerts
                if priority in ["CRITICAL", "HIGH"] or event.risk_score >= 60:
                    try:
                        from app.services.incident.incident_service import incident_service
                        incident_service.create_incident_from_event(event)
                    except Exception as inc_err:
                        logger.warning(f"Incident auto-creation notice for alert {new_alert_id}: {inc_err}")

                return alert

        except Exception as e:
            logger.error(f"Failed to process alert for event {event.event_id}: {e}", exc_info=True)
            return None
        finally:
            db.close()

    def process_health_event(self, health_event: HealthEvent) -> Optional[Alert]:
        """
        Creates or resolves system-health alerts for camera offline / interruption / recovery.
        """
        db: Session = SessionLocal()
        try:
            now = datetime.utcnow()
            camera_id = health_event.source_id
            dedup_key = f"{camera_id}:HEALTH:OFFLINE"

            with self._lock:
                if health_event.event_type == "CAMERA_RECOVERED":
                    # Resolve any active offline alert for this camera
                    active_alert_id = self._active_alert_map.pop(dedup_key, None)
                    if active_alert_id:
                        alert = db.query(Alert).filter(Alert.alert_id == active_alert_id).first()
                        if alert and alert.status in ["NEW", "ACKNOWLEDGED", "ESCALATED"]:
                            alert.status = "RESOLVED"
                            alert.resolved_at = now
                            alert.resolved_by = "system"
                            alert.resolution_notes = f"Camera {camera_id} signal restored and verified online."
                            alert.updated_at = now
                            db.commit()
                            db.refresh(alert)
                            self._broadcast_alert("ALERT_RESOLVED", alert)
                            return alert
                    return None

                existing_alert_id = self._active_alert_map.get(dedup_key)
                if existing_alert_id:
                    alert = db.query(Alert).filter(Alert.alert_id == existing_alert_id).first()
                    if alert and alert.status in ["NEW", "ACKNOWLEDGED", "ESCALATED"]:
                        alert.updated_at = now
                        db.commit()
                        db.refresh(alert)
                        return alert

                priority = health_event.severity.upper() if health_event.severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] else "HIGH"
                new_alert_id = f"ALT-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                title = f"System Alert: Camera {camera_id} Offline"

                alert = Alert(
                    alert_id=new_alert_id,
                    event_id=health_event.event_id,
                    camera_id=camera_id,
                    bop_site="BOP Alpha",
                    title=title,
                    priority=priority,
                    risk_score=75 if priority == "HIGH" else 90 if priority == "CRITICAL" else 40,
                    status="NEW",
                    escalation_deadline=now + timedelta(seconds=300),
                    created_at=now,
                    updated_at=now
                )
                db.add(alert)

                notification = Notification(
                    alert_id=new_alert_id,
                    title=title,
                    message=health_event.description or f"Camera {camera_id} signal lost.",
                    priority=priority,
                    read=False,
                    created_at=now
                )
                db.add(notification)

                db.commit()
                db.refresh(alert)

                self._active_alert_map[dedup_key] = new_alert_id
                logger.info(f"Generated Health Alert {new_alert_id} for Camera {camera_id}")
                self._broadcast_alert("ALERT_CREATED", alert)
                return alert

        except Exception as e:
            logger.error(f"Failed to process health alert for {health_event.event_id}: {e}", exc_info=True)
            return None
        finally:
            db.close()

    def acknowledge_alert(self, alert_id: str, operator_username: str = "operator") -> Alert:
        """
        Acknowledges an alert by an authorized operator.
        """
        db: Session = SessionLocal()
        try:
            alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
            if not alert:
                raise ValueError(f"Alert {alert_id} not found.")

            now = datetime.utcnow()
            alert.status = "ACKNOWLEDGED"
            alert.acknowledged_by = operator_username
            alert.acknowledged_at = now
            alert.updated_at = now

            audit = SecurityAuditLog(
                username=operator_username,
                action="ALERT_ACKNOWLEDGED",
                resource_type="ALERT",
                resource_id=alert_id,
                details=f'{{"alert_id": "{alert_id}", "priority": "{alert.priority}"}}'
            )
            db.add(audit)
            db.commit()
            db.refresh(alert)
            self._broadcast_alert("ALERT_ACKNOWLEDGED", alert)
            return alert
        finally:
            db.close()

    def resolve_alert(
        self,
        alert_id: str,
        operator_username: str = "operator",
        notes: str = "Incident resolved"
    ) -> Alert:
        """
        Resolves an alert and removes it from active incident map.
        """
        db: Session = SessionLocal()
        try:
            alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
            if not alert:
                raise ValueError(f"Alert {alert_id} not found.")

            now = datetime.utcnow()
            alert.status = "RESOLVED"
            alert.resolved_by = operator_username
            alert.resolved_at = now
            alert.resolution_notes = notes
            alert.updated_at = now

            # Clean active alert map key
            with self._lock:
                keys_to_remove = [k for k, v in self._active_alert_map.items() if v == alert_id]
                for k in keys_to_remove:
                    self._active_alert_map.pop(k, None)

            audit = SecurityAuditLog(
                username=operator_username,
                action="ALERT_RESOLVED",
                resource_type="ALERT",
                resource_id=alert_id,
                details=f'{{"notes": "{notes}"}}'
            )
            db.add(audit)
            db.commit()
            db.refresh(alert)
            self._broadcast_alert("ALERT_RESOLVED", alert)
            return alert
        finally:
            db.close()

    def escalate_alert(self, alert_id: str, operator_username: str = "operator", reason: str = "Manual escalation") -> Alert:
        """
        Manually or automatically escalates an alert.
        """
        db: Session = SessionLocal()
        try:
            alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
            if not alert:
                raise ValueError(f"Alert {alert_id} not found.")

            alert.status = "ESCALATED"
            alert.is_escalated = True
            alert.updated_at = datetime.utcnow()

            audit = SecurityAuditLog(
                username=operator_username,
                action="ALERT_ESCALATED",
                resource_type="ALERT",
                resource_id=alert_id,
                details=f'{{"reason": "{reason}"}}'
            )
            db.add(audit)
            db.commit()
            db.refresh(alert)
            self._broadcast_alert("ALERT_ESCALATED", alert)
            return alert
        finally:
            db.close()

    def audit_sla_escalations(self):
        """
        Server-side SLA audit: marks alerts ESCALATED if deadline is exceeded without acknowledgement.
        """
        db: Session = SessionLocal()
        try:
            now = datetime.utcnow()
            overdue_alerts = db.query(Alert).filter(
                Alert.status == "NEW",
                Alert.escalation_deadline <= now,
                Alert.is_escalated == False
            ).all()

            for a in overdue_alerts:
                a.status = "ESCALATED"
                a.is_escalated = True
                a.updated_at = now
                logger.warn(f"Alert {a.alert_id} SLA expired -> Automatically ESCALATED.")
                self._broadcast_alert("ALERT_ESCALATED", a)

            if overdue_alerts:
                db.commit()
        except Exception as e:
            logger.error(f"Error auditing SLA alert escalations: {e}")
        finally:
            db.close()

# Global Singleton
alert_engine = AlertEngine()
