from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class DroneBase(BaseModel):
    drone_id: str
    name: str
    model: str = "BorderGuardian-X8"
    site_id: str = "SITE-BORDER-NORTH"
    bop_id: Optional[str] = "BOP-ALPHA"
    status: str = "AVAILABLE"
    battery_pct: float = 98.0
    latitude: float = 31.6240
    longitude: float = 74.8720
    altitude_m: float = 50.0
    heading_deg: float = 0.0
    speed_mps: float = 0.0
    flight_state: str = "HOVER"
    gps_satellites: int = 16
    link_quality_pct: float = 95.0
    camera_stream_url: Optional[str] = None
    camera_gimbal_pitch: float = -45.0
    capabilities_json: Optional[str] = '{"has_thermal": true, "max_speed_mps": 22.0, "max_range_m": 10000, "max_flight_time_min": 45}'

class DroneCreate(DroneBase):
    pass

class DroneUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    battery_pct: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude_m: Optional[float] = None
    heading_deg: Optional[float] = None
    speed_mps: Optional[float] = None
    flight_state: Optional[str] = None
    gps_satellites: Optional[int] = None
    link_quality_pct: Optional[float] = None
    camera_stream_url: Optional[str] = None
    camera_gimbal_pitch: Optional[float] = None

class DroneResponse(DroneBase):
    id: int
    last_seen_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DroneTelemetryUpdate(BaseModel):
    latitude: float
    longitude: float
    altitude_m: float
    heading_deg: float
    speed_mps: float
    battery_pct: float
    flight_state: str
    gps_satellites: int
    link_quality_pct: float
    camera_gimbal_pitch: Optional[float] = None

class DroneMissionCreate(BaseModel):
    drone_id: str
    site_id: str = "SITE-BORDER-NORTH"
    bop_id: Optional[str] = "BOP-ALPHA"
    mission_type: str = "PATROL" # PATROL, INTERCEPT, TRACK_TARGET, RECONNAISSANCE, EMERGENCY_RESPONSE
    priority: str = "HIGH"
    objective: str
    target_track_id: Optional[int] = None
    global_track_id: Optional[str] = None
    waypoints_json: Optional[str] = '[]'
    geofence_boundary_json: Optional[str] = '[]'
    max_duration_sec: Optional[int] = 1800
    min_battery_threshold: Optional[float] = 25.0

class DroneMissionResponse(BaseModel):
    id: int
    mission_id: str
    drone_id: str
    site_id: str
    bop_id: Optional[str] = None
    mission_type: str
    status: str
    priority: str
    objective: str
    target_track_id: Optional[int] = None
    global_track_id: Optional[str] = None
    waypoints_json: str
    geofence_boundary_json: str
    max_duration_sec: int
    min_battery_threshold: float
    dispatched_by_user: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    abort_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DroneHandoffRequest(BaseModel):
    source_type: str # CAMERA or DRONE
    source_id: str
    destination_type: str # DRONE or CAMERA
    destination_id: str
    global_track_id: str
    target_class: Optional[str] = "PERSON"
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    reason: Optional[str] = "Target leaving ground camera field of view"
    evidence_json: Optional[str] = "{}"

class DroneHandoffResponse(BaseModel):
    handoff_id: str
    source_type: str
    source_id: str
    destination_type: str
    destination_id: str
    global_track_id: str
    target_class: str
    confidence: float
    reason: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    timestamp: datetime

    class Config:
        from_attributes = True

