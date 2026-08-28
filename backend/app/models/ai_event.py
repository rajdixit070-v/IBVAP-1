from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime
from app.database import Base

class AIAnalyticsEvent(Base):
    __tablename__ = "ai_analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String(50), index=True, nullable=False)
    site_bop = Column(String(100), index=True, nullable=True)
    track_id = Column(Integer, index=True, nullable=False)
    object_type = Column(String(50), index=True, nullable=False) # person, vehicle, animal, drone, etc.
    event_type = Column(String(50), index=True, nullable=False)  # NEW_TRACK, TRACK_LOST, DIRECTION_CHANGE
    confidence = Column(Float, nullable=False)
    bbox_json = Column(Text, nullable=False)                      # JSON string of {x, y, width, height}
    direction = Column(String(30), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

# Alias for consistent naming
AIEvent = AIAnalyticsEvent

