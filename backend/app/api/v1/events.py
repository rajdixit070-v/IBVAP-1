import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.security_event import SecurityEvent
from app.models.audit_log import SecurityAuditLog
from app.schemas.security_event import (
    SecurityEventResponse,
    SecurityEventStatusUpdate,
    SecurityEventsSummary,
    RiskFactor,
    EventTimelineEntry
)
from app.schemas.ai import BoundingBox

router = APIRouter(prefix="/events", tags=["Security Events & Threat Intelligence"])

def serialize_event(evt: SecurityEvent) -> SecurityEventResponse:
    factors_raw = json.loads(evt.factors_json or '[]')
    timeline_raw = json.loads(evt.timeline_json or '[]')
    bbox_raw = json.loads(evt.last_bbox_json) if evt.last_bbox_json else None

    return SecurityEventResponse(
        id=evt.id,
        event_id=evt.event_id,
        camera_id=evt.camera_id,
        zone_id=evt.zone_id,
        zone_name=evt.zone_name,
        track_id=evt.track_id,
        object_type=evt.object_type,
        event_type=evt.event_type,
        severity=evt.severity,
        risk_score=evt.risk_score,
        risk_level=evt.risk_level,
        status=evt.status,
        environment=evt.environment,
        location_description=evt.location_description,
        factors=[
            RiskFactor(
                factor=f.get("factor") or f.get("name") or "RISK_FACTOR",
                weight=f.get("weight") or f.get("score") or 0,
                description=f.get("description") or f.get("details") or ""
            ) if isinstance(f, dict) else RiskFactor(factor=str(f), weight=0, description="")
            for f in factors_raw
        ],
        timeline=[
            EventTimelineEntry(
                timestamp=t.get("timestamp", evt.started_at.isoformat()) if isinstance(t, dict) else evt.started_at.isoformat(),
                message=t.get("message", str(t)) if isinstance(t, dict) else str(t),
                risk_score=t.get("risk_score", evt.risk_score) if isinstance(t, dict) else evt.risk_score
            ) if isinstance(t, dict) else EventTimelineEntry(timestamp=evt.started_at.isoformat(), message=str(t), risk_score=evt.risk_score)
            for t in timeline_raw
        ],
        last_bbox=BoundingBox(
            x=bbox_raw.get("x", 0.0),
            y=bbox_raw.get("y", 0.0),
            width=bbox_raw.get("width", bbox_raw.get("w", 0.0)),
            height=bbox_raw.get("height", bbox_raw.get("h", 0.0))
        ) if bbox_raw else None,
        last_direction=evt.last_direction,
        last_speed=evt.last_speed,
        evidence_id=getattr(evt, 'evidence_id', None),
        evidence_url=f"/api/v1/evidence/{evt.evidence_id}/file" if getattr(evt, 'evidence_id', None) else None,
        started_at=evt.started_at,
        last_updated_at=evt.last_updated_at
    )

@router.get("/", response_model=List[SecurityEventResponse])
def get_security_events(
    camera_id: Optional[str] = Query(None, description="Filter by Camera ID"),
    risk_level: Optional[str] = Query(None, description="CRITICAL, HIGH, MEDIUM, LOW"),
    event_type: Optional[str] = Query(None, description="ZONE_INTRUSION, LOITERING, etc."),
    status: Optional[str] = Query(None, description="ACTIVE, ACKNOWLEDGED, DISMISSED"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Queries security events with multi-criteria filtering and pagination."""
    query = db.query(SecurityEvent)
    if camera_id:
        query = query.filter(SecurityEvent.camera_id == camera_id)
    if risk_level:
        query = query.filter(SecurityEvent.risk_level == risk_level.upper())
    if event_type:
        query = query.filter(SecurityEvent.event_type == event_type.upper())
    if status:
        query = query.filter(SecurityEvent.status == status.upper())

    records = query.order_by(desc(SecurityEvent.last_updated_at)).offset(skip).limit(limit).all()
    return [serialize_event(r) for r in records]

@router.get("/summary", response_model=SecurityEventsSummary)
def get_events_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns active risk level counts and latest recent incidents."""
    active_events = db.query(SecurityEvent).filter(SecurityEvent.status.in_(["ACTIVE", "CONFIRMED", "DETECTED"])).all()
    
    crit = sum(1 for e in active_events if e.risk_level == "CRITICAL")
    high = sum(1 for e in active_events if e.risk_level == "HIGH")
    med = sum(1 for e in active_events if e.risk_level == "MEDIUM")
    low = sum(1 for e in active_events if e.risk_level == "LOW")

    recent = db.query(SecurityEvent).order_by(desc(SecurityEvent.last_updated_at)).limit(5).all()

    return SecurityEventsSummary(
        critical_count=crit,
        high_count=high,
        medium_count=med,
        low_count=low,
        total_active=len(active_events),
        recent_events=[serialize_event(r) for r in recent]
    )

@router.get("/{event_id}", response_model=SecurityEventResponse)
def get_security_event_detail(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetches single incident details with full timeline and explainable risk factors."""
    evt = db.query(SecurityEvent).filter(SecurityEvent.event_id == event_id).first()
    if not evt:
        raise HTTPException(status_code=404, detail="Security event not found.")
    return serialize_event(evt)

@router.put("/{event_id}/status", response_model=SecurityEventResponse)
def update_event_status(
    event_id: str,
    status_in: SecurityEventStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates operational state of a security event (ACKNOWLEDGED, DISMISSED, RESOLVED)."""
    evt = db.query(SecurityEvent).filter(SecurityEvent.event_id == event_id).first()
    if not evt:
        raise HTTPException(status_code=404, detail="Security event not found.")

    new_status = status_in.status.upper()
    evt.status = new_status
    now = datetime.utcnow()

    # Append to timeline
    timeline = json.loads(evt.timeline_json or '[]')
    timeline.append({
        "timestamp": now.strftime("%H:%M:%S"),
        "message": f"Operator '{current_user.username}' updated status to {new_status}" + (f": {status_in.comment}" if status_in.comment else "")
    })
    evt.timeline_json = json.dumps(timeline)
    evt.last_updated_at = now

    # Audit log
    audit = SecurityAuditLog(
        username=current_user.username,
        action=f"EVENT_{new_status}",
        resource_type="EVENT",
        resource_id=event_id,
        details=status_in.comment
    )
    db.add(audit)

    db.commit()
    db.refresh(evt)
    return serialize_event(evt)
