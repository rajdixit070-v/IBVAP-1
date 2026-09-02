from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class CameraPairBase(BaseModel):
    pair_id: str
    rgb_camera_id: str
    thermal_camera_id: str
    site_id: str = "SITE-BORDER-NORTH"
    bop_id: Optional[str] = "BOP-ALPHA"
    calibration_transform_json: Optional[str] = '{"homography": [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]], "scale_x": 1.0, "scale_y": 1.0, "offset_x": 0, "offset_y": 0, "rotation_deg": 0.0}'
    overlap_area_json: Optional[str] = '[{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 0.0}, {"x": 1.0, "y": 1.0}, {"x": 0.0, "y": 1.0}]'
    overlap_ratio: Optional[float] = 0.85
    sync_tolerance_ms: Optional[float] = 100.0
    fusion_mode: Optional[str] = "FUSED" # RGB_ONLY, THERMAL_ONLY, FUSED
    status: Optional[str] = "ACTIVE"

class CameraPairCreate(CameraPairBase):
    pass

class CameraPairUpdate(BaseModel):
    calibration_transform_json: Optional[str] = None
    overlap_area_json: Optional[str] = None
    overlap_ratio: Optional[float] = None
    sync_tolerance_ms: Optional[float] = None
    fusion_mode: Optional[str] = None
    status: Optional[str] = None
    degradation_reason: Optional[str] = None

class CameraPairResponse(CameraPairBase):
    id: int
    degradation_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ThermalFusionExecutionRequest(BaseModel):
    pair_id: str
    rgb_detections: List[Dict[str, Any]] # [{"class": "person", "confidence": 0.80, "bbox": [0.1, 0.2, 0.3, 0.4]}]
    thermal_detections: List[Dict[str, Any]] # [{"class": "person", "confidence": 0.95, "bbox": [0.12, 0.21, 0.29, 0.38], "temp_c": 37.2}]
    lighting_condition: Optional[str] = "DAY" # DAY, NIGHT, LOW_LIGHT, FOG

class ThermalFusionResultResponse(BaseModel):
    result_id: str
    pair_id: str
    rgb_camera_id: str
    thermal_camera_id: str
    rgb_confidence: float
    thermal_confidence: float
    fused_confidence: float
    fusion_mode_applied: str
    lighting_condition: str
    detections_json: str
    has_heat_anomaly: bool
    has_thermal_obstruction: bool
    timestamp: datetime

    class Config:
        from_attributes = True

