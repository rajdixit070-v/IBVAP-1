from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime

class NormalizedPoint(BaseModel):
    x: float = Field(..., ge=0.0, le=1.0, description="Normalized X coordinate (0.0 - 1.0)")
    y: float = Field(..., ge=0.0, le=1.0, description="Normalized Y coordinate (0.0 - 1.0)")

class SecurityZoneBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    zone_type: str = Field("RESTRICTED", description="RESTRICTED, HIGH_SECURITY, BUFFER, MONITORING, CUSTOM")
    polygon: List[NormalizedPoint] = Field(..., min_items=3, description="List of at least 3 vertices forming a closed polygon")
    monitored_classes: List[str] = Field(default=["person", "vehicle"], description="List of classes e.g. ['person', 'vehicle', 'animal', 'drone']")
    direction_rule: str = Field("NONE", description="Forbidden direction e.g. SOUTH, SOUTH_WEST, NONE")
    severity: str = Field("HIGH", description="LOW, MEDIUM, HIGH, CRITICAL")
    enabled: bool = True

    @validator('polygon')
    def validate_polygon_length(cls, v):
        if len(v) < 3:
            raise ValueError("A security zone polygon must contain at least 3 points.")
        return v

class SecurityZoneCreate(SecurityZoneBase):
    camera_id: str

class SecurityZoneUpdate(BaseModel):
    name: Optional[str] = None
    zone_type: Optional[str] = None
    polygon: Optional[List[NormalizedPoint]] = None
    monitored_classes: Optional[List[str]] = None
    direction_rule: Optional[str] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None

class SecurityZoneResponse(BaseModel):
    id: int
    zone_id: str
    camera_id: str
    name: str
    zone_type: str
    polygon: List[NormalizedPoint]
    monitored_classes: List[str]
    direction_rule: str
    severity: str
    enabled: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
