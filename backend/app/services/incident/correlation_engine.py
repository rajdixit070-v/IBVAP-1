import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.incident import Incident
from app.models.alert import Alert

logger = logging.getLogger("ibvap.incident.correlation")

class CorrelationEngine:
    """
    Correlates alerts from multiple cameras, continuous global tracks, and network nodes
    to prevent incident duplication and build unified multi-camera situational pictures.
    """

    def find_matching_incident_id(
        self,
        camera_id: str,
        global_track_id: Optional[str] = None,
        bop_site: str = "BOP Alpha",
        window_minutes: int = 10,
        incident_type: str = "SECURITY",
        db: Optional[Session] = None
    ) -> Optional[str]:
        """
        Finds an active incident ID that correlates with the incoming event.
        """
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True
        try:
            cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
            active_statuses = ["NEW", "TRIAGED", "ASSIGNED", "INVESTIGATING", "RESPONDING", "CONTAINED"]

            # 1. If global_track_id is present, match by exact global track
            if global_track_id:
                inc = db.query(Incident).filter(
                    Incident.global_track_id == global_track_id,
                    Incident.status.in_(active_statuses),
                    Incident.created_at >= cutoff
                ).first()
                return inc.incident_id if inc else None

            # 2. Otherwise match by same Camera & Site within active window
            inc = db.query(Incident).filter(
                Incident.camera_id == camera_id,
                Incident.bop_site == bop_site,
                Incident.incident_type == incident_type,
                Incident.status.in_(active_statuses),
                Incident.created_at >= cutoff
            ).order_by(Incident.created_at.desc()).first()

            return inc.incident_id if inc else None
        finally:
            if close_db:
                db.close()

    def correlate_or_create(
        self,
        alert: Alert,
        risk_score: int = 50,
        global_track_id: Optional[str] = None,
        operator_username: str = "system"
    ) -> Tuple[Incident, bool]:
        """
        Attaches alert to an existing correlated incident or returns (incident, is_new).
        """
        db: Session = SessionLocal()
        try:
            inc_id = self.find_matching_incident_id(
                camera_id=alert.camera_id,
                global_track_id=global_track_id,
                bop_site=alert.bop_site,
                db=db
            )

            now = datetime.utcnow()
            if inc_id:
                existing = db.query(Incident).filter(Incident.incident_id == inc_id).first()
                if existing:
                    # Attach to existing incident
                    related = json.loads(existing.related_cameras_json or "[]")
                    if alert.camera_id not in related:
                        related.append(alert.camera_id)
                    existing.related_cameras_json = json.dumps(related)

                    # Dynamically elevate risk if higher
                    if risk_score > existing.risk_score:
                        existing.risk_score = risk_score
                        if risk_score >= 80 and existing.priority != "CRITICAL":
                            existing.priority = "CRITICAL"

                    # Append timeline entry
                    timeline = json.loads(existing.timeline_json or "[]")
                    timeline.append({
                        "timestamp": now.isoformat(),
                        "action": "CORRELATED_ALERT_ATTACHED",
                        "actor": operator_username,
                        "notes": f"Correlated Alert {alert.alert_id} ({alert.title}) from {alert.camera_id} attached."
                    })
                    existing.timeline_json = json.dumps(timeline)
                    existing.updated_at = now
                    db.commit()
                    db.refresh(existing)
                    logger.info(f"Correlated Alert {alert.alert_id} into Incident {existing.incident_id}")
                    return existing, False

            # Otherwise create new incident
            from app.services.incident.incident_service import incident_service
            from app.schemas.incident import IncidentCreate

            inc_create = IncidentCreate(
                title=alert.title,
                description=f"Automated incident generated from Alert {alert.alert_id}",
                priority=alert.priority or "HIGH",
                incident_type="SECURITY",
                camera_id=alert.camera_id,
                bop_site=alert.bop_site,
                global_track_id=global_track_id,
                risk_score=risk_score,
                source_event_id=alert.event_id
            )
            new_inc = incident_service.create_incident(inc_create, operator_username=operator_username)
            return new_inc, True
        finally:
            db.close()

correlation_engine = CorrelationEngine()
