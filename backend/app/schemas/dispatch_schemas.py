from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class BOPDispatchCreate(BaseModel):
    title: str
    summary: str
    bop_id: Optional[str] = None
    site_id: Optional[str] = "SITE-BORDER-NORTH"
    priority: Optional[str] = "ROUTINE"
    detected_persons_count: Optional[int] = 0
    vehicles_scanned_count: Optional[int] = 0
    alerts_count: Optional[int] = 0
    evidence_ids: Optional[List[str]] = []

class BOPDispatchAcknowledge(BaseModel):
    status: Optional[str] = "ACKNOWLEDGED_BY_HQ"
    hq_notes: str

class QuickEvidenceSend(BaseModel):
    evidence_id: str
    priority: Optional[str] = "URGENT"
    officer_notes: Optional[str] = None

class BOPDispatchResponse(BaseModel):
    id: int
    dispatch_id: str
    bop_id: str
    site_id: str
    officer_username: str
    title: str
    summary: str
    priority: str
    status: str
    detected_persons_count: int
    vehicles_scanned_count: int
    alerts_count: int
    evidence_ids: str
    hq_notes: Optional[str] = None
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime
    evidence_items: Optional[List[Any]] = []

    class Config:
        from_attributes = True
