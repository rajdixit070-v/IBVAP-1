import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.incident import Incident
from app.models.audit_log import SecurityAuditLog

logger = logging.getLogger("ibvap.incident.escalation")

# SLA Configuration in Seconds
ESCALATION_POLICY = {
    "CRITICAL": {
        "level_1_timeout_sec": 120, # 2 minutes to acknowledge/triage
        "level_2_timeout_sec": 300, # 5 minutes to assign
        "level_3_timeout_sec": 600  # 10 minutes to contain/respond
    },
    "HIGH": {
        "level_1_timeout_sec": 300, # 5 minutes
        "level_2_timeout_sec": 900, # 15 minutes
        "level_3_timeout_sec": 1800 # 30 minutes
    },
    "MEDIUM": {
        "level_1_timeout_sec": 900,
        "level_2_timeout_sec": 1800,
        "level_3_timeout_sec": 3600
    },
    "LOW": {
        "level_1_timeout_sec": 1800,
        "level_2_timeout_sec": 3600,
        "level_3_timeout_sec": 7200
    }
}

class EscalationEngine:
    """
    Evaluates incident SLA timelines and dynamic risk progression to trigger multi-tier escalations.
    """

    def evaluate_and_escalate_active_incidents(self) -> List[Dict[str, Any]]:
        """
        Runs periodic SLA check and auto-escalates overdue unacknowledged or high-risk incidents.
        """
        db: Session = SessionLocal()
        escalated_list = []
        try:
            now = datetime.utcnow()
            active_incidents = db.query(Incident).filter(
                Incident.status.in_(["NEW", "TRIAGED", "ASSIGNED", "INVESTIGATING"])
            ).all()

            for inc in active_incidents:
                policy = ESCALATION_POLICY.get(inc.priority, ESCALATION_POLICY["HIGH"])
                age_sec = (now - inc.created_at).total_seconds()
                prev_level = inc.escalation_level

                new_level = prev_level
                reason = None

                if prev_level == 1 and age_sec > policy["level_1_timeout_sec"] and inc.status == "NEW":
                    new_level = 2
                    reason = f"Overdue Acknowledgment SLA ({int(age_sec)}s > {policy['level_1_timeout_sec']}s)"
                elif prev_level == 2 and age_sec > policy["level_2_timeout_sec"] and inc.status in ["NEW", "TRIAGED"]:
                    new_level = 3
                    reason = f"Overdue Assignment SLA ({int(age_sec)}s > {policy['level_2_timeout_sec']}s)"

                if new_level > prev_level:
                    inc.escalation_level = new_level
                    inc.updated_at = now
                    timeline = json.loads(inc.timeline_json or "[]")
                    timeline.append({
                        "timestamp": now.isoformat(),
                        "action": "AUTO_ESCALATED",
                        "actor": "system_escalation_engine",
                        "notes": f"Escalated to Level {new_level}: {reason}"
                    })
                    inc.timeline_json = json.dumps(timeline)

                    audit = SecurityAuditLog(
                        username="system",
                        action="INCIDENT_AUTO_ESCALATED",
                        resource_type="INCIDENT",
                        resource_id=inc.incident_id,
                        details=f'{{"from_level": {prev_level}, "to_level": {new_level}, "reason": "{reason}"}}'
                    )
                    db.add(audit)
                    escalated_list.append({
                        "incident_id": inc.incident_id,
                        "old_level": prev_level,
                        "new_level": new_level,
                        "reason": reason
                    })

            if escalated_list:
                db.commit()
                logger.info(f"Escalation engine advanced {len(escalated_list)} incidents.")
            return escalated_list
        except Exception as e:
            db.rollback()
            logger.error(f"Escalation engine check failed: {e}")
            return []
        finally:
            db.close()

    def get_escalation_status(self, incident: Incident) -> Dict[str, Any]:
        """
        Calculates time elapsed and time remaining until next escalation level.
        """
        policy = ESCALATION_POLICY.get(incident.priority, ESCALATION_POLICY["HIGH"])
        now = datetime.utcnow()
        age_sec = (now - incident.created_at).total_seconds()

        current_level = incident.escalation_level
        if current_level == 1:
            timeout = policy["level_1_timeout_sec"]
            remaining_sec = max(0.0, timeout - age_sec)
        elif current_level == 2:
            timeout = policy["level_2_timeout_sec"]
            remaining_sec = max(0.0, timeout - age_sec)
        else:
            remaining_sec = 0.0

        return {
            "escalation_level": current_level,
            "age_seconds": round(age_sec, 1),
            "time_to_next_escalation_seconds": round(remaining_sec, 1),
            "is_overdue": remaining_sec == 0.0 and current_level < 3 and incident.status in ["NEW", "TRIAGED"]
        }

escalation_engine = EscalationEngine()
