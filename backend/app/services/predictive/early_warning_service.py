import json
import uuid
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.early_warning import EarlyWarning
from app.models.baseline_shift import BaselineShift
from app.models.activity_baseline import ActivityBaseline
from app.models.audit_log import SecurityAuditLog

logger = logging.getLogger("ibvap.predictive.early_warning")

class EarlyWarningService:
    """
    Early Warning Lifecycle and Baseline Shift Management Service.
    Enforces deduplication, state transitions, expiration, and administrative shift reviews.
    """

    def emit_or_update_warning(
        self,
        camera_id: Optional[str],
        zone_id: Optional[str],
        zone_name: Optional[str],
        site_id: Optional[str],
        warning_level: str,
        forecast_risk_score: int,
        current_risk_score: int,
        confidence: float,
        data_quality_score: float,
        current_activity_count: int,
        baseline_expected_count: float,
        deviation_percent: float,
        trend: str,
        reasons: List[Dict[str, str]],
        counter_signals: List[Dict[str, str]],
        forecast_horizon_minutes: int = 60
    ) -> EarlyWarning:
        """
        Creates a new EarlyWarning or updates existing active warning if already present (deduplication).
        """
        db: Session = SessionLocal()
        try:
            now = datetime.utcnow()
            expires = now + timedelta(minutes=forecast_horizon_minutes)

            # Check for existing active warning for this camera/zone
            existing = db.query(EarlyWarning).filter(
                EarlyWarning.camera_id == camera_id,
                EarlyWarning.zone_id == zone_id,
                EarlyWarning.lifecycle_status.in_(["NEW", "ACTIVE"])
            ).first()

            if existing:
                # Update existing active warning
                existing.warning_level = warning_level
                existing.forecast_risk_score = forecast_risk_score
                existing.current_risk_score = current_risk_score
                existing.confidence = confidence
                existing.data_quality_score = data_quality_score
                existing.current_activity_count = current_activity_count
                existing.baseline_expected_count = baseline_expected_count
                existing.deviation_percent = deviation_percent
                existing.trend = trend
                existing.reasons_json = json.dumps(reasons)
                existing.counter_signals_json = json.dumps(counter_signals)
                existing.expires_at = expires
                existing.updated_at = now
                db.commit()
                db.refresh(existing)
                logger.info(f"Updated existing Early Warning {existing.warning_id} ({warning_level})")
                return existing

            # Create new Early Warning
            warning_id = f"EW-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            ew = EarlyWarning(
                warning_id=warning_id,
                warning_level=warning_level,
                lifecycle_status="ACTIVE",
                camera_id=camera_id,
                zone_id=zone_id,
                zone_name=zone_name,
                site_id=site_id,
                forecast_risk_score=forecast_risk_score,
                current_risk_score=current_risk_score,
                confidence=confidence,
                data_quality_score=data_quality_score,
                current_activity_count=current_activity_count,
                baseline_expected_count=baseline_expected_count,
                deviation_percent=deviation_percent,
                trend=trend,
                forecast_horizon_minutes=forecast_horizon_minutes,
                reasons_json=json.dumps(reasons),
                counter_signals_json=json.dumps(counter_signals),
                expires_at=expires,
                created_at=now,
                updated_at=now
            )
            db.add(ew)
            db.commit()
            db.refresh(ew)
            logger.info(f"Created new Early Warning {warning_id} ({warning_level})")
            return ew
        finally:
            db.close()

    def acknowledge_warning(self, warning_id: str, username: str = "operator") -> Optional[EarlyWarning]:
        """Acknowledge an active early warning with audit logging."""
        db: Session = SessionLocal()
        try:
            ew = db.query(EarlyWarning).filter(EarlyWarning.warning_id == warning_id).first()
            if not ew: return None

            ew.lifecycle_status = "ACKNOWLEDGED"
            ew.acknowledged_by = username
            ew.acknowledged_at = datetime.utcnow()

            audit = SecurityAuditLog(
                username=username,
                action="ACKNOWLEDGE_EARLY_WARNING",
                resource_type="EARLY_WARNING",
                resource_id=warning_id,
                details=json.dumps({"status": "ACKNOWLEDGED"})
            )
            db.add(audit)
            db.commit()
            db.refresh(ew)
            return ew
        finally:
            db.close()

    def dismiss_warning(self, warning_id: str, username: str = "operator", notes: str = "") -> Optional[EarlyWarning]:
        """Dismiss an early warning with operator rationale."""
        db: Session = SessionLocal()
        try:
            ew = db.query(EarlyWarning).filter(EarlyWarning.warning_id == warning_id).first()
            if not ew: return None

            ew.lifecycle_status = "DISMISSED"
            ew.notes = notes

            audit = SecurityAuditLog(
                username=username,
                action="DISMISS_EARLY_WARNING",
                resource_type="EARLY_WARNING",
                resource_id=warning_id,
                details=json.dumps({"notes": notes})
            )
            db.add(audit)
            db.commit()
            db.refresh(ew)
            return ew
        finally:
            db.close()

    def detect_and_record_baseline_shift(
        self,
        camera_id: str,
        hour_of_day: int,
        old_value: float,
        new_value: float,
        zone_id: Optional[str] = None
    ) -> Optional[BaselineShift]:
        """
        Flags sustained baseline deviation as a BaselineShift requiring administrative review.
        """
        deviation_pct = round(((new_value - old_value) / max(1.0, old_value)) * 100.0, 1)
        if abs(deviation_pct) < 50.0:
            return None # Not a major shift

        db: Session = SessionLocal()
        try:
            shift_id = f"SHIFT-{camera_id}-H{hour_of_day}"
            shift = db.query(BaselineShift).filter(BaselineShift.shift_id == shift_id).first()
            if not shift:
                shift = BaselineShift(
                    shift_id=shift_id,
                    camera_id=camera_id,
                    zone_id=zone_id,
                    hour_of_day=hour_of_day,
                    old_baseline_value=old_value,
                    new_observed_value=new_value,
                    deviation_percent=deviation_pct,
                    status="REVIEW_REQUIRED",
                    detected_at=datetime.utcnow()
                )
                db.add(shift)
                db.commit()
                db.refresh(shift)
            return shift
        finally:
            db.close()

    def approve_baseline_shift(
        self,
        shift_id: str,
        approve: bool,
        reviewed_by: str = "admin",
        notes: Optional[str] = None
    ) -> Optional[BaselineShift]:
        """
        Approves or rejects a detected baseline shift, updating ActivityBaseline on approval.
        """
        db: Session = SessionLocal()
        try:
            shift = db.query(BaselineShift).filter(BaselineShift.shift_id == shift_id).first()
            if not shift: return None

            shift.status = "APPROVED" if approve else "REJECTED"
            shift.reviewed_by = reviewed_by
            shift.reviewed_at = datetime.utcnow()
            shift.notes = notes

            if approve:
                # Update underlying baseline
                baseline = db.query(ActivityBaseline).filter(
                    ActivityBaseline.camera_id == shift.camera_id,
                    ActivityBaseline.hour_of_day == shift.hour_of_day
                ).first()
                if baseline:
                    baseline.expected_person_count = shift.new_observed_value
                    baseline.version += 1
                    baseline.updated_at = datetime.utcnow()

            audit = SecurityAuditLog(
                username=reviewed_by,
                action="APPROVE_BASELINE_SHIFT" if approve else "REJECT_BASELINE_SHIFT",
                resource_type="BASELINE_SHIFT",
                resource_id=shift_id,
                details=json.dumps({"approved": approve, "notes": notes or ""})
            )
            db.add(audit)
            db.commit()
            db.refresh(shift)
            return shift
        finally:
            db.close()

early_warning_service = EarlyWarningService()
