from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class CameraPair(Base):
    """
    Module 2: RGB + Thermal Camera Pairing and Spatial Calibration.
    """
    __tablename__ = "camera_pairs"

    id = Column(Integer, primary_key=True, index=True)
    pair_id = Column(String(64), unique=True, index=True, nullable=False) # e.g. PAIR-CAM01-TH01
    rgb_camera_id = Column(String(50), index=True, nullable=False)
    thermal_camera_id = Column(String(50), index=True, nullable=False)
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True, nullable=False)
    bop_id = Column(String(50), default="BOP-ALPHA", index=True, nullable=True)
    
    # Calibration & Homography (3x3 transform matrix mapping thermal coords to RGB space)
    calibration_transform_json = Column(Text, default='{"homography": [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]], "scale_x": 1.0, "scale_y": 1.0, "offset_x": 0, "offset_y": 0, "rotation_deg": 0.0}')
    overlap_area_json = Column(Text, default='[{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 0.0}, {"x": 1.0, "y": 1.0}, {"x": 0.0, "y": 1.0}]')
    overlap_ratio = Column(Float, default=0.85) # 0.0 to 1.0
    
    # Synchronization & Runtime Mode
    sync_tolerance_ms = Column(Float, default=100.0) # Maximum frame arrival delta
    fusion_mode = Column(String(30), default="FUSED", index=True) # RGB_ONLY, THERMAL_ONLY, FUSED
    status = Column(String(30), default="ACTIVE", index=True) # ACTIVE, DEGRADED, CALIBRATING, OFFLINE
    degradation_reason = Column(String(200), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Index("idx_pair_rgb_thermal", CameraPair.rgb_camera_id, CameraPair.thermal_camera_id)


class ThermalFusionResult(Base):
    """
    Module 2: Real-time fused RGB + Thermal detection results with heat anomaly markers.
    """
    __tablename__ = "thermal_fusion_results"

    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(String(64), unique=True, index=True, nullable=False)
    pair_id = Column(String(64), index=True, nullable=False)
    rgb_camera_id = Column(String(50), index=True, nullable=False)
    thermal_camera_id = Column(String(50), index=True, nullable=False)
    
    rgb_confidence = Column(Float, default=0.0)
    thermal_confidence = Column(Float, default=0.0)
    fused_confidence = Column(Float, default=0.0)
    fusion_mode_applied = Column(String(30), default="FUSED")
    lighting_condition = Column(String(30), default="DAY") # DAY, NIGHT, LOW_LIGHT, FOG
    
    # Fused detections: [{"class": "person", "confidence": 0.92, "bbox": [x,y,w,h], "is_heat_anomaly": false, "temp_c": 36.8}]
    detections_json = Column(Text, default='[]')
    has_heat_anomaly = Column(Boolean, default=False, index=True)
    has_thermal_obstruction = Column(Boolean, default=False)
    
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

