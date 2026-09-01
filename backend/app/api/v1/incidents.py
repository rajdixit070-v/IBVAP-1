import json
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db, SessionLocal
from app.api.deps import get_current_user
from app.models.user import User
from app.models.incident import Incident
from app.models.playbook import IncidentPlaybook
from app.models.incident_review import IncidentReview
from app.models.incident_relationship import IncidentRelationship
from app.schemas.incident import (
    IncidentCreate,
    IncidentResponse,
    IncidentTriageRequest,
    IncidentAssignRequest,
    IncidentEscalateRequest,
    IncidentActionRequest,
    IncidentResolveRequest,
    IncidentFalseAlarmRequest,
    IncidentChecklistStepUpdate,
    IncidentReviewCreate,
    IncidentReviewResponse,
    IncidentPlaybookResponse,
    IncidentRelationshipCreate,
    IncidentRelationshipResponse,
    IncidentAnalyticsSummary,
    PlaybookStepItem
)
from app.services.incident.incident_service import incident_service
from app.services.incident.playbook_service import playbook_service
from app.services.incident.escalation_engine import escalation_engine
from app.services.incident.export_service import export_service

logger = logging.getLogger("ibvap.api.incidents")

router = APIRouter()

def serialize_incident(inc: Incident) -> IncidentResponse:
    """Helper to convert Incident model to response schema with JSON fields deserialized."""
    related_cams = json.loads(inc.related_cameras_json or "[]")
    checklist_raw = json.loads(inc.checklist_json or "[]")
    review_raw = json.loads(inc.review_json or "{}")
    timeline_raw = json.loads(inc.timeline_json or "[]")
    evidence_ids = json.loads(inc.evidence_ids_json or "[]")

    checklist_items = [PlaybookStepItem(**s) for s in checklist_raw]

    # Calculate MTTA / MTTR durations if timestamps exist
    mtta = None
    if inc.assigned_at and inc.created_at:
        mtta = max(0.0, (inc.assigned_at - inc.created_at).total_seconds())
    mttr = None
    if inc.resolved_at and inc.created_at:
        mttr = max(0.0, (inc.resolved_at - inc.created_at).total_seconds())

    return IncidentResponse(
        id=inc.id,
        incident_id=inc.incident_id,
        title=inc.title,
        description=inc.description,
        incident_type=inc.incident_type or "SECURITY",
        priority=inc.priority,
        status=inc.status,
        escalation_level=inc.escalation_level or 1,
        escalation_due_at=inc.escalation_due_at,
        false_alarm_reason=inc.false_alarm_reason,
        false_alarm_notes=inc.false_alarm_notes,
        resolution_notes=inc.resolution_notes,
        resolution_category=inc.resolution_category,
        source_event_id=inc.source_event_id,
        camera_id=inc.camera_id,
        bop_site=inc.bop_site,
        zone_name=inc.zone_name,
        track_id=inc.track_id or 0,
        global_track_id=inc.global_track_id,
        risk_score=inc.risk_score or 50,
        related_cameras=related_cams,
        parent_incident_id=inc.parent_incident_id,
        playbook_id=inc.playbook_id,
        checklist=checklist_items,
        review=review_raw,
        assigned_to=inc.assigned_to,
        assigned_team=inc.assigned_team,
        assigned_unit=inc.assigned_unit,
        assigned_at=inc.assigned_at,
        assigned_by=inc.assigned_by,
        evidence_ids=evidence_ids,
        timeline=timeline_raw,
        version=inc.version or 1,
        created_by=inc.created_by,
        created_at=inc.created_at,
        updated_at=inc.updated_at,
        resolved_at=inc.resolved_at,
        resolved_by=inc.resolved_by,
        closed_at=inc.closed_at,
        closed_by=inc.closed_by,
        time_to_acknowledge_sec=mtta,
        time_to_resolve_sec=mttr
    )

