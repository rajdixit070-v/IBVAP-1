from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.drone_models import Drone, DroneMission
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


def seed_initial_drones_if_empty(db: Session):
    count = db.query(Drone).count()
    if count == 0:
        d1 = Drone(
            drone_id="UAV-GARUDA-01",
            name="Garuda-1 Heavy Recon UAV",
            model="BorderGuardian-X8 Hexacopter",
            site_id="SITE-BORDER-NORTH",
            bop_id="BOP-WAGAH",
            status="AVAILABLE",
            battery_pct=96.0,
            latitude=31.6245,
            longitude=74.8725,
            altitude_m=45.0,
            heading_deg=180.0,
            speed_mps=0.0,
            flight_state="HOVER",
            gps_satellites=18,
            link_quality_pct=98.0,
            camera_gimbal_pitch=-45.0,
            capabilities_json='{"has_thermal": true, "max_speed_mps": 25.0, "max_range_m": 12000, "max_flight_time_min": 50}',
            last_seen_at=datetime.utcnow()
        )
        d2 = Drone(
            drone_id="UAV-NETRA-02",
            name="Netra-2 Rapid Intercept Scout",
            model="AeroScout-Q4 Quadcopter",
            site_id="SITE-BORDER-NORTH",
            bop_id="BOP-WAGAH",
            status="AVAILABLE",
            battery_pct=88.0,
            latitude=31.6260,
            longitude=74.8740,
            altitude_m=30.0,
            heading_deg=90.0,
            speed_mps=0.0,
            flight_state="LANDED",
            gps_satellites=16,
            link_quality_pct=94.0,
            camera_gimbal_pitch=-30.0,
            capabilities_json='{"has_thermal": true, "max_speed_mps": 32.0, "max_range_m": 8000, "max_flight_time_min": 35}',
            last_seen_at=datetime.utcnow()
        )
        db.add(d1)
        db.add(d2)
        db.commit()

        # Seed an initial completed patrol mission
        m1 = DroneMission(
            mission_id=f"MSN-{uuid.uuid4().hex[:8].upper()}",
            drone_id="UAV-GARUDA-01",
            mission_type="PATROL",
            status="COMPLETED",
            priority="HIGH",
            objective="Zero-Line Border Wire Low-Altitude Sweeping Patrol",
            waypoints_json='[{"lat": 31.6245, "lng": 74.8725, "alt": 45}, {"lat": 31.6255, "lng": 74.8735, "alt": 45}, {"lat": 31.6235, "lng": 74.8715, "alt": 45}]',
            assigned_by="officer_alpha",
            created_at=datetime.utcnow() - timedelta(hours=2),
            completed_at=datetime.utcnow() - timedelta(hours=1, minutes=20)
        )
        db.add(m1)
        db.commit()


@router.get("", response_model=List[DroneResponse])
def list_drones(
    site_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    seed_initial_drones_if_empty(db)
    return DroneService.get_all_drones(db, site_id=site_id, status=status)


@router.post("", response_model=DroneResponse, status_code=status.HTTP_201_CREATED)
def register_drone(
    data: DroneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return DroneService.create_drone(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/missions/list", response_model=List[DroneMissionResponse])
@router.get("/missions", response_model=List[DroneMissionResponse])
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

@router.delete("/handoff/clear", status_code=status.HTTP_200_OK)
@router.delete("/handoff/history/clear", status_code=status.HTTP_200_OK)
def clear_handoff_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Clears all target handoff / trigger history records.
    """
    count = DroneHandoffService.clear_handoff_history(db)
    return {"message": f"Cleared {count} trigger handoff history records.", "deleted_count": count}

@router.delete("/handoff/{handoff_id}", status_code=status.HTTP_200_OK)
@router.delete("/handoff/history/{handoff_id}", status_code=status.HTTP_200_OK)
def delete_handoff_record(
    handoff_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes an individual target handoff / trigger event from history.
    """
    success = DroneHandoffService.delete_handoff(db, handoff_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Handoff event '{handoff_id}' not found.")
    return {"message": f"Handoff record '{handoff_id}' deleted successfully."}

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

@router.delete("/missions/{mission_id}", status_code=status.HTTP_200_OK)
def delete_drone_mission(
    mission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = DroneService.delete_mission(db, mission_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Mission '{mission_id}' not found.")
    return {"message": f"Mission '{mission_id}' deleted successfully."}

@router.delete("/clear-all", status_code=status.HTTP_200_OK)
def clear_all_drones(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    count = DroneService.clear_all_drones(db)
    return {"message": f"Cleared all {count} drones and active missions."}

@router.delete("/{drone_id}", status_code=status.HTTP_200_OK)
def delete_drone(
    drone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    success = DroneService.delete_drone(db, drone_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Drone '{drone_id}' not found.")
    return {"message": f"Drone '{drone_id}' deleted successfully."}


