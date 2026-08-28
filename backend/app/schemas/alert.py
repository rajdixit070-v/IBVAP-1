from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AlertBase(BaseModel):
    alert_id: str
    event_id: str
    camera_id: str
    bop_site: str
    title: str
    priority: str
    risk_score: int
    status: str
    assigned_to: Optional[str] = None
    is_escalated: bool = False

class AlertAcknowledgeRequest(BaseModel):
    acknowledged_by: Optional[str] = "operator"

class AlertEscalateRequest(BaseModel):
    reason: Optional[str] = "Manual operator escalation"

class AlertResolveRequest(BaseModel):
    resolved_by: Optional[str] = "operator"
    notes: Optional[str] = "Incident resolved and cleared"

class AlertResponse(AlertBase):
    id: int
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    escalation_deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AlertSummary(BaseModel):
    critical_alerts: int = 0
    high_alerts: int = 0
    medium_alerts: int = 0
    unacknowledged_alerts: int = 0
    recent_alerts: List[AlertResponse] = []
