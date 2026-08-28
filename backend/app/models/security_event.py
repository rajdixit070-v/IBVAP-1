from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False)
    camera_id = Column(String(50), index=True, nullable=False)
    zone_id = Column(String(50), index=True, nullable=True)
    zone_name = Column(String(100), nullable=True)
    track_id = Column(Integer, index=True, nullable=False)
    object_type = Column(String(50), index=True, nullable=False) # person, car, truck, etc.
    
    # Event category: ZONE_INTRUSION, ZONE_EXIT, LOITERING, WRONG_DIRECTION, STATIONARY_VEHICLE, GROUP_MOVEMENT, RAPID_MOVEMENT, NIGHT_MOVEMENT, SUSPICIOUS_BEHAVIOUR
    event_type = Column(String(50), index=True, nullable=False)
    
    # Severity & Risk
    severity = Column(String(30), default="HIGH")              # LOW, MEDIUM, HIGH, CRITICAL
    risk_score = Column(Integer, default=50, index=True)       # 0 to 100
    risk_level = Column(String(30), default="MEDIUM", index=True) # LOW, MEDIUM, HIGH, CRITICAL
    
    # Event Lifecycle State: DETECTED, CONFIRMED, ACTIVE, ACKNOWLEDGED, EXPIRED, DISMISSED
    status = Column(String(30), default="ACTIVE", index=True)
    
    # Context & Environment
    environment = Column(String(50), default="DAY")            # DAY, NIGHT, LOW_LIGHT, FOG, RAIN
    location_description = Column(String(200), nullable=True)
    
    # Explainable Risk Factors Breakdown (JSON Array)
    factors_json = Column(Text, nullable=False, default='[]')
    
    # Incident Chronological Timeline (JSON Array of [{"time": "...", "description": "..."}])
    timeline_json = Column(Text, nullable=False, default='[]')
    
    # Spatial metadata
    last_bbox_json = Column(Text, nullable=True)
    last_direction = Column(String(30), nullable=True)
    last_speed = Column(Float, default=0.0)
    
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    last_updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)

# Compound index for fast operational filtering
Index("idx_events_cam_status_started", SecurityEvent.camera_id, SecurityEvent.status, SecurityEvent.started_at)
Index("idx_events_risk_started", SecurityEvent.risk_level, SecurityEvent.started_at)
