from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime
from datetime import datetime
from app.database import Base

class BehaviourRule(Base):
    __tablename__ = "behaviour_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. RULE-LOITER-SENSITIVE
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    event_type = Column(String(60), nullable=False, index=True)
    is_enabled = Column(Boolean, default=True)
    
    # Thresholds & Parameters
    dwell_threshold_sec = Column(Float, default=30.0)
    stop_count_threshold = Column(Integer, default=3)
    speed_threshold_ms = Column(Float, default=4.5) # For sudden speed change (m/s)
    direction_change_threshold = Column(Integer, default=3)
    after_hours_start = Column(String(10), default="22:00")
    after_hours_end = Column(String(10), default="05:00")
    
    # Risk weights & Penalties
    base_risk_weight = Column(Integer, default=25)
    max_risk_cap = Column(Integer, default=40)
    cooldown_sec = Column(Integer, default=60)
    
    # Rule Versioning
    rule_version = Column(Integer, default=1)
    changed_by = Column(String(50), default="admin")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
