from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime
from app.database import Base

class CameraHealthLog(Base):
    __tablename__ = "camera_health_logs"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String(50), index=True, nullable=False)
    event_type = Column(String(50), index=True, nullable=False) # CONNECTED, DISCONNECTED, RECONNECT_ATTEMPT, TIMEOUT, FPS_DROP, ERROR
    status = Column(String(50), nullable=False)
    details = Column(Text, nullable=True)
    fps = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
