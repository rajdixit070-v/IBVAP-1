from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.face_event import FaceEvent
from app.models.audit_log import SecurityAuditLog
from app.schemas.face import FaceEventResponse, FaceVerificationUpdate, FaceAnalyticsSummary

router = APIRouter()

@router.get("/events", response_model=List[FaceEventResponse])
def list_face_events(
    camera_id: Optional[str] = Query(None),
    match_status: Optional[str] = Query(None),
    verification_status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List recorded facial recognition events with multi-criteria filtering.
    """
    query = db.query(FaceEvent)
    if camera_id:
        query = query.filter(FaceEvent.camera_id == camera_id)
    if match_status:
        query = query.filter(FaceEvent.match_status == match_status)
    if verification_status:
        query = query.filter(FaceEvent.verification_status == verification_status)

    return query.order_by(FaceEvent.timestamp.desc()).limit(limit).all()

@router.get("/summary", response_model=FaceAnalyticsSummary)
def get_face_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns aggregated facial analytics metrics.
    """
    total = db.query(FaceEvent).count()
    matches = db.query(FaceEvent).filter(FaceEvent.match_status == "WATCHLIST_POTENTIAL_MATCH").count()
    auth_count = db.query(FaceEvent).filter(FaceEvent.match_status == "AUTHORIZED_MATCH").count()
    unk_count = db.query(FaceEvent).filter(FaceEvent.match_status == "UNKNOWN").count()
    recent = db.query(FaceEvent).order_by(FaceEvent.timestamp.desc()).limit(8).all()

    return FaceAnalyticsSummary(
        total_faces=total,
        potential_matches=matches,
        authorized_faces=auth_count,
        unknown_faces=unk_count,
        recent_events=recent
    )

@router.put("/events/{event_id}/verify", response_model=FaceEventResponse)
def verify_face_match(
    event_id: str,
    data: FaceVerificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Operator action to verify or dismiss a potential facial watchlist match.
    """
    event = db.query(FaceEvent).filter(FaceEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Face event not found.")

    event.verification_status = data.verification_status
    event.verification_notes = data.verification_notes

    audit = SecurityAuditLog(
        username=current_user.username,
        action=f"FACE_MATCH_{data.verification_status}",
        resource_type="FACE_EVENT",
        resource_id=event_id,
        details=f'{{"status": "{data.verification_status}", "person": "{event.matched_person_name}"}}'
    )
    db.add(audit)
    db.commit()
    db.refresh(event)

    return event
