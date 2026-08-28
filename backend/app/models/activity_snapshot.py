from sqlalchemy import Column, Integer, String, Float, DateTime, Index
from datetime import datetime
from app.database import Base

class ActivitySnapshot(Base):
    __tablename__ = "activity_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(String(50), unique=True, index=True, nullable=False)
    
    camera_id = Column(String(50), index=True, nullable=True)
    zone_id = Column(String(50), index=True, nullable=True)
    site_id = Column(String(50), index=True, nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    window_minutes = Column(Integer, default=15) # 5, 15, 30, 60, 360, 1440
    
    person_count = Column(Integer, default=0)
    vehicle_count = Column(Integer, default=0)
    security_event_count = Column(Integer, default=0)
    behaviour_event_count = Column(Integer, default=0)
    route_anomaly_count = Column(Integer, default=0)
    
    risk_score = Column(Integer, default=20) # 0 to 100
    created_at = Column(DateTime, default=datetime.utcnow)

Index("idx_snapshot_cam_time", ActivitySnapshot.camera_id, ActivitySnapshot.timestamp)
Index("idx_snapshot_site_time", ActivitySnapshot.site_id, ActivitySnapshot.timestamp)
