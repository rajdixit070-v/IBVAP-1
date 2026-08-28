from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Index
from datetime import datetime
from app.database import Base

class BaselineShift(Base):
    __tablename__ = "baseline_shifts"

    id = Column(Integer, primary_key=True, index=True)
    shift_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. SHIFT-CAM001-H14
    
    camera_id = Column(String(50), index=True, nullable=False)
    zone_id = Column(String(50), index=True, nullable=True)
    hour_of_day = Column(Integer, nullable=False)
    
    old_baseline_value = Column(Float, nullable=False)
    new_observed_value = Column(Float, nullable=False)
    deviation_percent = Column(Float, nullable=False)
    
    # Status: REVIEW_REQUIRED, APPROVED, REJECTED
    status = Column(String(30), default="REVIEW_REQUIRED", index=True)
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    reviewed_by = Column(String(50), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

Index("idx_shift_cam_status", BaselineShift.camera_id, BaselineShift.status)
