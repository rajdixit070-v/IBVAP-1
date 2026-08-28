from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from datetime import datetime
from app.database import Base

class SystemRiskConfig(Base):
    __tablename__ = "system_risk_configs"

    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(50), unique=True, default="default")
    
    # Configurable Risk Factor Weights (0 - 50)
    weight_restricted_zone = Column(Integer, default=25)
    weight_fence_crossing = Column(Integer, default=25)
    weight_forbidden_direction = Column(Integer, default=15)
    weight_night_movement = Column(Integer, default=15)
    weight_loitering = Column(Integer, default=10)
    weight_stationary_vehicle = Column(Integer, default=15)
    weight_group_movement = Column(Integer, default=10)
    weight_rapid_movement = Column(Integer, default=10)
    penalty_low_confidence = Column(Integer, default=-10)

    # Behavioural Durations (seconds)
    loitering_duration_sec = Column(Float, default=10.0)
    stationary_vehicle_duration_sec = Column(Float, default=15.0)
    group_max_distance_norm = Column(Float, default=0.15) # Normalized spatial proximity
    event_cooldown_sec = Column(Float, default=30.0)

    # Night Hours (24h format HH:MM)
    night_start_hour = Column(Integer, default=20) # 20:00 (8 PM)
    night_end_hour = Column(Integer, default=6)    # 06:00 (6 AM)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
