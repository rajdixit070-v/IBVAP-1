from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class CameraHealthStatus(BaseModel):
    camera_id: str
    status: str                         # HEALTHY, DEGRADED, OFFLINE, ERROR, CONNECTING
    is_streaming: bool
    fps: float
    resolution: Optional[str] = None
    latest_frame_time: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    reconnect_attempts: int = 0
    latency_ms: Optional[float] = None
    error_message: Optional[str] = None

class CameraSummaryStats(BaseModel):
    total_cameras: int
    healthy: int
    degraded: int
    offline: int
    error: int
    bop_summary: Dict[str, Dict[str, int]]

class CameraDiagnosticLogResponse(BaseModel):
    id: int
    camera_id: str
    event_type: str
    status: str
    details: Optional[str] = None
    fps: float
    timestamp: datetime

    class Config:
        from_attributes = True
