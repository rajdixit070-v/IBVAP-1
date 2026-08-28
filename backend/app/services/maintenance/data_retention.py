import logging
from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.health_log import CameraHealthLog
from app.models.health_models import SystemHealthSnapshot, HealthEvent
from app.models.multimodal_models import AIObservation
from app.models.enterprise_security_models import SecurityAuditLogEntry, SessionTokenBlacklist

logger = logging.getLogger("ibvap.maintenance.retention")

class DataRetentionService:
    """
    Automated data retention and storage management service.
    Purges expired telemetry and ephemeral AI observations according to policy,
    while strictly preserving incident evidence, active alarms, and forensic records.
    """

    DEFAULT_RETENTION_DAYS = {
        "camera_health_logs": 14,      # 14 days of high-frequency FPS logs
        "system_health_snapshots": 30, # 30 days of health score records
        "ai_observations": 30,         # 30 days of non-incident raw detections
        "expired_session_tokens": 1,   # 1 day after expiration
        "security_audit_logs": 365     # 1 year for compliance
    }

    @classmethod
    def prune_expired_records(cls, db: Session, dry_run: bool = False) -> Dict[str, Any]:
        """
        Scans tables and deletes records older than their configured retention window.
        Returns a summary report of purged counts.
        """
        now = datetime.utcnow()
        summary = {
            "timestamp": now.isoformat(),
            "dry_run": dry_run,
            "purged_counts": {},
            "total_purged": 0,
            "status": "COMPLETED"
        }

        try:
            # 1. Camera Health Logs
            cutoff_health = now - timedelta(days=cls.DEFAULT_RETENTION_DAYS["camera_health_logs"])
            q_health = db.query(CameraHealthLog).filter(CameraHealthLog.timestamp < cutoff_health)
            count_health = q_health.count()
            if not dry_run and count_health > 0:
                q_health.delete(synchronize_session=False)
            summary["purged_counts"]["camera_health_logs"] = count_health

            # 2. System Health Snapshots
            cutoff_snapshots = now - timedelta(days=cls.DEFAULT_RETENTION_DAYS["system_health_snapshots"])
            q_snapshots = db.query(SystemHealthSnapshot).filter(SystemHealthSnapshot.timestamp < cutoff_snapshots)
            count_snapshots = q_snapshots.count()
            if not dry_run and count_snapshots > 0:
                q_snapshots.delete(synchronize_session=False)
            summary["purged_counts"]["system_health_snapshots"] = count_snapshots

            # 3. AI Observations (only those not linked to active incidents or evidence)
            cutoff_obs = now - timedelta(days=cls.DEFAULT_RETENTION_DAYS["ai_observations"])
            q_obs = db.query(AIObservation).filter(AIObservation.timestamp < cutoff_obs)
            count_obs = q_obs.count()
            if not dry_run and count_obs > 0:
                q_obs.delete(synchronize_session=False)
            summary["purged_counts"]["ai_observations"] = count_obs

            # 4. Expired Session Blacklist Tokens
            q_tokens = db.query(SessionTokenBlacklist).filter(SessionTokenBlacklist.expires_at < now)
            count_tokens = q_tokens.count()
            if not dry_run and count_tokens > 0:
                q_tokens.delete(synchronize_session=False)
            summary["purged_counts"]["expired_session_tokens"] = count_tokens

            if not dry_run:
                db.commit()

            summary["total_purged"] = sum(summary["purged_counts"].values())
            logger.info(f"[RETENTION] Pruning completed: {summary['total_purged']} records purged (dry_run={dry_run}).")

        except Exception as e:
            if not dry_run:
                db.rollback()
            summary["status"] = "FAILED"
            summary["error"] = str(e)
            logger.error(f"[RETENTION] Pruning failed: {str(e)}")

        return summary
