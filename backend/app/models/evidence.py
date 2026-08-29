from sqlalchemy import Column, Integer, String, BigInteger, DateTime, Index
from datetime import datetime
from app.database import Base

class Evidence(Base):
    __tablename__ = "evidence_records"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. EVD-2026-000101
    source_event_id = Column(String(50), index=True, nullable=True)
    incident_id = Column(String(50), index=True, nullable=True)
    camera_id = Column(String(50), index=True, nullable=False)
    
    # SNAPSHOT, PLATE_CROP, FACE_CROP, VIDEO_CLIP, TELEMETRY
    evidence_type = Column(String(30), default="SNAPSHOT", nullable=False)
    
    file_path = Column(String(500), nullable=False)
    checksum_sha256 = Column(String(64), nullable=True) # SHA-256 integrity hash (None if no actual evidence bytes)
    mime_type = Column(String(50), default="image/jpeg")
    file_size_bytes = Column(BigInteger, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

Index("idx_evidence_incident_event", Evidence.incident_id, Evidence.source_event_id)
