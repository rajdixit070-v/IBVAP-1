from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Index
from datetime import datetime
from app.database import Base

class BehaviourEvent(Base):
    __tablename__ = "behaviour_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. BHV-20260827-0001
    global_track_id = Column(String(50), index=True, nullable=True)
    camera_id = Column(String(50), index=True, nullable=False)
    local_track_id = Column(Integer, nullable=True)
    object_type = Column(String(30), default="person", index=True)
    
    # Event Types:
    # BEHAVIOUR_ANOMALY, REPEATED_APPROACH, POTENTIAL_PERIMETER_PROBING_PATTERN,
    # FENCE_EDGE_MOVEMENT, DIRECTION_ANOMALY, RAPID_DIRECTION_CHANGE,
    # STOP_GO_ANOMALY, SUDDEN_SPEED_CHANGE, ACTIVITY_DENSITY_ANOMALY,
    # VEHICLE_DWELL_ANOMALY, REPEATED_VEHICLE_VISIT, AFTER_HOURS_ACTIVITY,
    # POTENTIAL_ABANDONED_OBJECT, LEFT_BEHIND_OBJECT, ROUTE_ANOMALY,
    # REPEATED_ROUTE_ANOMALY, BASELINE_ACTIVITY_ANOMALY, IMPOSSIBLE_MOVEMENT_PATTERN
    event_type = Column(String(60), nullable=False, index=True)
    
    risk_score = Column(Integer, default=50, index=True) # 0 to 100
    decayed_risk_score = Column(Integer, default=50)
    risk_level = Column(String(20), default="ELEVATED", index=True) # LOW, GUARDED, ELEVATED, HIGH, CRITICAL
    confidence = Column(Float, default=0.90) # Detection / AI confidence
    
    zone_id = Column(String(50), index=True, nullable=True)
    zone_name = Column(String(100), nullable=True)
    
    factors_json = Column(Text, default="[]") # List of contributing risk factors
    counter_factors_json = Column(Text, default="[]") # List of mitigating counter-signals
    details_json = Column(Text, default="{}") # Velocity, dwell time, directions, etc.
    
    status = Column(String(30), default="DETECTED", index=True) # DETECTED, INVESTIGATING, CONFIRMED, FALSE_ALARM, RESOLVED
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Index("idx_bhv_event_type_risk", BehaviourEvent.event_type, BehaviourEvent.risk_score, BehaviourEvent.created_at)
Index("idx_bhv_camera_track", BehaviourEvent.camera_id, BehaviourEvent.global_track_id)
