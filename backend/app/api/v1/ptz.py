from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.ptz_schemas import (
    PTZDeviceResponse,
    PTZMoveRequest,
    PTZPresetCreate,
    PTZPresetResponse,
    PTZAutoTrackRequest,
    ONVIFDiscoveryResult
)
from app.api.deps import get_current_user, require_admin
from app.services.ptz.ptz_service import PTZTrackingService
from app.services.ptz.onvif_adapter import onvif_adapter

router = APIRouter(prefix="/ptz", tags=["PTZ & ONVIF Control"])

@router.get("/discover", response_model=List[ONVIFDiscoveryResult])
def discover_onvif_cameras(
    timeout_sec: float = 3.0,
    current_user: User = Depends(get_current_user)
):
    """
    Scans local perimeter network for ONVIF-compliant IP cameras and PTZ devices.
    """
    return onvif_adapter.discover_devices(timeout_sec=timeout_sec)

@router.get("/{camera_id}/status", response_model=PTZDeviceResponse)
def get_ptz_status(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return PTZTrackingService.get_device_status(db, camera_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{camera_id}/move")
def move_ptz_camera(
    camera_id: str,
    move_req: PTZMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Execute manual Pan/Tilt/Zoom continuous or absolute steering with operator audit logging.
    """
    try:
        return PTZTrackingService.move_camera(db, camera_id, move_req, user_id=current_user.username)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{camera_id}/stop")
def stop_ptz_camera(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return PTZTrackingService.stop_camera(db, camera_id, user_id=current_user.username)

@router.get("/{camera_id}/presets", response_model=List[PTZPresetResponse])
def get_ptz_presets(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return PTZTrackingService.get_presets(db, camera_id)

@router.post("/{camera_id}/presets", response_model=PTZPresetResponse, status_code=status.HTTP_201_CREATED)
def create_ptz_preset(
    camera_id: str,
    data: PTZPresetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return PTZTrackingService.create_preset(db, camera_id, data, user_id=current_user.username)

@router.post("/{camera_id}/presets/{token}/goto")
def goto_ptz_preset(
    camera_id: str,
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = PTZTrackingService.goto_preset(db, camera_id, token, user_id=current_user.username)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Preset '{token}' not found on camera '{camera_id}'.")
    return {"status": "SUCCESS", "camera_id": camera_id, "preset_token": token}

@router.post("/{camera_id}/auto-track")
def auto_track_target(
    camera_id: str,
    request: PTZAutoTrackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Engages ByteTrack-driven proportional steering and auto-zoom centering on target.
    """
    return PTZTrackingService.execute_auto_track_step(db, camera_id, request, user_id=current_user.username)

