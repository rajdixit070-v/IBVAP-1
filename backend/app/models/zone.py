from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text
from datetime import datetime
from app.database import Base

class SecurityZone(Base):
    __tablename__ = "security_zones"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String(50), unique=True, index=True, nullable=False)
    camera_id = Column(String(50), index=True, nullable=False)
    name = Column(String(100), nullable=False)
    zone_type = Column(String(50), default="RESTRICTED") # RESTRICTED, HIGH_SECURITY, BUFFER, MONITORING, CUSTOM
    
    # Normalized polygon points: JSON array of [{"x": 0.15, "y": 0.20}, ...] (x, y between 0.0 and 1.0)
    polygon_json = Column(Text, nullable=False)
    
    # Monitored object classes: JSON array of ["person", "vehicle", "animal", "drone"]
    monitored_classes_json = Column(Text, default='["person", "vehicle"]')
    
    # Optional forbidden or expected movement direction (e.g., "SOUTH", "SOUTH_WEST", "ANY_ENTRY", "NONE")
    direction_rule = Column(String(50), default="NONE")
    
    # Base severity for alerts in this zone (LOW, MEDIUM, HIGH, CRITICAL)
    severity = Column(String(30), default="HIGH")
    
    enabled = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
