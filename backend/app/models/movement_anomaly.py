from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Index
from datetime import datetime
from app.database import Base

class MovementAnomaly(Base):
    __tablename__ = "movement_anomalies"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. ANM-20260827-000101
    global_track_id = Column(String(50), index=True, nullable=True)
    
    # Anomaly Types: IMPOSSIBLE_TRANSITION, ROUTE_DEVIATION, PLATE_CONFLICT, PROLONGED_PERIMETER_LOITERING
    anomaly_type = Column(String(40), nullable=False, index=True)
    
    from_camera_id = Column(String(50), index=True, nullable=True)
    to_camera_id = Column(String(50), index=True, nullable=True)
    
    time_delta_sec = Column(Float, nullable=True)
    expected_time_sec = Column(Float, nullable=True)
    
    severity = Column(String(20), default="HIGH", index=True) # CRITICAL, HIGH, MEDIUM, LOW
    details_json = Column(Text, default="{}")
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

Index("idx_anomaly_type_severity", MovementAnomaly.anomaly_type, MovementAnomaly.severity, MovementAnomaly.created_at)
