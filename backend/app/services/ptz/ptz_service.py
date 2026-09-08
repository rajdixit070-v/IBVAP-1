import json
import logging
import uuid
import time
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.ptz_models import PTZDevice, PTZPreset, PTZAuditLog
from app.models.camera import Camera
from app.schemas.ptz_schemas import PTZMoveRequest, PTZPresetCreate, PTZAutoTrackRequest
from app.services.ptz.onvif_adapter import onvif_adapter

logger = logging.getLogger("ibvap.services.ptz")

class PTZTrackingService:
    """
    Module 3: PTZ Camera Control, Preset Automation, and Safe Auto-Tracking Service.
    """

    @staticmethod
    def get_or_create_device(db: Session, camera_id: str) -> PTZDevice:
        dev = db.query(PTZDevice).filter(PTZDevice.camera_id == camera_id).first()
        if not dev:
            dev = PTZDevice(
                device_id=f"PTZ-{camera_id}",
                camera_id=camera_id,
                onvif_endpoint=f"http://192.168.1.100/onvif/device_service",
                onvif_port=80,
                onvif_profile_token="Profile_1",
                supports_continuous_move=True,
                supports_absolute_move=True,
                supports_presets=True,
                status="READY",
                current_pan=0.0,
                current_tilt=0.0,
                current_zoom=1.0,
                auto_track_enabled=False
            )
            db.add(dev)
            db.commit()
            db.refresh(dev)
        return dev

    @staticmethod
    def get_device_status(db: Session, camera_id: str) -> Dict[str, Any]:
        dev = PTZTrackingService.get_or_create_device(db, camera_id)
        hw_status = onvif_adapter.get_status(camera_id)
        
        dev.current_pan = hw_status["pan"]
        dev.current_tilt = hw_status["tilt"]
        dev.current_zoom = hw_status["zoom"]
        dev.status = hw_status["status"]
        db.commit()

        return {
            "device_id": dev.device_id,
            "camera_id": dev.camera_id,
            "onvif_endpoint": dev.onvif_endpoint,
            "onvif_port": dev.onvif_port,
            "onvif_profile_token": dev.onvif_profile_token,
            "supports_continuous_move": dev.supports_continuous_move,
            "supports_absolute_move": dev.supports_absolute_move,
            "supports_presets": dev.supports_presets,
            "pan_min": dev.pan_min,
            "pan_max": dev.pan_max,
            "tilt_min": dev.tilt_min,
            "tilt_max": dev.tilt_max,
            "zoom_min": dev.zoom_min,
            "zoom_max": dev.zoom_max,
            "current_pan": dev.current_pan,
            "current_tilt": dev.current_tilt,
            "current_zoom": dev.current_zoom,
            "status": dev.status,
            "is_locked": dev.is_locked,
            "locked_by_user": dev.locked_by_user,
            "tracking_target_id": dev.tracking_target_id,
            "auto_track_enabled": dev.auto_track_enabled
        }

    @staticmethod
    def move_camera(
        db: Session,
        camera_id: str,
        move_req: PTZMoveRequest,
        user_id: str = "operator"
    ) -> Dict[str, Any]:
        dev = PTZTrackingService.get_or_create_device(db, camera_id)
        
        # Check operator lock
        if dev.is_locked and dev.locked_by_user and dev.locked_by_user != user_id:
            if dev.lock_expires_at and dev.lock_expires_at > datetime.utcnow():
                raise PermissionError(f"PTZ camera is currently locked by user '{dev.locked_by_user}'")

        # Manual movement immediately breaks auto-tracking (Operator Override Safety)
        if dev.auto_track_enabled:
            dev.auto_track_enabled = False
            dev.tracking_target_id = None
            logger.info(f"[{camera_id}] Operator override: Disabled auto-tracking.")

        if move_req.move_type == "ABSOLUTE":
            pan = max(-180.0, min(180.0, move_req.pan_speed or 0.0))
            tilt = max(-90.0, min(90.0, move_req.tilt_speed or 0.0))
            zoom = max(1.0, min(30.0, move_req.zoom_speed or 1.0))
            success = onvif_adapter.absolute_move(camera_id, pan, tilt, zoom)
        else:
            pan = max(-1.0, min(1.0, move_req.pan_speed or 0.0))
            tilt = max(-1.0, min(1.0, move_req.tilt_speed or 0.0))
            zoom = max(-1.0, min(1.0, move_req.zoom_speed or 0.0))
            success = onvif_adapter.continuous_move(camera_id, pan, tilt, zoom, move_req.timeout_sec or 2.0)

        hw_status = onvif_adapter.get_status(camera_id)
        dev.current_pan = hw_status["pan"]
        dev.current_tilt = hw_status["tilt"]
        dev.current_zoom = hw_status["zoom"]
        dev.status = hw_status["status"]
        dev.last_command_at = datetime.utcnow()

        # Record audit trail
        audit = PTZAuditLog(
            camera_id=camera_id,
            user_id=user_id,
            action=f"MOVE_{move_req.move_type}",
            params_json=json.dumps(move_req.model_dump()),
            result="SUCCESS" if success else "FAILED"
        )
        db.add(audit)
        db.commit()

        return {"status": "SUCCESS", "current_position": hw_status}

    @staticmethod
    def stop_camera(db: Session, camera_id: str, user_id: str = "operator") -> Dict[str, Any]:
        dev = PTZTrackingService.get_or_create_device(db, camera_id)
        dev.auto_track_enabled = False
        dev.tracking_target_id = None
        onvif_adapter.stop_move(camera_id)
        
        dev.status = "READY"
        db.commit()
        return {"status": "STOPPED", "camera_id": camera_id}

    @staticmethod
    def get_presets(db: Session, camera_id: str) -> List[PTZPreset]:
        return db.query(PTZPreset).filter(PTZPreset.camera_id == camera_id).all()

    @staticmethod
    def create_preset(
        db: Session,
        camera_id: str,
        data: PTZPresetCreate,
        user_id: str = "operator"
    ) -> PTZPreset:
        dev = PTZTrackingService.get_or_create_device(db, camera_id)
        pan = data.pan if data.pan is not None else dev.current_pan
        tilt = data.tilt if data.tilt is not None else dev.current_tilt
        zoom = data.zoom if data.zoom is not None else dev.current_zoom

        token = onvif_adapter.set_preset(camera_id, data.preset_name) or f"PRESET-{uuid.uuid4().hex[:6].upper()}"
        preset = PTZPreset(
            preset_id=f"PST-{uuid.uuid4().hex[:10].upper()}",
            camera_id=camera_id,
            preset_token=token,
            preset_name=data.preset_name,
            pan=pan,
            tilt=tilt,
            zoom=zoom,
            fov_heading_deg=data.fov_heading_deg or 0.0
        )
        db.add(preset)
        
        audit = PTZAuditLog(
            camera_id=camera_id,
            user_id=user_id,
            action="CREATE_PRESET",
            params_json=json.dumps({"name": data.preset_name, "token": token}),
            result="SUCCESS"
        )
        db.add(audit)
        db.commit()
        db.refresh(preset)
        return preset

    @staticmethod
    def goto_preset(
        db: Session,
        camera_id: str,
        preset_token: str,
        user_id: str = "operator"
    ) -> bool:
        dev = PTZTrackingService.get_or_create_device(db, camera_id)
        preset = db.query(PTZPreset).filter(PTZPreset.camera_id == camera_id, PTZPreset.preset_token == preset_token).first()
        
        success = onvif_adapter.goto_preset(camera_id, preset_token)
        if success and preset:
            dev.current_pan = preset.pan
            dev.current_tilt = preset.tilt
            dev.current_zoom = preset.zoom
            dev.status = "READY"
        
        audit = PTZAuditLog(
            camera_id=camera_id,
            user_id=user_id,
            action="GOTO_PRESET",
            params_json=json.dumps({"token": preset_token}),
            result="SUCCESS" if success else "FAILED"
        )
        db.add(audit)
        db.commit()
        return success

    @staticmethod
    def delete_preset(
        db: Session,
        camera_id: str,
        preset_token: str,
        user_id: str = "operator"
    ) -> bool:
        preset = db.query(PTZPreset).filter(PTZPreset.camera_id == camera_id, PTZPreset.preset_token == preset_token).first()
        if not preset:
            return False
        db.delete(preset)
        audit = PTZAuditLog(
            camera_id=camera_id,
            user_id=user_id,
            action="DELETE_PRESET",
            params_json=json.dumps({"token": preset_token}),
            result="SUCCESS"
        )
        db.add(audit)
        db.commit()
        return True

    @classmethod
    def execute_auto_track_step(
        cls,
        db: Session,
        camera_id: str,
        request: PTZAutoTrackRequest,
        user_id: str = "system"
    ) -> Dict[str, Any]:
        """
        Calculates proportional steering velocity to keep target centered:
        dx = x_center - 0.5, dy = y_center - 0.5
        """
        dev = cls.get_or_create_device(db, camera_id)
        
        if not request.enable:
            dev.auto_track_enabled = False
            dev.tracking_target_id = None
            dev.status = "READY"
            onvif_adapter.stop_move(camera_id)
            db.commit()
            return {"status": "AUTO_TRACK_DISABLED", "camera_id": camera_id}

        dev.auto_track_enabled = True
        dev.tracking_target_id = request.target_id
        dev.status = "TRACKING"

        bbox = request.bbox # [x, y, w, h] normalized in 0..1
        if not bbox or len(bbox) != 4:
            # Target lost or no coordinates provided
            onvif_adapter.stop_move(camera_id)
            db.commit()
            return {"status": "TRACKING_WAITING_COORDS", "camera_id": camera_id}

        x, y, w, h = bbox
        center_x = x + (w / 2.0)
        center_y = y + (h / 2.0)

        # Calculate error from optical center (0.5, 0.5)
        error_x = center_x - 0.5
        error_y = center_y - 0.5

        # Proportional controller with deadband to prevent continuous jitter
        deadband = 0.06
        pan_vel = 0.0
        tilt_vel = 0.0

        if abs(error_x) > deadband:
            pan_vel = max(-0.8, min(0.8, error_x * 1.5))
        if abs(error_y) > deadband:
            # Invert tilt because top of image is y=0
            tilt_vel = max(-0.8, min(0.8, -error_y * 1.5))

        # Optical Zoom auto-scaling
        box_area = w * h
        zoom_vel = 0.0
        if box_area < 0.03 and dev.current_zoom < (request.max_zoom or 15.0):
            zoom_vel = 0.3 # Zoom in on small distant targets
        elif box_area > 0.25 and dev.current_zoom > 1.2:
            zoom_vel = -0.3 # Zoom out if target fills frame

        onvif_adapter.continuous_move(camera_id, pan_vel, tilt_vel, zoom_vel, timeout_sec=1.0)
        hw_status = onvif_adapter.get_status(camera_id)

        # Check boundary handoff condition (Target nearing edge of FOV)
        handoff_needed = (x < 0.06 or x + w > 0.94 or y < 0.06 or y + h > 0.94)
        predicted_next_cam = "CAM-002" if camera_id == "CAM-001" else "CAM-001"

        db.commit()
        return {
            "status": "TRACKING_ACTIVE",
            "camera_id": camera_id,
            "target_id": request.target_id,
            "steering": {"pan_vel": round(pan_vel, 2), "tilt_vel": round(tilt_vel, 2), "zoom_vel": round(zoom_vel, 2)},
            "current_position": hw_status,
            "handoff_candidate": {"needed": handoff_needed, "predicted_camera": predicted_next_cam if handoff_needed else None}
        }

