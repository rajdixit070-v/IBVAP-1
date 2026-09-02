from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.sensor_models import Sensor, SensorTelemetry, SensorFusionEvent
from app.schemas.sensor_schemas import (
    SensorCreate,
    SensorUpdate,
    SensorResponse,
    SensorTelemetryCreate,
    SensorTelemetryResponse,
    MultiSensorFusionRequest,
    SensorFusionEventResponse
)
from app.api.deps import get_current_user, require_admin
from app.services.sensors.sensor_service import SensorService
from app.services.sensors.fusion_engine import MultiSensorFusionEngine

router = APIRouter(prefix="/sensors", tags=["Multi-Sensor Intelligence"])

@router.get("", response_model=List[SensorResponse])
def list_sensors(
    site_id: Optional[str] = None,
    bop_id: Optional[str] = None,
    sensor_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List registered sensors matching authorized site / BOP scope and filters.
    """
    # Scope check: Non-admin users restricted to their assigned site
    effective_site = site_id
    if current_user.role not in ("admin", "superadmin") and hasattr(current_user, "site_id") and current_user.site_id:
        effective_site = current_user.site_id

    return SensorService.get_all_sensors(db, site_id=effective_site, bop_id=bop_id, sensor_type=sensor_type, status=status)

@router.post("", response_model=SensorResponse, status_code=status.HTTP_201_CREATED)
def register_sensor(
    data: SensorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Register a new sensor into the perimeter array (Optical, Thermal, Radar, Seismic, Acoustic, Drone).
    """
    try:
        return SensorService.create_sensor(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{sensor_id}", response_model=SensorResponse)
def get_sensor(
    sensor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sensor = SensorService.get_sensor_by_id(db, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Sensor '{sensor_id}' not found.")
    return sensor

@router.put("/{sensor_id}", response_model=SensorResponse)
def update_sensor(
    sensor_id: str,
    data: SensorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sensor = SensorService.update_sensor(db, sensor_id, data)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Sensor '{sensor_id}' not found.")
    return sensor

@router.delete("/{sensor_id}")
def delete_sensor(
    sensor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    success = SensorService.delete_sensor(db, sensor_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Sensor '{sensor_id}' not found.")
    return {"status": "DELETED", "sensor_id": sensor_id}

@router.post("/{sensor_id}/telemetry", response_model=SensorTelemetryResponse)
def record_sensor_telemetry(
    sensor_id: str,
    data: SensorTelemetryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if data.sensor_id != sensor_id:
        data.sensor_id = sensor_id
    return SensorService.record_telemetry(db, data)

@router.get("/{sensor_id}/telemetry", response_model=List[SensorTelemetryResponse])
def get_sensor_telemetries(
    sensor_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return SensorService.get_telemetries(db, sensor_id, limit=limit)

@router.post("/fusion/correlate", response_model=SensorFusionEventResponse)
def correlate_multi_sensor_fusion(
    request: MultiSensorFusionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Correlates multi-sensor observations using Bayesian evidential combination and conflict detection.
    """
    try:
        return MultiSensorFusionEngine.fuse_observations(db, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/fusion/events", response_model=List[SensorFusionEventResponse])
def get_fused_events(
    site_id: Optional[str] = None,
    bop_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(SensorFusionEvent)
    if site_id:
        query = query.filter(SensorFusionEvent.site_id == site_id)
    if bop_id:
        query = query.filter(SensorFusionEvent.bop_id == bop_id)
    return query.order_by(SensorFusionEvent.timestamp.desc()).limit(limit).all()

