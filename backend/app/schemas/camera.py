from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class CameraBase(BaseModel):
    camera_id: str = Field(..., description="Unique identifier, e.g. CAM-001")
    camera_name: str = Field(..., description="Descriptive camera name")
    description: Optional[str] = None
    bop_site: str = Field(..., description="BOP or Site name, e.g. BOP Alpha")
    site_id: Optional[str] = "SITE-BORDER-NORTH"
    bop_id: Optional[str] = None
    edge_node_id: Optional[str] = "EDGE-BOP-001"
    sector: str = Field(..., description="Sector name, e.g. North Sector")
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rtsp_url: str = Field(..., description="Full RTSP Stream URL")
    username: Optional[str] = None
    stream_type: Optional[str] = "main"
    enabled: bool = True

    @field_validator('rtsp_url')
    def validate_rtsp_url(cls, v):
        v_clean = v.strip()
        valid_prefixes = ("rtsp://", "http://", "https://", "synthetic://")
        if not any(v_clean.startswith(prefix) for prefix in valid_prefixes):
            raise ValueError("Invalid stream URL. Must start with rtsp://, http://, https://, or synthetic://")
        return v_clean

class CameraCreate(CameraBase):
    password: Optional[str] = Field(None, description="Camera password, will be AES-256 encrypted")

class CameraUpdate(BaseModel):
    camera_name: Optional[str] = None
    description: Optional[str] = None
    bop_site: Optional[str] = None
    site_id: Optional[str] = None
    bop_id: Optional[str] = None
    edge_node_id: Optional[str] = None
    sector: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rtsp_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    stream_type: Optional[str] = None
    enabled: Optional[bool] = None

class CameraResponse(BaseModel):
    id: int
    camera_id: str
    camera_name: str
    description: Optional[str] = None
    bop_site: str
    site_id: Optional[str] = None
    bop_id: Optional[str] = None
    edge_node_id: Optional[str] = None
    sector: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rtsp_url: str  # Masked version
    username: Optional[str] = None
    has_password: bool = False
    stream_type: str
    resolution: Optional[str] = None
    fps: float = 0.0
    codec: Optional[str] = None
    enabled: bool
    status: str
    last_seen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CameraTestRequest(BaseModel):
    rtsp_url: str = Field(..., description="RTSP URL to test")
    username: Optional[str] = None
    password: Optional[str] = None
    timeout_sec: Optional[float] = 8.0

class CameraTestResponse(BaseModel):
    success: bool
    connected: bool
    resolution: Optional[str] = None
    fps: Optional[float] = None
    codec: Optional[str] = None
    latency_ms: Optional[float] = None
    error_type: Optional[str] = None   # CONNECTION_REFUSED, AUTHENTICATION_FAILED, INVALID_RTSP_URL, TIMEOUT, STREAM_UNAVAILABLE, DECODER_ERROR, UNKNOWN_ERROR
    error_message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
