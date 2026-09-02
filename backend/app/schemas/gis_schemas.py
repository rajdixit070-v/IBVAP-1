from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class GISLayerResponse(BaseModel):
    layer_id: str
    name: str
    layer_type: str
    site_id: str
    is_visible: bool
    opacity: float
    features_geojson: str
    config_json: str

    class Config:
        from_attributes = True

class GISLayerUpdate(BaseModel):
    is_visible: Optional[bool] = None
    opacity: Optional[float] = None
    features_geojson: Optional[str] = None
    config_json: Optional[str] = None

class CameraFOVUpdate(BaseModel):
    heading_deg: Optional[float] = None
    horizontal_fov_deg: Optional[float] = None
    vertical_fov_deg: Optional[float] = None
    range_meters: Optional[float] = None
    mount_height_m: Optional[float] = None
    tilt_deg: Optional[float] = None

class CameraFOVResponse(BaseModel):
    fov_id: str
    camera_id: str
    site_id: str
    bop_id: Optional[str] = None
    latitude: float
    longitude: float
    heading_deg: float
    horizontal_fov_deg: float
    vertical_fov_deg: float
    range_meters: float
    mount_height_m: float
    tilt_deg: float
    polygon_geojson: str
    updated_at: datetime

    class Config:
        from_attributes = True

class SectorCoverageResponse(BaseModel):
    coverage_id: str
    site_id: str
    bop_id: Optional[str] = None
    sector_name: str
    total_area_sqm: float
    covered_area_sqm: float
    coverage_percentage: float
    blind_area_sqm: float
    overlap_area_sqm: float
    calculated_at: datetime

    class Config:
        from_attributes = True

class BlindSpotResponse(BaseModel):
    blind_spot_id: str
    site_id: str
    bop_id: Optional[str] = None
    sector_name: str
    polygon_geojson: str
    area_sqm: float
    risk_level: str
    risk_score: int
    priority_rank: int
    proximity_to_border_m: float
    terrain_factor: str
    incident_history_count: int
    recommendations_json: str
    is_acknowledged: bool
    created_at: datetime

    class Config:
        from_attributes = True

class TerrainQueryRequest(BaseModel):
    latitude: float
    longitude: float
    radius_m: Optional[float] = 500.0

class TerrainQueryResponse(BaseModel):
    latitude: float
    longitude: float
    elevation_m: Optional[float] = None
    slope_deg: Optional[float] = None
    aspect_deg: Optional[float] = None
    terrain_class: str # FLAT, HILLY, MOUNTAINOUS, RAVINE, RIVERBED
    status: str # AVAILABLE or TERRAIN_DATA_UNAVAILABLE

