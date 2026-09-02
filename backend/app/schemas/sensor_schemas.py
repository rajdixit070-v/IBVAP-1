from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class SensorBase(BaseModel):
    sensor_id: str
    name: str
    sensor_type: str # CAMERA, THERMAL, RADAR, ACOUSTIC, SEISMIC, WEATHER, DRONE, OTHER
    site_id: str = "SITE-BORDER-NORTH"
    bop_id: Optional[str] = "BOP-ALPHA"
    sector: str
    zone_id: Optional[str] = None
    camera_id: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude_m: Optional[float] = 0.0
    status: str = "ONLINE"
    health_score: Optional[float] = 100.0
    latency_ms: Optional[float] = 20.0
    packet_loss_pct: Optional[float] = 0.0
    battery_pct: Optional[float] = None
    temperature_c: Optional[float] = 24.0
    signal_quality_pct: Optional[float] = 95.0
    capabilities_json: Optional[str] = "{}"
    config_json: Optional[str] = "{}"
    reliability_weight: Optional[float] = 0.90

class SensorCreate(SensorBase):
    pass

class SensorUpdate(BaseModel):
    name: Optional[str] = None
    sensor_type: Optional[str] = None
    sector: Optional[str] = None
    zone_id: Optional[str] = None
    camera_id: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude_m: Optional[float] = None
    status: Optional[str] = None
    health_score: Optional[float] = None
    latency_ms: Optional[float] = None
    packet_loss_pct: Optional[float] = None
    battery_pct: Optional[float] = None
    temperature_c: Optional[float] = None
    signal_quality_pct: Optional[float] = None
    capabilities_json: Optional[str] = None
    config_json: Optional[str] = None
    reliability_weight: Optional[float] = None

class SensorResponse(SensorBase):
    id: int
    last_seen_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SensorTelemetryCreate(BaseModel):
    sensor_id: str
    battery_pct: Optional[float] = None
    temperature_c: Optional[float] = None
    signal_strength_dbm: Optional[float] = None
    status: Optional[str] = "ONLINE"
    reading_value: Optional[float] = None
    reading_unit: Optional[str] = None
    raw_payload_json: Optional[str] = "{}"

class SensorTelemetryResponse(BaseModel):
    telemetry_id: str
    sensor_id: str
    timestamp: datetime
    battery_pct: Optional[float] = None
    temperature_c: Optional[float] = None
    signal_strength_dbm: Optional[float] = None
    status: str
    reading_value: Optional[float] = None
    reading_unit: Optional[str] = None
    raw_payload_json: Optional[str] = "{}"

    class Config:
        from_attributes = True

class MultiSensorFusionRequest(BaseModel):
    site_id: str = "SITE-BORDER-NORTH"
    bop_id: Optional[str] = "BOP-ALPHA"
    sector: Optional[str] = None
    observations: List[Dict[str, Any]] # [{"sensor_id": "RAD-01", "sensor_type": "RADAR", "detection": "VEHICLE", "confidence": 0.91, "timestamp": "...", "location": {"lat": 31.62, "lng": 74.87}}]
    time_window_sec: Optional[float] = 5.0
    spatial_radius_m: Optional[float] = 100.0

class SensorFusionEventResponse(BaseModel):
    fusion_event_id: str
    site_id: str
    bop_id: Optional[str] = None
    sector: Optional[str] = None
    zone_id: Optional[str] = None
    fused_event_type: str
    confidence: float
    confidence_level: str
    conflict_status: str
    fusion_method: str
    source_sensor_ids_json: str
    individual_observations_json: str
    confidence_explanation_json: str
    location_json: str
    track_id: Optional[int] = None
    global_track_id: Optional[str] = None
    risk_score: int
    is_acknowledged: bool
    timestamp: datetime

    class Config:
        from_attributes = True

