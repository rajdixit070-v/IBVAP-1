from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Index
from datetime import datetime
from app.database import Base

class TrackAssociation(Base):
    __tablename__ = "track_associations"

    id = Column(Integer, primary_key=True, index=True)
    association_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. ASC-20260827-000101
    global_track_id = Column(String(50), index=True, nullable=False)
    from_observation_id = Column(String(50), index=True, nullable=False)
    to_observation_id = Column(String(50), index=True, nullable=False)
    
    from_camera_id = Column(String(50), index=True, nullable=False)
    to_camera_id = Column(String(50), index=True, nullable=False)
    
    association_score = Column(Float, default=0.85) # 0.00 - 1.00
    # Match Category: HIGH_CONFIDENCE_MATCH, MEDIUM_CONFIDENCE_MATCH, LOW_CONFIDENCE_MATCH, NO_MATCH
    match_category = Column(String(40), default="HIGH_CONFIDENCE_MATCH", index=True)
    
    # Status: AUTO_CONFIRMED, PENDING_REVIEW, CONFIRMED, REJECTED
    status = Column(String(30), default="AUTO_CONFIRMED", index=True)
    reviewed_by = Column(String(100), nullable=True)
    review_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

Index("idx_assoc_status_score", TrackAssociation.status, TrackAssociation.association_score)
