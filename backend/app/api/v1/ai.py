from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.camera import Camera
from app.models.ai_config import CameraAIConfig
from app.schemas.ai import (
    CameraAIStatus,
    CameraAIConfigSchema,
    CameraAIConfigUpdate,
    TrackedObject,
    ModelStatusItem
)
from app.services.ai.pipeline import ai_pipeline_manager
from app.services.ai.model_provisioning import get_ai_models_status

router = APIRouter(prefix="/ai", tags=["AI Inference Pipeline"])

@router.get("/status", response_model=List[CameraAIStatus])
def get_all_ai_statuses(
    current_user: User = Depends(get_current_user)
):
    """Retrieves real-time AI inference statuses for all active cameras."""
    return ai_pipeline_manager.get_all_statuses()

@router.get("/cameras/{camera_id}/status", response_model=CameraAIStatus)
def get_camera_ai_status(
    camera_id: str,
    current_user: User = Depends(get_current_user)
):
    """Retrieves detailed AI telemetry and performance metrics for a camera."""
    return ai_pipeline_manager.get_camera_status(camera_id)

@router.post("/cameras/{camera_id}/enable")
def enable_camera_ai(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Enables AI inference and tracking on the specified camera stream."""
    camera = db.query(Camera).filter(Camera.camera_id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found.")
    
    ai_pipeline_manager.enable_camera(camera_id)
    return {"message": f"AI inference enabled for camera {camera_id}", "status": "ACTIVE"}

@router.post("/cameras/{camera_id}/disable")
def disable_camera_ai(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Disables/pauses AI inference on the specified camera stream."""
    camera = db.query(Camera).filter(Camera.camera_id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found.")
    
    ai_pipeline_manager.disable_camera(camera_id)
    return {"message": f"AI inference disabled for camera {camera_id}", "status": "PAUSED"}

@router.get("/cameras/{camera_id}/tracks")
def get_camera_active_tracks(
    camera_id: str,
    current_user: User = Depends(get_current_user)
):
    """Returns the list of currently active confirmed tracks and trajectories for a camera."""
    return ai_pipeline_manager.get_camera_tracks(camera_id)

@router.get("/cameras/{camera_id}/config", response_model=CameraAIConfigSchema)
def get_camera_ai_config(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetches AI detection thresholds and tracking configuration for a camera."""
    config = db.query(CameraAIConfig).filter(CameraAIConfig.camera_id == camera_id).first()
    if not config:
        # Create default config
        config = CameraAIConfig(
            camera_id=camera_id,
            enabled=True,
            model_name="yolov8n",
            target_fps=10.0,
            input_size=640,
            device="auto",
            conf_person=0.40,
            conf_vehicle=0.45,
            conf_animal=0.35,
            conf_drone=0.30,
            conf_other=0.40,
            track_thresh=0.45,
            match_thresh=0.70,
            max_lost_frames=30,
            max_trajectory_length=30
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.put("/cameras/{camera_id}/config", response_model=CameraAIConfigSchema)
def update_camera_ai_config(
    camera_id: str,
    update_data: CameraAIConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Updates AI detection thresholds, target FPS, or model parameters for a camera."""
    config = db.query(CameraAIConfig).filter(CameraAIConfig.camera_id == camera_id).first()
    if not config:
        config = CameraAIConfig(camera_id=camera_id)
        db.add(config)

    for field, val in update_data.dict(exclude_unset=True).items():
        setattr(config, field, val)

    db.commit()
    db.refresh(config)

    # Apply thresholds and worker settings dynamically to specific camera worker
    ai_pipeline_manager.update_camera_config(camera_id, config)

    # Also update global detector thresholds
    thresholds = {
        "person": config.conf_person,
        "vehicle": config.conf_vehicle,
        "animal": config.conf_animal,
        "drone": config.conf_drone,
        "other": config.conf_other
    }
    ai_pipeline_manager.update_thresholds(thresholds)

    return config

@router.get("/metrics")
def get_ai_metrics(
    current_user: User = Depends(get_current_user)
):
    """Returns fleet-wide aggregated AI inference telemetry."""
    statuses = ai_pipeline_manager.get_all_statuses()
    total_processed = sum(s.frames_processed for s in statuses)
    active_workers = sum(1 for s in statuses if s.status == "ACTIVE")
    avg_latency = round(sum(s.latency_ms for s in statuses) / max(1, len(statuses)), 1) if statuses else 0.0
    total_active_tracks = sum(s.active_tracks_count for s in statuses)

    return {
        "active_workers": active_workers,
        "total_cameras_configured": len(statuses),
        "total_frames_processed": total_processed,
        "avg_latency_ms": avg_latency,
        "total_active_tracks": total_active_tracks,
        "model": ai_pipeline_manager.detector.model_name,
        "device": ai_pipeline_manager.detector.device_used
    }

@router.get("/models/status", response_model=List[ModelStatusItem])
@router.get("/model-status", response_model=List[ModelStatusItem])
def get_ai_models_provisioning_status(
    current_user: User = Depends(get_current_user)
):
    """
    Returns truthful, authenticated runtime status for all configured AI models
    (YOLO, SFace Face Biometrics, and Dedicated Drone Detector).
    Exposes: model_name, model_path, configured, file_exists, loaded, status, error.
    Status values: NOT_CONFIGURED, FILE_MISSING, LOADING, LOADED, ERROR.
    """
    is_admin = current_user.role in ["SUPER_ADMIN", "ADMIN", "SITE_ADMIN"]
    return get_ai_models_status(is_admin=is_admin)
