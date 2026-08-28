import json
import hashlib
from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.incident import Incident
from app.models.evidence import Evidence
from app.models.audit_log import SecurityAuditLog

class ExportService:
    """
    Generates structured, cryptographically validated incident dossiers and audit reports.
    """

    def generate_incident_report(self, incident_id: str, exported_by: str = "operator") -> Dict[str, Any]:
        db: Session = SessionLocal()
        try:
            inc = db.query(Incident).filter(Incident.incident_id == incident_id).first()
            if not inc:
                raise ValueError(f"Incident {incident_id} not found.")

            # Fetch associated evidence items
            evidence_ids = json.loads(inc.evidence_ids_json or "[]")
            evidence_list = []
            if evidence_ids:
                items = db.query(Evidence).filter(Evidence.evidence_id.in_(evidence_ids)).all()
                for item in items:
                    evidence_list.append({
                        "evidence_id": item.evidence_id,
                        "file_path": item.file_path,
                        "evidence_type": item.evidence_type,
                        "camera_id": item.camera_id,
                        "checksum_sha256": item.checksum_sha256,
                        "created_at": item.created_at.isoformat() if item.created_at else None
                    })

            # Fetch audit trail
            audits = db.query(SecurityAuditLog).filter(
                SecurityAuditLog.resource_id == incident_id
            ).order_by(SecurityAuditLog.timestamp.asc()).all()

            audit_trail = [
                {
                    "action": a.action,
                    "username": a.username,
                    "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                    "details": a.details
                }
                for a in audits
            ]

            # Reconstruct timeline
            timeline = json.loads(inc.timeline_json or "[]")

            # Construct structured report payload
            report_data = {
                "dossier_id": f"DOSSIER-{inc.incident_id}",
                "generated_at": datetime.utcnow().isoformat(),
                "exported_by": exported_by,
                "incident": {
                    "incident_id": inc.incident_id,
                    "title": inc.title,
                    "description": inc.description,
                    "incident_type": inc.incident_type,
                    "priority": inc.priority,
                    "status": inc.status,
                    "escalation_level": inc.escalation_level,
                    "camera_id": inc.camera_id,
                    "bop_site": inc.bop_site,
                    "zone_name": inc.zone_name,
                    "risk_score": inc.risk_score,
                    "global_track_id": inc.global_track_id,
                    "related_cameras": json.loads(inc.related_cameras_json or "[]"),
                    "assigned_to": inc.assigned_to,
                    "assigned_team": inc.assigned_team,
                    "resolution_category": inc.resolution_category,
                    "resolution_notes": inc.resolution_notes,
                    "created_at": inc.created_at.isoformat() if inc.created_at else None,
                    "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
                    "closed_at": inc.closed_at.isoformat() if inc.closed_at else None
                },
                "playbook_checklist": json.loads(inc.checklist_json or "[]"),
                "timeline": timeline,
                "evidence_chain": evidence_list,
                "audit_trail": audit_trail
            }

            # Generate overall integrity hash of the dossier
            dossier_string = json.dumps(report_data, sort_keys=True)
            report_data["dossier_sha256"] = hashlib.sha256(dossier_string.encode("utf-8")).hexdigest()

            return report_data
        finally:
            db.close()

export_service = ExportService()
