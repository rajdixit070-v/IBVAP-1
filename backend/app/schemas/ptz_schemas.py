from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class PTZDeviceResponse(BaseModel):
    device_id: str
    camera_id: str
    onvif_endpoint: Optional[str] = None
    onvif_port: int
    onvif_profile_token: str
    supports_continuous_move: bool
    supports_absolute_move: bool
    supports_presets: bool
    pan_min: float
    pan_max: float
    tilt_min: float
    tilt_max: float
    zoom_min: float
    zoom_max: float
    current_pan: float
    current_tilt: float
    current_zoom: float
    status: str
    is_locked: bool
    locked_by_user: Optional[str] = None
    tracking_target_id: Optional[str] = None
    auto_track_enabled: bool

    class Config:
        from_attributes = True

class PTZMoveRequest(BaseModel):
    move_type: str = "CONTINUOUS" # CONTINUOUS, ABSOLUTE, RELATIVE
    pan_speed: Optional[float] = 0.0 # -1.0 to 1.0 (or absolute deg)
    tilt_speed: Optional[float] = 0.0 # -1.0 to 1.0 (or absolute deg)
    zoom_speed: Optional[float] = 0.0 # -1.0 to 1.0 (or absolute factor)
    timeout_sec: Optional[float] = 2.0

class PTZPresetCreate(BaseModel):
    preset_name: str
    pan: Optional[float] = None
    tilt: Optional[float] = None
    zoom: Optional[float] = None
    fov_heading_deg: Optional[float] = 0.0

class PTZPresetResponse(BaseModel):
    preset_id: str
    camera_id: str
    preset_token: str
    preset_name: str
    pan: float
    tilt: float
    zoom: float
    fov_heading_deg: float
    created_at: datetime

    class Config:
        from_attributes = True

class PTZAutoTrackRequest(BaseModel):
    enable: bool
    target_id: Optional[str] = None # Track ID or bounding box coordinates
    bbox: Optional[List[float]] = None # [x, y, w, h] normalized in 0..1
    max_zoom: Optional[float] = 10.0
    timeout_lost_sec: Optional[float] = 5.0

class ONVIFDiscoveryResult(BaseModel):
    camera_id: str
    device_ip: str
    onvif_endpoint: str
    manufacturer: str
    model: str
    firmware_version: str
    profiles: List[str]
    supports_ptz: bool

