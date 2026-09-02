from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.thermal_fusion_models import CameraPair, ThermalFusionResult
from app.schemas.thermal_schemas import (
    CameraPairCreate,
    CameraPairUpdate,
    CameraPairResponse,
    ThermalFusionExecutionRequest,
    ThermalFusionResultResponse
)
from app.api.deps import get_current_user, require_admin
from app.services.thermal.thermal_fusion_service import ThermalRGBFusionService

router = APIRouter(prefix="/thermal", tags=["Thermal & RGB Fusion"])

@router.get("/pairs", response_model=List[CameraPairResponse])
def list_camera_pairs(
    site_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return ThermalRGBFusionService.get_all_pairs(db, site_id=site_id, status=status)

@router.post("/pairs", response_model=CameraPairResponse, status_code=status.HTTP_201_CREATED)
def create_camera_pair(
    data: CameraPairCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return ThermalRGBFusionService.create_pair(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/pairs/{pair_id}", response_model=CameraPairResponse)
def get_camera_pair(
    pair_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pair = ThermalRGBFusionService.get_pair_by_id(db, pair_id)
    if not pair:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"CameraPair '{pair_id}' not found.")
    return pair

@router.put("/pairs/{pair_id}", response_model=CameraPairResponse)
def update_camera_pair(
    pair_id: str,
    data: CameraPairUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pair = ThermalRGBFusionService.update_pair(db, pair_id, data)
    if not pair:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"CameraPair '{pair_id}' not found.")
    return pair

@router.post("/fusion/execute", response_model=ThermalFusionResultResponse)
def execute_thermal_fusion(
    request: ThermalFusionExecutionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Executes real-time homography spatial alignment and low-light adaptive fusion between RGB and Thermal detections.
    """
    try:
        return ThermalRGBFusionService.execute_fusion(db, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/fusion/results", response_model=List[ThermalFusionResultResponse])
def get_thermal_fusion_results(
    pair_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ThermalFusionResult)
    if pair_id:
        query = query.filter(ThermalFusionResult.pair_id == pair_id)
    return query.order_by(ThermalFusionResult.timestamp.desc()).limit(limit).all()

