from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.anpr_event import ANPREvent
from app.schemas.anpr import ANPREventResponse, ANPRSummary

router = APIRouter()

@router.get("/events", response_model=List[ANPREventResponse])
def get_anpr_events(
    camera_id: Optional[str] = Query(None),
    match_status: Optional[str] = Query(None),
    plate: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List recorded ANPR license plate recognition events with multi-criteria filtering.
    """
    query = db.query(ANPREvent)
    if camera_id:
        query = query.filter(ANPREvent.camera_id == camera_id)
    if match_status:
        query = query.filter(ANPREvent.match_status == match_status)
    if plate:
        query = query.filter(ANPREvent.normalized_plate.ilike(f"%{plate.strip().upper()}%"))

    events = query.order_by(ANPREvent.timestamp.desc()).limit(limit).all()
    return events

@router.get("/summary", response_model=ANPRSummary)
def get_anpr_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns aggregated ANPR metrics for dashboard operations.
    """
    total = db.query(ANPREvent).count()
    wl_count = db.query(ANPREvent).filter(ANPREvent.match_status == "WATCHLIST_MATCH").count()
    auth_count = db.query(ANPREvent).filter(ANPREvent.match_status == "AUTHORIZED").count()
    unk_count = db.query(ANPREvent).filter(ANPREvent.match_status == "UNKNOWN").count()
    
    recent = db.query(ANPREvent).order_by(ANPREvent.timestamp.desc()).limit(8).all()

    return ANPRSummary(
        total_reads=total,
        watchlist_matches=wl_count,
        authorized_count=auth_count,
        unknown_count=unk_count,
        recent_events=recent
    )

@router.get("/events/{event_id}", response_model=ANPREventResponse)
def get_anpr_event_detail(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve single ANPR event details.
    """
    event = db.query(ANPREvent).filter(ANPREvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="ANPR event not found.")
    return event
