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
    created_at: datetime

    class Config:
        from_attributes = True
