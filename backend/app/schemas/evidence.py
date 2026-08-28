from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class EvidenceBase(BaseModel):
    evidence_id: str
    source_event_id: Optional[str] = None
    incident_id: Optional[str] = None
    camera_id: str
    evidence_type: str
    file_path: str
    checksum_sha256: str
    mime_type: str
    file_size_bytes: int

class EvidenceCreate(EvidenceBase):
    pass

class EvidenceResponse(EvidenceBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
