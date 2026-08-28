from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Index
from datetime import datetime
from app.database import Base

class EarlyWarning(Base):
    __tablename__ = "early_warnings"

    id = Column(Integer, primary_key=True, index=True)
    warning_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. EW-20260827-0001
    
    # Warning Level: INFO, WATCH, ELEVATED, HIGH
    warning_level = Column(String(20), default="ELEVATED", index=True)
    # Lifecycle: NEW, ACTIVE, ACKNOWLEDGED, EXPIRED, DISMISSED
    lifecycle_status = Column(String(30), default="ACTIVE", index=True)
    
    camera_id = Column(String(50), index=True, nullable=True)
    zone_id = Column(String(50), index=True, nullable=True)
    zone_name = Column(String(100), nullable=True)
    site_id = Column(String(50), index=True, nullable=True)
    
    forecast_risk_score = Column(Integer, default=65) # 0 to 100
    current_risk_score = Column(Integer, default=45)
    confidence = Column(Float, default=0.78) # 0.0 to 1.0
    data_quality_score = Column(Float, default=0.90)
    
    current_activity_count = Column(Integer, default=24)
    baseline_expected_count = Column(Float, default=12.0)
    deviation_percent = Column(Float, default=100.0) # e.g. +100%
    
    # Trend: INCREASING, STABLE, DECREASING, VOLATILE
    trend = Column(String(30), default="INCREASING")
    forecast_horizon_minutes = Column(Integer, default=60)
    
    reasons_json = Column(Text, default="[]") # List of contributing reasons
    counter_signals_json = Column(Text, default="[]") # List of mitigating counter-signals
    
    acknowledged_by = Column(String(50), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Index("idx_ew_level_status", EarlyWarning.warning_level, EarlyWarning.lifecycle_status, EarlyWarning.created_at)
Index("idx_ew_camera_zone", EarlyWarning.camera_id, EarlyWarning.zone_id)
