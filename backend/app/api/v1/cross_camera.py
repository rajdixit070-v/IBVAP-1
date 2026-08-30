import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.camera_transition import CameraTransition
from app.models.global_track import GlobalTrack
from app.models.track_observation import TrackObservation
from app.models.track_association import TrackAssociation
from app.models.movement_anomaly import MovementAnomaly
from app.schemas.cross_camera import (
    CameraTransitionCreate,
    CameraTransitionUpdate,
    CameraTransitionResponse,
    GlobalTrackResponse,
    GlobalTrackDetailResponse,
    TrackObservationResponse,
    TrackAssociationResponse,
    TrackAssociationReviewRequest,
    MovementAnomalyResponse,
    CrossCameraAnalyticsSummary
)
from app.services.cross_camera.correlation_engine import correlation_engine

router = APIRouter()

# --- Camera Graph Endpoints ---

@router.get("/graph", response_model=List[CameraTransitionResponse])
def get_camera_graph(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all configured camera transitions in the topology network.
    """
    return db.query(CameraTransition).all()

@router.post("/graph/transitions", response_model=CameraTransitionResponse, status_code=201)
def create_camera_transition(
    data: CameraTransitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a new directed transition edge to the camera graph.
    """
    existing = db.query(CameraTransition).filter(
        CameraTransition.from_camera_id == data.from_camera_id,
        CameraTransition.to_camera_id == data.to_camera_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Transition edge already exists.")

    transition = CameraTransition(**data.dict())
    db.add(transition)
    db.commit()
    db.refresh(transition)
    return transition

@router.put("/graph/transitions/{transition_id}", response_model=CameraTransitionResponse)
def update_camera_transition(
    transition_id: int,
    data: CameraTransitionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update travel time limits or status of an existing transition edge.
    """
    transition = db.query(CameraTransition).filter(CameraTransition.id == transition_id).first()
    if not transition:
        raise HTTPException(status_code=404, detail="Transition edge not found.")

    for field, val in data.dict(exclude_unset=True).items():
        setattr(transition, field, val)

    db.commit()
    db.refresh(transition)
    return transition

@router.delete("/graph/transitions/{transition_id}", status_code=204)
def delete_camera_transition(
    transition_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a transition edge from the camera graph.
    """
    transition = db.query(CameraTransition).filter(CameraTransition.id == transition_id).first()
    if not transition:
        raise HTTPException(status_code=404, detail="Transition edge not found.")

    db.delete(transition)
    db.commit()
    return None

# --- Global Tracks & Movement Journey Endpoints ---

@router.get("/tracks", response_model=List[GlobalTrackResponse])
def list_global_tracks(
    status: Optional[str] = Query(None, description="ACTIVE, CREATED, PAUSED, COMPLETED, EXPIRED"),
    object_type: Optional[str] = Query(None, description="person, vehicle"),
    search: Optional[str] = Query(None, description="Search by plate or global track ID"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search and list global continuous tracks with backend pagination.
    """
    query = db.query(GlobalTrack)
    if status:
        query = query.filter(GlobalTrack.status == status)
    if object_type:
        query = query.filter(GlobalTrack.object_type == object_type)
    if search:
        query = query.filter(
            GlobalTrack.global_track_id.ilike(f"%{search}%") |
            GlobalTrack.primary_identifier.ilike(f"%{search}%")
        )

    return query.order_by(GlobalTrack.last_observation_time.desc()).offset(skip).limit(limit).all()

@router.get("/tracks/{global_track_id}", response_model=GlobalTrackDetailResponse)
def get_global_track_detail(
    global_track_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get full multi-camera journey dossier with chronological observations, associations, and anomalies.
    """
    track = db.query(GlobalTrack).filter(GlobalTrack.global_track_id == global_track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Global Track not found.")

    obs_list = db.query(TrackObservation).filter(
        TrackObservation.global_track_id == global_track_id
    ).order_by(TrackObservation.timestamp.asc()).all()

    assoc_list = db.query(TrackAssociation).filter(
        TrackAssociation.global_track_id == global_track_id
    ).order_by(TrackAssociation.created_at.asc()).all()

    anom_list = db.query(MovementAnomaly).filter(
        MovementAnomaly.global_track_id == global_track_id
    ).order_by(MovementAnomaly.created_at.desc()).all()

    anom_responses = [
        MovementAnomalyResponse(
            id=a.id,
            anomaly_id=a.anomaly_id,
            global_track_id=a.global_track_id,
            anomaly_type=a.anomaly_type,
            from_camera_id=a.from_camera_id,
            to_camera_id=a.to_camera_id,
            time_delta_sec=a.time_delta_sec,
            expected_time_sec=a.expected_time_sec,
            severity=a.severity,
            details=json.loads(a.details_json or "{}"),
            created_at=a.created_at
        )
        for a in anom_list
    ]

    return GlobalTrackDetailResponse(
        id=track.id,
        global_track_id=track.global_track_id,
        object_type=track.object_type,
        primary_identifier=track.primary_identifier,
        status=track.status,
        current_camera_id=track.current_camera_id,
        previous_camera_id=track.previous_camera_id,
        last_observation_time=track.last_observation_time,
        total_observations=track.total_observations,
        overall_confidence=track.overall_confidence,
        created_at=track.created_at,
        updated_at=track.updated_at,
        observations=obs_list,
        associations=assoc_list,
        anomalies=anom_responses
    )

# --- Association Human Review ---

@router.post("/associations/{association_id}/review", response_model=TrackAssociationResponse)
def review_track_association(
    association_id: str,
    body: TrackAssociationReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Operator human-in-the-loop confirmation or rejection of cross-camera association.
    """
    try:
        updated = correlation_engine.review_association(
            association_id=association_id,
            action=body.action,
            notes=body.notes,
            operator_username=current_user.username
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# --- Anomalies & Analytics ---

@router.get("/anomalies", response_model=List[MovementAnomalyResponse])
def list_movement_anomalies(
    anomaly_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List cross-camera movement anomalies (impossible transitions, route deviations).
    """
    query = db.query(MovementAnomaly)
    if anomaly_type:
        query = query.filter(MovementAnomaly.anomaly_type == anomaly_type)
    if severity:
        query = query.filter(MovementAnomaly.severity == severity)

    records = query.order_by(MovementAnomaly.created_at.desc()).limit(limit).all()
    return [
        MovementAnomalyResponse(
            id=r.id,
            anomaly_id=r.anomaly_id,
            global_track_id=r.global_track_id,
            anomaly_type=r.anomaly_type,
            from_camera_id=r.from_camera_id,
            to_camera_id=r.to_camera_id,
            time_delta_sec=r.time_delta_sec,
            expected_time_sec=r.expected_time_sec,
            severity=r.severity,
            details=json.loads(r.details_json or "{}"),
            created_at=r.created_at
        )
        for r in records
    ]

@router.get("/analytics/summary", response_model=CrossCameraAnalyticsSummary)
def get_cross_camera_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Summary metrics for multi-camera correlation and movement intelligence.
    """
    total = db.query(GlobalTrack).count()
    active = db.query(GlobalTrack).filter(GlobalTrack.status == "ACTIVE").count()
    vehicles = db.query(GlobalTrack).filter(GlobalTrack.object_type == "vehicle").count()
    anomalies = db.query(MovementAnomaly).count()
    pending = db.query(TrackAssociation).filter(TrackAssociation.status == "PENDING_REVIEW").count()
    transitions = db.query(CameraTransition).filter(CameraTransition.is_enabled == True).count()

    return CrossCameraAnalyticsSummary(
        total_global_tracks=total,
        active_global_tracks=active,
        vehicle_journeys=vehicles,
        movement_anomalies=anomalies,
        pending_association_reviews=pending,
        active_transitions_count=transitions
    )
