from sqlalchemy import Column, Integer, String, Float, DateTime, UniqueConstraint
from datetime import datetime
from app.database import Base

class ActivityBaseline(Base):
    __tablename__ = "activity_baselines"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String(50), nullable=False, index=True)
    zone_id = Column(String(50), nullable=True, index=True)
    hour_of_day = Column(Integer, nullable=False) # 0 to 23
    
    expected_person_count = Column(Float, default=5.0)
    expected_vehicle_count = Column(Float, default=2.0)
    expected_dwell_sec = Column(Float, default=15.0)
    expected_speed_ms = Column(Float, default=1.2)
    
    density_std_dev = Column(Float, default=2.5) # For outlier standard score
    samples_count = Column(Integer, default=50)
    
    version = Column(Integer, default=1)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("camera_id", "zone_id", "hour_of_day", name="uq_cam_zone_hour"),
    )
