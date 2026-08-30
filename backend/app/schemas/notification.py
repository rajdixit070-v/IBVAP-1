from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class NotificationResponse(BaseModel):
    id: int
    user_id: str
    alert_id: Optional[str] = None
    incident_id: Optional[str] = None
    title: str
    message: str
    priority: str
    read: bool
    evidence_id: Optional[str] = None
    evidence_url: Optional[str] = None
    camera_id: Optional[str] = None
    location_description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
