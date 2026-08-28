from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Index
from datetime import datetime
from app.database import Base

class TrackObservation(Base):
    __tablename__ = "track_observations"

    id = Column(Integer, primary_key=True, index=True)
    observation_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. OBS-20260827-000101
    global_track_id = Column(String(50), index=True, nullable=False)
    camera_id = Column(String(50), index=True, nullable=False)
    local_track_id = Column(Integer, index=True, nullable=False)
    object_type = Column(String(30), default="person")
    
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    bbox_json = Column(Text, default="[0, 0, 0, 0]")
    direction = Column(String(20), default="NORTH")
    
    appearance_features_json = Column(Text, nullable=True) # Non-biometric appearance features
    plate_number = Column(String(50), nullable=True, index=True)
    plate_confidence = Column(Float, nullable=True)
    
    confidence = Column(Float, default=0.90)
    created_at = Column(DateTime, default=datetime.utcnow)

Index("idx_observation_global_cam", TrackObservation.global_track_id, TrackObservation.camera_id, TrackObservation.timestamp)
