from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.drone_schemas import (
    DroneCreate,
    DroneUpdate,
    DroneResponse,
    DroneTelemetryUpdate,
    DroneMissionCreate,
    DroneMissionResponse,
    DroneHandoffRequest,
    DroneHandoffResponse
)
from app.api.deps import get_current_user, require_admin
from app.services.drones.drone_service import DroneService
from app.services.drones.handoff_service import DroneHandoffService

router = APIRouter(prefix="/drones", tags=["Drone Fleet & Missions"])

@router.get("", response_model=List[DroneResponse])
def list_drones(
    site_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return DroneService.get_all_drones(db, site_id=site_id, status=status)

@router.post("", response_model=DroneResponse, status_code=status.HTTP_201_CREATED)
def register_drone(
    data: DroneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    try:
        return DroneService.create_drone(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{drone_id}", response_model=DroneResponse)
def get_drone(
    drone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    drone = DroneService.get_drone_by_id(db, drone_id)
    if not drone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Drone '{drone_id}' not found.")
    return drone

@router.post("/{drone_id}/telemetry", response_model=DroneResponse)
def update_drone_telemetry(
    drone_id: str,
    telemetry: DroneTelemetryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    drone = DroneService.update_telemetry(db, drone_id, telemetry)
    if not drone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Drone '{drone_id}' not found.")
    return drone

@router.get("/missions/list", response_model=List[DroneMissionResponse])
def list_drone_missions(
    site_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return DroneService.get_missions(db, site_id=site_id, status=status)

@router.post("/missions", response_model=DroneMissionResponse, status_code=status.HTTP_201_CREATED)
def create_drone_mission(
    data: DroneMissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return DroneService.create_mission(db, data, user_id=current_user.username)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/missions/{mission_id}/dispatch", response_model=DroneMissionResponse)
def dispatch_drone_mission(
    mission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return DroneService.dispatch_mission(db, mission_id, user_id=current_user.username)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/missions/{mission_id}/abort", response_model=DroneMissionResponse)
def abort_drone_mission(
    mission_id: str,
    reason: str = Query("Operator Abort", description="Reason for aborting mission"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return DroneService.abort_mission(db, mission_id, reason=reason, user_id=current_user.username)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/missions/{mission_id}/complete", response_model=DroneMissionResponse)
def complete_drone_mission(
    mission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return DroneService.complete_mission(db, mission_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/handoff", response_model=DroneHandoffResponse)
def execute_target_handoff(
    req: DroneHandoffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Executes cross-sensor target handoff (Camera -> Drone or Drone -> Camera) with continuous track preservation.
    """
    try:
        return DroneHandoffService.execute_handoff(db, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/handoff/history", response_model=List[DroneHandoffResponse])
def get_handoff_history(
    global_track_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return DroneHandoffService.get_handoff_history(db, global_track_id=global_track_id, limit=limit)

