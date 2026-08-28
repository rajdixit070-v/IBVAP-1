from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Index
from datetime import datetime
from app.database import Base

class CameraTransition(Base):
    __tablename__ = "camera_transitions"

    id = Column(Integer, primary_key=True, index=True)
    from_camera_id = Column(String(50), index=True, nullable=False)
    to_camera_id = Column(String(50), index=True, nullable=False)
    
    min_travel_time_sec = Column(Float, default=10.0) # Travel time lower bound (below this -> impossible)
    expected_travel_time_sec = Column(Float, default=45.0) # Typical transit duration
    max_travel_time_sec = Column(Float, default=300.0) # Upper bound before track expiration
    
    direction = Column(String(20), default="ANY") # NORTH, SOUTH, EAST, WEST, ANY
    transition_confidence = Column(Float, default=0.90) # Topological connection strength
    is_enabled = Column(Boolean, default=True, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Index("idx_transition_from_to", CameraTransition.from_camera_id, CameraTransition.to_camera_id, unique=True)
