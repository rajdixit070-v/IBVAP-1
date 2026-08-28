import uuid
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.alert import Alert
from app.models.notification import Notification
from app.models.audit_log import SecurityAuditLog
from app.models.security_event import SecurityEvent

logger = logging.getLogger("ibvap.alert.engine")

class AlertEngine:
    """
    Central Alert Engine: Deduplication, SLA Deadlines, Escalations, and Notifications.
    """
    def __init__(self):
        self._lock = threading.Lock()
        # Active track cooldown: (camera_id, track_id, event_type) -> alert_id
        self._active_alert_map: Dict[str, str] = {}

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

                # In-app notification
                notification = Notification(
                    alert_id=new_alert_id,
                    title=title,
                    message=f"Risk Score {event.risk_score}/100. Target Track #{event.track_id} in zone '{event.zone_name or 'Border Wire'}'.",
                    priority=priority,
                    read=False,
                    created_at=now
                )
                db.add(notification)

                db.commit()
                db.refresh(alert)

                self._active_alert_map[dedup_key] = new_alert_id
                logger.info(f"Generated Alert {new_alert_id} ({priority}) for Event {event.event_id}")
                return alert

        except Exception as e:
            logger.error(f"Failed to process alert for event {event.event_id}: {e}", exc_info=True)
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

            if overdue_alerts:
                db.commit()
        except Exception as e:
            logger.error(f"Error auditing SLA alert escalations: {e}")
        finally:
            db.close()

# Global Singleton
alert_engine = AlertEngine()
