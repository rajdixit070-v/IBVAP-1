from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.schemas.ai import BoundingBox

class RiskFactor(BaseModel):
    factor: str
    weight: int
    description: str

class EventTimelineEntry(BaseModel):
    timestamp: str
    message: str

class SecurityEventResponse(BaseModel):
    id: int
    event_id: str
    camera_id: str
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    track_id: int
    object_type: str
    event_type: str
    severity: str
    risk_score: int
    risk_level: str
    status: str
    environment: str
    location_description: Optional[str] = None
    factors: List[RiskFactor] = []
    timeline: List[EventTimelineEntry] = []
    last_bbox: Optional[BoundingBox] = None
    last_direction: Optional[str] = None
    last_speed: float = 0.0
    started_at: datetime
    last_updated_at: datetime

    class Config:
        from_attributes = True

class SecurityEventStatusUpdate(BaseModel):
    status: str = Field(..., description="ACKNOWLEDGED, DISMISSED, RESOLVED")
    comment: Optional[str] = None

class SecurityEventsSummary(BaseModel):
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    total_active: int = 0
    recent_events: List[SecurityEventResponse] = []