@router.get("", response_model=List[IncidentResponse])
@router.get("/", response_model=List[IncidentResponse])
def list_incidents(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    incident_type: Optional[str] = None,
    camera_id: Optional[str] = None,
    bop_site: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List operational incidents with situational filtering."""
    query = db.query(Incident)

    if status and isinstance(status, str):
        query = query.filter(Incident.status == status.upper())
    if priority and isinstance(priority, str):
        query = query.filter(Incident.priority == priority.upper())
    if incident_type and isinstance(incident_type, str):
        query = query.filter(Incident.incident_type == incident_type.upper())
    if camera_id and isinstance(camera_id, str):
        query = query.filter(Incident.camera_id == camera_id)
    if bop_site and isinstance(bop_site, str):
        query = query.filter(Incident.bop_site == bop_site)
    if assigned_to and isinstance(assigned_to, str):
        query = query.filter(Incident.assigned_to.ilike(f"%{assigned_to}%"))
    if search and isinstance(search, str):
        query = query.filter(
            (Incident.title.ilike(f"%{search}%")) |
            (Incident.incident_id.ilike(f"%{search}%")) |
            (Incident.description.ilike(f"%{search}%"))
        )

    num_skip = int(skip) if isinstance(skip, (int, str)) and str(skip).isdigit() else 0
    num_limit = int(limit) if isinstance(limit, (int, str)) and str(limit).isdigit() else 50

    incidents = query.order_by(desc(Incident.created_at)).offset(num_skip).limit(num_limit).all()
    return [serialize_incident(inc) for inc in incidents]

@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(
    body: IncidentCreate,
    current_user: User = Depends(get_current_user)
):
    """Manually create or ingest a security/infrastructure incident."""
    inc = incident_service.create_incident(data=body, operator_username=current_user.username)
    return serialize_incident(inc)

@router.post("/from-alert/{alert_id}", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident_from_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user)
):
    """Create an incident from an existing Alert ID."""
    try:
        inc = incident_service.create_incident_from_alert(alert_id=alert_id, operator_username=current_user.username)
        return serialize_incident(inc)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/from-event/{event_id}", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident_from_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create an incident from an existing SecurityEvent ID."""
    from app.models.security_event import SecurityEvent
    event = db.query(SecurityEvent).filter(SecurityEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found.")
    inc = incident_service.create_incident_from_event(event=event, operator_username=current_user.username)
    return serialize_incident(inc)

# Static sub-endpoints MUST precede parameterized /{incident_id} endpoints
@router.get("/analytics/summary", response_model=IncidentAnalyticsSummary)
def get_incident_analytics(
    current_user: User = Depends(get_current_user)
):
    """Retrieve operational response metrics."""
    return incident_service.get_analytics_summary()

@router.get("/playbooks", response_model=List[IncidentPlaybookResponse])
def list_response_playbooks(
    current_user: User = Depends(get_current_user)
):
    """Retrieve available standard operating response playbooks."""
    pbs = playbook_service.list_playbooks()
    return [
        IncidentPlaybookResponse(
            id=p["id"],
            playbook_id=p["playbook_id"],
            name=p["name"],
            event_type=p["event_type"],
            description=p.get("description"),
            steps=[PlaybookStepItem(**s) for s in p.get("steps", [])],
            is_enabled=p["is_enabled"],
            created_at=p["created_at"]
        )
        for p in pbs
    ]

@router.post("/evaluate-escalations")
def trigger_escalation_evaluation(
    current_user: User = Depends(get_current_user)
):
    """Manually or cron-triggered SLA escalation evaluation."""
    res = escalation_engine.evaluate_and_escalate_active_incidents()
    return {"status": "SUCCESS", "escalated_count": len(res), "escalated": res}

@router.post("/relationships", response_model=IncidentRelationshipResponse)
def link_incidents(
    body: IncidentRelationshipCreate,
    current_user: User = Depends(get_current_user)
):
    """Link incidents hierarchically (Parent/Child or Cluster)."""
    try:
        rel = incident_service.link_incidents(
            parent_id=body.parent_id,
            child_id=body.child_id,
            relationship_type=body.relationship_type,
            actor=current_user.username
        )
        return rel
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Parameterized incident endpoints
@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident_detail(
    incident_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get full incident details."""
    inc = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")
    return serialize_incident(inc)

@router.get("/{incident_id}/report", response_model=Dict[str, Any])
def export_incident_dossier(
    incident_id: str,
    current_user: User = Depends(get_current_user)
):
    """Export complete cryptographically-hashed incident dossier."""
    try:
        return export_service.generate_incident_report(incident_id=incident_id, exported_by=current_user.username)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{incident_id}/triage", response_model=IncidentResponse)
def triage_incident(
    incident_id: str,
    body: IncidentTriageRequest,
    current_user: User = Depends(get_current_user)
):
    """Triage and verify incident."""
    try:
        actor = body.actor_username or current_user.username
        inc = incident_service.triage_incident(
            incident_id=incident_id,
            priority=body.priority,
            playbook_id=body.playbook_id,
            notes=body.notes,
            actor=actor,
            version=body.version
        )
        return serialize_incident(inc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{incident_id}/assign", response_model=IncidentResponse)
def assign_incident(
    incident_id: str,
    body: IncidentAssignRequest,
    current_user: User = Depends(get_current_user)
):
    """Assign incident to operator or tactical team."""
    try:
        actor = body.actor_username or current_user.username
        inc = incident_service.assign_incident(
            incident_id=incident_id,
            assigned_to=body.assigned_to,
            assigned_team=body.assigned_team,
            assigned_unit=body.assigned_unit,
            notes=body.notes,
            actor=actor,
            version=body.version
        )
        return serialize_incident(inc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{incident_id}/checklist/step", response_model=IncidentResponse)
def update_checklist_step(
    incident_id: str,
    body: IncidentChecklistStepUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update progress of a playbook checklist step."""
    try:
        actor = body.actor_username or current_user.username
        inc = incident_service.update_checklist_step(
            incident_id=incident_id,
            step_id=body.step_id,
            is_completed=body.is_completed,
            notes=body.notes,
            actor=actor
        )
        return serialize_incident(inc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{incident_id}/escalate", response_model=IncidentResponse)
def escalate_incident(
    incident_id: str,
    body: IncidentEscalateRequest,
    current_user: User = Depends(get_current_user)
):
    """Escalate incident level."""
    try:
        actor = body.actor_username or current_user.username
        inc = incident_service.escalate_incident(
            incident_id=incident_id,
            reason=body.reason,
            target_level=body.target_level,
            actor=actor,
            version=body.version
        )
        return serialize_incident(inc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{incident_id}/respond", response_model=IncidentResponse)
def respond_incident(
    incident_id: str,
    body: IncidentActionRequest,
    current_user: User = Depends(get_current_user)
):
    """Mark response unit deployed."""
    try:
        actor = body.actor_username or current_user.username
        inc = incident_service.respond_incident(
            incident_id=incident_id,
            notes=body.notes,
            actor=actor,
            version=body.version
        )
        return serialize_incident(inc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{incident_id}/contain", response_model=IncidentResponse)
def contain_incident(
    incident_id: str,
    body: IncidentActionRequest,
    current_user: User = Depends(get_current_user)
):
    """Mark perimeter secured and contained."""
    try:
        actor = body.actor_username or current_user.username
        inc = incident_service.contain_incident(
            incident_id=incident_id,
            notes=body.notes,
            actor=actor,
            version=body.version
        )
        return serialize_incident(inc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{incident_id}/resolve", response_model=IncidentResponse)
def resolve_incident(
    incident_id: str,
    body: IncidentResolveRequest,
    current_user: User = Depends(get_current_user)
):
    """Resolve incident with category and debrief notes."""
    try:
        cat = body.resolution_category or "Resolved"
        notes = body.resolution_notes or body.notes or "Incident resolved by operator."
        actor = body.actor_username or current_user.username
        inc = incident_service.resolve_incident(
            incident_id=incident_id,
            resolution_category=cat,
            resolution_notes=notes,
            actor=actor,
            version=body.version
        )
        return serialize_incident(inc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{incident_id}/false-alarm", response_model=IncidentResponse)
def mark_false_alarm(
    incident_id: str,
    body: IncidentFalseAlarmRequest,
    current_user: User = Depends(get_current_user)
):
    """Mark incident as false alarm with feedback category."""
    try:
        actor = body.actor_username or current_user.username
        inc = incident_service.resolve_incident(
            incident_id=incident_id,
            resolution_category="False Alarm",
            resolution_notes=f"[{body.false_alarm_reason}] {body.false_alarm_notes or ''}",
            actor=actor,
            version=body.version
        )
        # Update false_alarm fields on DB model
        db: Session = SessionLocal()
        try:
            db_inc = db.query(Incident).filter(Incident.incident_id == incident_id).first()
            if db_inc:
                db_inc.false_alarm_reason = body.false_alarm_reason
                db_inc.false_alarm_notes = body.false_alarm_notes
                db.commit()
                db.refresh(db_inc)
                inc = db_inc
        finally:
            db.close()
        return serialize_incident(inc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{incident_id}/close", response_model=IncidentResponse)
def close_incident(
    incident_id: str,
    body: Optional[IncidentActionRequest] = None,
    current_user: User = Depends(get_current_user)
):
    """Close an incident after post-incident review."""
    try:
        actor = (body.actor_username if body and body.actor_username else None) or current_user.username
        version = body.version if body else None
        inc = incident_service.close_incident(incident_id=incident_id, actor=actor, version=version)
        return serialize_incident(inc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{incident_id}/review", response_model=IncidentReviewResponse)
def record_post_incident_review(
    incident_id: str,
    body: IncidentReviewCreate,
    current_user: User = Depends(get_current_user)
):
    """Record post-incident learning, outcome categorization, and calibration feedback."""
    try:
        review = incident_service.record_review(incident_id=incident_id, data=body)
        return review
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
