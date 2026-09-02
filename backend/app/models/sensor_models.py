from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class Sensor(Base):
    """
    Module 1: Heterogeneous Multi-Sensor Registry.
    Supported types: CAMERA, THERMAL, RADAR, ACOUSTIC, SEISMIC, WEATHER, DRONE, OTHER
    """
    __tablename__ = "sensors"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. RAD-001, SEIS-04
    name = Column(String(100), nullable=False)
    sensor_type = Column(String(50), index=True, nullable=False) # CAMERA, THERMAL, RADAR, ACOUSTIC, SEISMIC, WEATHER, DRONE, OTHER
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True, nullable=False)
    bop_id = Column(String(50), default="BOP-ALPHA", index=True, nullable=True)
    sector = Column(String(100), index=True, nullable=False)
    zone_id = Column(String(50), index=True, nullable=True)
    camera_id = Column(String(50), index=True, nullable=True) # Optional link to fixed camera
    
    # Physical and Geospatial position
    location = Column(String(200), nullable=True) # Tower 4, Sector North
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    altitude_m = Column(Float, default=0.0)
    
    # Operational Status & Health: ONLINE, DEGRADED, OFFLINE, UNKNOWN, MAINTENANCE
    status = Column(String(30), default="ONLINE", index=True)
    health_score = Column(Float, default=100.0) # 0 to 100
    latency_ms = Column(Float, default=20.0)
    packet_loss_pct = Column(Float, default=0.0)
    battery_pct = Column(Float, nullable=True) # For battery powered remote seismic/acoustic nodes
    temperature_c = Column(Float, default=24.0)
    signal_quality_pct = Column(Float, default=95.0)
    error_count = Column(Integer, default=0)
    
    # Device specifications & Configuration
    capabilities_json = Column(Text, default='{}') # {"range_m": 500, "detection_types": ["ground_movement", "seismic_vibration"]}
    config_json = Column(Text, default='{}')
    reliability_weight = Column(Float, default=0.90) # Base reliability in Bayesian fusion (0.0 to 1.0)
    
    last_seen_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Index("idx_sensor_site_bop_type", Sensor.site_id, Sensor.bop_id, Sensor.sensor_type)


class SensorTelemetry(Base):
    """
    Module 1: Time-series telemetry observations from edge sensors.
    """
    __tablename__ = "sensor_telemetries"

    id = Column(Integer, primary_key=True, index=True)
    telemetry_id = Column(String(64), unique=True, index=True, nullable=False)
    sensor_id = Column(String(50), index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    battery_pct = Column(Float, nullable=True)
    temperature_c = Column(Float, nullable=True)
    signal_strength_dbm = Column(Float, nullable=True)
    status = Column(String(30), default="ONLINE")
    reading_value = Column(Float, nullable=True) # e.g. seismic magnitude 2.4, wind speed 12m/s
    reading_unit = Column(String(20), nullable=True) # m/s, dB, Richter, etc.
    raw_payload_json = Column(Text, default='{}')


class SensorFusionEvent(Base):
    """
    Module 1: Unified Multi-Sensor Fusion Event.
    Combines observations from Optical, Thermal, Radar, Acoustic, Seismic, and Drone sensors.
    """
    __tablename__ = "sensor_fusion_events"

    id = Column(Integer, primary_key=True, index=True)
    fusion_event_id = Column(String(64), unique=True, index=True, nullable=False) # e.g. SFE-2026-001
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True, nullable=False)
    bop_id = Column(String(50), default="BOP-ALPHA", index=True, nullable=True)
    sector = Column(String(100), index=True, nullable=True)
    zone_id = Column(String(50), index=True, nullable=True)
    
    # Fused Classification
    fused_event_type = Column(String(60), index=True, nullable=False) # PERSON_INTRUSION, VEHICLE_CONVOY, TUNNELING_SEISMIC, HEAT_ANOMALY, DRONE_INCURSION
    confidence = Column(Float, nullable=False, default=0.85) # 0.0 to 1.0
    confidence_level = Column(String(20), default="HIGH") # CRITICAL, HIGH, MEDIUM, LOW
    
    # Conflict Resolution: NONE, CONFLICTING_SENSORS, DEGRADED_CONSENSUS
    conflict_status = Column(String(40), default="NONE", index=True)
    
    # Provenance & Explainability
    fusion_method = Column(String(50), default="BAYESIAN_EVIDENTIAL_FUSION")
    source_sensor_ids_json = Column(Text, default='[]') # ["RAD-001", "CAM-002", "SEIS-04"]
    individual_observations_json = Column(Text, default='[]') # Array of raw sensor readings and respective confidences
    confidence_explanation_json = Column(Text, default='{}')
    
    # Geospatial and Global Tracking attribution
    location_json = Column(Text, default='{}') # {"lat": ..., "lng": ..., "x": ..., "y": ...}
    track_id = Column(Integer, nullable=True)
    global_track_id = Column(String(50), index=True, nullable=True)
    
    # Integrated Risk Assessment
    risk_score = Column(Integer, default=70, index=True) # 0 to 100
    is_acknowledged = Column(Boolean, default=False, index=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

Index("idx_fusion_site_bop_time", SensorFusionEvent.site_id, SensorFusionEvent.bop_id, SensorFusionEvent.timestamp)

