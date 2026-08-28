from sqlalchemy import Column, Integer, String, Float, DateTime, Index
from datetime import datetime
from app.database import Base

class GlobalTrack(Base):
    __tablename__ = "global_tracks"

    id = Column(Integer, primary_key=True, index=True)
    global_track_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. GT-20260827-000101
    object_type = Column(String(30), default="person", index=True) # person, vehicle
    primary_identifier = Column(String(100), nullable=True, index=True) # e.g. Plate number 'UP32AB1234' or subject tag
    
    # Status: CREATED, ACTIVE, PAUSED, COMPLETED, EXPIRED
    status = Column(String(30), default="ACTIVE", index=True, nullable=False)
    
    current_camera_id = Column(String(50), index=True, nullable=False)
    previous_camera_id = Column(String(50), nullable=True)
    
    last_observation_time = Column(DateTime, default=datetime.utcnow, index=True)
    total_observations = Column(Integer, default=1)
    overall_confidence = Column(Float, default=0.85) # Aggregated multi-camera confidence
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Index("idx_global_track_status_type", GlobalTrack.status, GlobalTrack.object_type, GlobalTrack.last_observation_time)
