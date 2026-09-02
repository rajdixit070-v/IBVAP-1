from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class GISLayer(Base):
    """
    Module 5: Toggleable GIS Layer Definitions.
    Types: BASE_MAP, BOUNDARY, CAMERAS, SENSORS, BOPS, ZONES, INCIDENTS, PATROLS, DRONES, TERRAIN, COVERAGE, BLIND_SPOTS, RISK
    """
    __tablename__ = "gis_layers"

    id = Column(Integer, primary_key=True, index=True)
    layer_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. LAYER-BLINDSPOTS
    name = Column(String(100), nullable=False)
    layer_type = Column(String(50), index=True, nullable=False)
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True, nullable=False)
    is_visible = Column(Boolean, default=True)
    opacity = Column(Float, default=0.85) # 0.0 to 1.0
    features_geojson = Column(Text, default='{}')
    config_json = Column(Text, default='{}')
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CameraFOV(Base):
    """
    Module 5: Geometric Field-of-View representation based on optics, tilt, bearing, and mounting height.
    """
    __tablename__ = "camera_fovs"

    id = Column(Integer, primary_key=True, index=True)
    fov_id = Column(String(64), unique=True, index=True, nullable=False)
    camera_id = Column(String(50), unique=True, index=True, nullable=False)
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True, nullable=False)
    bop_id = Column(String(50), default="BOP-ALPHA", index=True, nullable=True)
    
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    heading_deg = Column(Float, default=0.0) # 0 to 360 deg
    horizontal_fov_deg = Column(Float, default=65.0)
    vertical_fov_deg = Column(Float, default=45.0)
    range_meters = Column(Float, default=350.0)
    mount_height_m = Column(Float, default=12.0)
    tilt_deg = Column(Float, default=-15.0) # Negative for looking down
    
    polygon_geojson = Column(Text, default='{}') # Polygon coordinate array of ground projection
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SectorCoverage(Base):
    """
    Module 5: Dynamic Sector Optical and Sensor Coverage Calculation.
    """
    __tablename__ = "sector_coverages"

    id = Column(Integer, primary_key=True, index=True)
    coverage_id = Column(String(64), unique=True, index=True, nullable=False)
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True, nullable=False)
    bop_id = Column(String(50), default="BOP-ALPHA", index=True, nullable=True)
    sector_name = Column(String(100), index=True, nullable=False)
    
    total_area_sqm = Column(Float, default=1000000.0)
    covered_area_sqm = Column(Float, default=780000.0)
    coverage_percentage = Column(Float, default=78.0) # 0 to 100
    blind_area_sqm = Column(Float, default=220000.0)
    overlap_area_sqm = Column(Float, default=95000.0)
    
    calculated_at = Column(DateTime, default=datetime.utcnow, index=True)


class BlindSpot(Base):
    """
    Module 5: Prioritized Tactical Blind Spots and Automated Sensor/Drone Recommendations.
    """
    __tablename__ = "blind_spots"

    id = Column(Integer, primary_key=True, index=True)
    blind_spot_id = Column(String(64), unique=True, index=True, nullable=False) # e.g. BLIND-SEC-01
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True, nullable=False)
    bop_id = Column(String(50), default="BOP-ALPHA", index=True, nullable=True)
    sector_name = Column(String(100), index=True, nullable=False)
    
    polygon_geojson = Column(Text, default='{}')
    area_sqm = Column(Float, default=45000.0)
    risk_level = Column(String(20), default="HIGH", index=True) # CRITICAL, HIGH, MEDIUM, LOW
    risk_score = Column(Integer, default=80, index=True) # 0 to 100
    priority_rank = Column(Integer, default=1)
    
    proximity_to_border_m = Column(Float, default=150.0)
    terrain_factor = Column(String(50), default="RIVER_RAVINE") # FLAT, DENSE_VEGETATION, RIVER_RAVINE, STEEP_SLOPE
    incident_history_count = Column(Integer, default=3)
    
    # Actionable tactical recommendations: [{"action": "USE_PTZ", "camera_id": "CAM-07", "reason": "Reposition to cover ravine entrance"}, {"action": "USE_DRONE", "drone_id": "UAV-BOP-01", "reason": "Schedule recurrent aerial orbit"}]
    recommendations_json = Column(Text, default='[]')
    is_acknowledged = Column(Boolean, default=False, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

