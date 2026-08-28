from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class ANPREvent(Base):
    __tablename__ = "anpr_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False)
    camera_id = Column(String(50), index=True, nullable=False)
    track_id = Column(Integer, index=True, nullable=False)
    
    plate_number = Column(String(30), nullable=False)
    normalized_plate = Column(String(30), index=True, nullable=False)
    confidence = Column(Float, default=0.90)
    plate_confidence = Column(Float, default=0.90)
    observations_count = Column(Integer, default=1)
    vehicle_type = Column(String(50), default="car")
    
    # Match Status: AUTHORIZED, WATCHLIST_MATCH, MONITOR, UNKNOWN, NO_MATCH
    match_status = Column(String(50), default="UNKNOWN", index=True, nullable=False)
    
    matched_owner = Column(String(100), nullable=True)
    watchlist_notes = Column(Text, nullable=True)
    snapshot_url = Column(String(255), nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

# Compound index for operational filtering
Index("idx_anpr_cam_match_time", ANPREvent.camera_id, ANPREvent.match_status, ANPREvent.timestamp)
Index("idx_anpr_plate_time", ANPREvent.normalized_plate, ANPREvent.timestamp)
