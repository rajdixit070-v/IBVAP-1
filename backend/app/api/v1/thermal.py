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

def seed_initial_thermal_pairs_if_empty(db: Session):
    from app.models.camera import Camera
    all_cams = db.query(Camera).all()
    valid_cam_ids = {c.camera_id for c in all_cams}

    # 1. Clean up or re-link orphan pairs that point to non-existent cameras
    orphan_pairs = db.query(CameraPair).all()
    for p in orphan_pairs:
        rgb_invalid = p.rgb_camera_id not in valid_cam_ids
        th_invalid = p.thermal_camera_id not in valid_cam_ids
        if rgb_invalid or th_invalid:
            if len(all_cams) >= 2:
                p.rgb_camera_id = all_cams[0].camera_id
                p.thermal_camera_id = all_cams[1].camera_id
            elif len(all_cams) == 1:
                p.rgb_camera_id = all_cams[0].camera_id
                p.thermal_camera_id = all_cams[0].camera_id
            else:
                db.delete(p)
    db.commit()

    # 2. If no pairs exist, create a pair using ACTUAL registered cameras
    if db.query(CameraPair).count() == 0 and len(all_cams) >= 1:
        rgb_cam = all_cams[0]
        th_cam = next((c for c in all_cams if c.stream_type == "thermal"), all_cams[1] if len(all_cams) > 1 else all_cams[0])
        pair_id = f"PAIR-{rgb_cam.camera_id[:8]}-{th_cam.camera_id[:8]}".replace("--", "-").upper()
        
        db.add(CameraPair(
            pair_id=pair_id,
            rgb_camera_id=rgb_cam.camera_id,
            thermal_camera_id=th_cam.camera_id,
            site_id=rgb_cam.site_id or "SITE-BORDER-NORTH",
            bop_id=rgb_cam.bop_site or "BOP-WAGAH",
            overlap_ratio=0.90,
            sync_tolerance_ms=80.0,
            fusion_mode="FUSED",
            status="ACTIVE"
        ))
        db.commit()

@router.get("/pairs", response_model=List[CameraPairResponse])
def list_camera_pairs(
    site_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    seed_initial_thermal_pairs_if_empty(db)
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

@router.delete("/pairs/{pair_id}", status_code=status.HTTP_200_OK)
def delete_camera_pair(
    pair_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = ThermalRGBFusionService.delete_pair(db, pair_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"CameraPair '{pair_id}' not found.")
    return {"message": f"CameraPair '{pair_id}' deleted successfully."}

@router.delete("/fusion/results", status_code=status.HTTP_200_OK)
def clear_thermal_fusion_results(
    pair_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = ThermalRGBFusionService.clear_fusion_results(db, pair_id=pair_id)
    return {"message": f"Cleared {count} thermal fusion results."}

@router.delete("/fusion/results/{result_id}", status_code=status.HTTP_200_OK)
def delete_single_fusion_result(
    result_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = ThermalRGBFusionService.delete_single_result(db, result_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Result '{result_id}' not found.")
    return {"message": f"Result '{result_id}' deleted successfully."}

