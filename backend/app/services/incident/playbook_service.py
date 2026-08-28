import json
import logging
from typing import List, Dict, Optional, Any, Tuple
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.playbook import IncidentPlaybook
from app.schemas.incident import PlaybookStepItem

logger = logging.getLogger("ibvap.incident.playbook")

DEFAULT_PLAYBOOKS = [
    {
        "playbook_id": "PB-VIRTUAL-FENCE",
        "name": "Virtual Fence & Boundary Breach Response",
        "event_type": "VIRTUAL_FENCE_ANOMALY",
        "description": "Standard operating procedure for perimeter fence line crossing and buffer zone intrusion.",
        "steps": [
            {"step_id": 1, "title": "Verify source camera live stream and sector lighting", "required": True, "action": "VERIFY_CAMERA"},
            {"step_id": 2, "title": "Review adjacent camera feeds for continuous global track", "required": True, "action": "CHECK_ADJACENT_CAMERAS"},
            {"step_id": 3, "title": "Inspect trajectory breadcrumb path and intruder velocity", "required": True, "action": "INSPECT_TRAJECTORY"},
            {"step_id": 4, "title": "Dispatch Sector Quick Reaction Team (QRT) to sector coordinate", "required": True, "action": "DISPATCH_PATROL"},
            {"step_id": 5, "title": "Record initial assessment and containment status in incident notes", "required": True, "action": "RECORD_CONTAINMENT"}
        ]
    },
    {
        "playbook_id": "PB-SUSPICIOUS-BEHAVIOUR",
        "name": "Perimeter Probing & Suspicious Behaviour Response",
        "event_type": "SUSPICIOUS_BEHAVIOUR",
        "description": "Protocol for loitering, zigzagging, perimeter crawling, and night-time approach patterns.",
        "steps": [
            {"step_id": 1, "title": "Verify behavioural confidence and multi-signal risk breakdown", "required": True, "action": "ASSESS_RISK"},
            {"step_id": 2, "title": "Check cross-camera route history for previous sector sightings", "required": False, "action": "CHECK_ROUTE_HISTORY"},
            {"step_id": 3, "title": "Assign field patrol unit for visual sector verification", "required": True, "action": "ASSIGN_UNIT"},
            {"step_id": 4, "title": "Log operational notes on entity intent and posture", "required": True, "action": "LOG_INTENT"}
        ]
    },
    {
        "playbook_id": "PB-VEHICLE-ANOMALY",
        "name": "Unregistered / Watchlist Vehicle Anomaly",
        "event_type": "VEHICLE_ANOMALY",
        "description": "Procedure for unauthorized vehicle loitering, high-speed approach, or watchlist alert.",
        "steps": [
            {"step_id": 1, "title": "Verify license plate consensus and OCR capture evidence", "required": True, "action": "VERIFY_ANPR"},
            {"step_id": 2, "title": "Check gate entry authorization database and dwell duration", "required": True, "action": "CHECK_AUTHORIZATION"},
            {"step_id": 3, "title": "Notify checkpoint barrier team to restrict sector egress", "required": True, "action": "RESTRICT_EGRESS"},
            {"step_id": 4, "title": "Record vehicle description, color, and make/model details", "required": False, "action": "LOG_VEHICLE_DETAILS"}
        ]
    },
    {
        "playbook_id": "PB-INFRASTRUCTURE-OUTAGE",
        "name": "Camera Offline & Infrastructure Failover Response",
        "event_type": "INFRASTRUCTURE_OUTAGE",
        "description": "Protocol for single/multi camera stream degradation, power interruption, or network cut.",
        "steps": [
            {"step_id": 1, "title": "Check Edge Gateway ping latency and RTSP ingestion status", "required": True, "action": "PING_GATEWAY"},
            {"step_id": 2, "title": "Verify adjacent PTZ/Fixed cameras to cover blind sector gap", "required": True, "action": "REPOSITION_SURVEILLANCE"},
            {"step_id": 3, "title": "Dispatch Field Maintenance & Telecom Team", "required": True, "action": "DISPATCH_MAINTENANCE"},
            {"step_id": 4, "title": "Confirm edge node store-and-forward offline buffer is active", "required": True, "action": "VERIFY_OFFLINE_BUFFER"}
        ]
    }
]

class PlaybookService:
    """
    Manages response playbooks and tracks checklist execution progress.
    """

    def ensure_default_playbooks(self):
        """Seeds default playbooks into the database if not present."""
        db: Session = SessionLocal()
        try:
            for p_def in DEFAULT_PLAYBOOKS:
                existing = db.query(IncidentPlaybook).filter(IncidentPlaybook.playbook_id == p_def["playbook_id"]).first()
                if not existing:
                    playbook = IncidentPlaybook(
                        playbook_id=p_def["playbook_id"],
                        name=p_def["name"],
                        event_type=p_def["event_type"],
                        description=p_def["description"],
                        steps_json=json.dumps(p_def["steps"]),
                        is_enabled=True
                    )
                    db.add(playbook)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to seed playbooks: {e}")
        finally:
            db.close()

    def get_playbook(self, playbook_id: str) -> Optional[Dict[str, Any]]:
        db: Session = SessionLocal()
        try:
            pb = db.query(IncidentPlaybook).filter(IncidentPlaybook.playbook_id == playbook_id).first()
            if not pb:
                return None
            return {
                "id": pb.id,
                "playbook_id": pb.playbook_id,
                "name": pb.name,
                "event_type": pb.event_type,
                "description": pb.description,
                "steps": json.loads(pb.steps_json or "[]"),
                "is_enabled": pb.is_enabled,
                "created_at": pb.created_at
            }
        finally:
            db.close()

    def list_playbooks(self) -> List[Dict[str, Any]]:
        db: Session = SessionLocal()
        try:
            playbooks = db.query(IncidentPlaybook).filter(IncidentPlaybook.is_enabled == True).all()
            return [
                {
                    "id": pb.id,
                    "playbook_id": pb.playbook_id,
                    "name": pb.name,
                    "event_type": pb.event_type,
                    "description": pb.description,
                    "steps": json.loads(pb.steps_json or "[]"),
                    "is_enabled": pb.is_enabled,
                    "created_at": pb.created_at
                }
                for pb in playbooks
            ]
        finally:
            db.close()

    def instantiate_checklist_for_event(self, event_type: str) -> Tuple[Optional[str], List[Dict[str, Any]]]:
        """Returns matching (playbook_id, checklist_steps) for an event type."""
        db: Session = SessionLocal()
        try:
            pb = db.query(IncidentPlaybook).filter(
                IncidentPlaybook.event_type == event_type,
                IncidentPlaybook.is_enabled == True
            ).first()
            if not pb:
                # Fallback to virtual fence playbook
                pb = db.query(IncidentPlaybook).filter(IncidentPlaybook.playbook_id == "PB-VIRTUAL-FENCE").first()

            if not pb:
                return None, []

            steps = json.loads(pb.steps_json or "[]")
            for s in steps:
                s["is_completed"] = False
                s["completed_by"] = None
                s["completed_at"] = None
                s["notes"] = None
            return pb.playbook_id, steps
        finally:
            db.close()

playbook_service = PlaybookService()
