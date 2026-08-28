from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.alert import Alert
from app.schemas.alert import (
    AlertResponse,
    AlertAcknowledgeRequest,
    AlertEscalateRequest,
    AlertSummary
)
from app.services.alert.alert_engine import alert_engine

router = APIRouter()

@router.get("/", response_model=List[AlertResponse])
def get_alerts(
    status: Optional[str] = Query(None, description="Filter by status (NEW, ACKNOWLEDGED, ESCALATED)"),
    priority: Optional[str] = Query(None, description="Filter by priority (CRITICAL, HIGH, MEDIUM, LOW)"),
    camera_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    List alerts with SLA status and priority filters.
    """
    alert_engine.audit_sla_escalations()
    query = db.query(Alert)
    if status:
        query = query.filter(Alert.status == status)
    if priority:
        query = query.filter(Alert.priority == priority)
    if camera_id:
        query = query.filter(Alert.camera_id == camera_id)

    return query.order_by(Alert.created_at.desc()).limit(limit).all()

@router.get("/summary", response_model=AlertSummary)
def get_alert_summary(db: Session = Depends(get_db)):
    """
    Summary counts of critical, high, and unacknowledged alerts.
    """
    alert_engine.audit_sla_escalations()
    crit = db.query(Alert).filter(Alert.priority == "CRITICAL", Alert.status.in_(["NEW", "ESCALATED"])).count()
    high = db.query(Alert).filter(Alert.priority == "HIGH", Alert.status.in_(["NEW", "ESCALATED"])).count()
    med = db.query(Alert).filter(Alert.priority == "MEDIUM", Alert.status.in_(["NEW", "ESCALATED"])).count()
    unack = db.query(Alert).filter(Alert.status.in_(["NEW", "ESCALATED"])).count()
    recent = db.query(Alert).order_by(Alert.created_at.desc()).limit(5).all()

    return AlertSummary(
        critical_alerts=crit,
        high_alerts=high,
        medium_alerts=med,
        unacknowledged_alerts=unack,
        recent_alerts=recent
    )

@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: str,
    body: AlertAcknowledgeRequest = AlertAcknowledgeRequest(),
    db: Session = Depends(get_db)
):
    """
    Acknowledge an alert by authorized operator.
    """
    try:
        updated = alert_engine.acknowledge_alert(alert_id, operator_username=body.acknowledged_by or "operator")
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{alert_id}/escalate", response_model=AlertResponse)
def escalate_alert(
    alert_id: str,
    body: AlertEscalateRequest = AlertEscalateRequest(),
    db: Session = Depends(get_db)
):
    """
    Manually escalate an alert.
    """
    try:
        updated = alert_engine.escalate_alert(alert_id, reason=body.reason or "Manual escalation")
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
