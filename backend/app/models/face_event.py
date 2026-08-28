from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class FaceEvent(Base):
    __tablename__ = "face_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False)
    camera_id = Column(String(50), index=True, nullable=False)
    track_id = Column(Integer, index=True, nullable=False)
    
    # Match Status: AUTHORIZED_MATCH, WATCHLIST_POTENTIAL_MATCH, UNKNOWN, NO_MATCH, LOW_QUALITY
    match_status = Column(String(50), default="UNKNOWN", index=True, nullable=False)
    
    matched_person_id = Column(String(50), nullable=True)
    matched_person_name = Column(String(100), nullable=True)
    matched_category = Column(String(50), nullable=True) # AUTHORIZED, WATCHLIST, MONITOR
    
    similarity_score = Column(Float, default=0.0) # Cosine similarity 0.0 - 1.0
    quality_score = Column(Float, default=1.0)    # Quality factor 0.0 - 1.0
    
    # Human Verification State: PENDING, VERIFIED, DISMISSED
    verification_status = Column(String(30), default="PENDING", index=True)
    verification_notes = Column(Text, nullable=True)
    
    snapshot_url = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

# Compound index for operational filtering
Index("idx_face_cam_match_time", FaceEvent.camera_id, FaceEvent.match_status, FaceEvent.timestamp)
