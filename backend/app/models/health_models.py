from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class SystemHealthSnapshot(Base):
    __tablename__ = "system_health_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    overall_score = Column(Float, nullable=False) # 0 to 100
    status = Column(String(30), nullable=False) # HEALTHY, DEGRADED, WARNING, CRITICAL
    
    # Contributing factors (0 to 100)
    camera_availability_score = Column(Float, default=100.0)
    rtsp_stability_score = Column(Float, default=100.0)
    ai_processing_score = Column(Float, default=100.0)
    network_edge_score = Column(Float, default=100.0)
    storage_database_score = Column(Float, default=100.0)
    
    contributors_json = Column(Text, default="{}")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class CameraHealthState(Base):
    __tablename__ = "camera_health_states"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String(50), unique=True, index=True, nullable=False)
    status = Column(String(30), default="ONLINE", index=True) # ONLINE, DEGRADED, OFFLINE, UNKNOWN, MAINTENANCE
    priority = Column(String(20), default="NORMAL", index=True) # CRITICAL, HIGH, NORMAL, LOW
    
    actual_fps = Column(Float, default=0.0)
    expected_fps = Column(Float, default=25.0)
    frame_drops = Column(Integer, default=0)
    stream_latency_ms = Column(Float, default=35.0)
    resolution = Column(String(50), default="1920x1080")
    bitrate_kbps = Column(Float, default=2048.0)
    
    # Image Quality (0 - 100)
    image_quality_score = Column(Float, default=88.0)
    blur_score = Column(Float, default=150.0) # Laplacian variance
    brightness_score = Column(Float, default=120.0) # Mean luminance (0-255)
    contrast_score = Column(Float, default=65.0) # Std dev luminance
    low_light_confidence = Column(Float, default=0.90) # 0.0 - 1.0
    
    # Tampering & Obstruction
    tampering_detected = Column(Boolean, default=False, index=True)
    tampering_reason = Column(String(100), nullable=True)
    
    uptime_seconds = Column(Float, default=0.0)
    reconnect_count = Column(Integer, default=0)
    last_interruption_at = Column(DateTime, nullable=True)
    last_recovered_at = Column(DateTime, nullable=True)
    last_seen_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class HealthEvent(Base):
    __tablename__ = "health_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. HLT-2026-000101
    
    # Event Types:
    # CAMERA_OFFLINE, FRAME_RATE_DEGRADATION, LOW_IMAGE_QUALITY, POTENTIAL_CAMERA_TAMPERING,
    # STREAM_INTERRUPTION, EDGE_NODE_UNRESPONSIVE, AI_PROCESSING_BACKLOG, RESOURCE_PRESSURE,
    # STORAGE_WARNING, STORAGE_CRITICAL, DATABASE_DEGRADED, NETWORK_DEGRADATION,
    # CAMERA_RECOVERED, EDGE_RECOVERED, SERVICE_RECOVERED
    event_type = Column(String(60), index=True, nullable=False)
    
    # Source type: CAMERA, EDGE_NODE, RTSP, AI_PIPELINE, NETWORK, STORAGE, DATABASE, QUEUE, MODEL
    source_type = Column(String(40), index=True, nullable=False)
    source_id = Column(String(100), index=True, nullable=False)
    
    # Priority/Severity: CRITICAL, HIGH, MEDIUM, LOW
    severity = Column(String(20), default="MEDIUM", index=True, nullable=False)
    
    # Lifecycle: DETECTED, ACKNOWLEDGED, INVESTIGATING, RECOVERED, RESOLVED
    status = Column(String(30), default="DETECTED", index=True, nullable=False)
    
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    details_json = Column(Text, default="{}")
    
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    detected_at = Column(DateTime, default=datetime.utcnow)
    recovered_at = Column(DateTime, nullable=True)
    downtime_seconds = Column(Float, default=0.0)
    
    incident_id = Column(String(50), nullable=True, index=True) # Linked Phase 10 infrastructure incident

Index("idx_health_event_type_status", HealthEvent.event_type, HealthEvent.status)

class MaintenanceWindow(Base):
    __tablename__ = "maintenance_windows"

    id = Column(Integer, primary_key=True, index=True)
    maintenance_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. MAIN-2026-000101
    
    # Target Type: CAMERA, EDGE_NODE, SERVICE
    target_type = Column(String(30), nullable=False, index=True)
    target_id = Column(String(100), nullable=False, index=True)
    
    reason = Column(String(255), nullable=False)
    authorized_by = Column(String(100), nullable=False)
    
    # Status: ACTIVE, EXPIRED, COMPLETED, CANCELLED
    status = Column(String(30), default="ACTIVE", index=True)
    
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    expected_end_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class HealthConfigRecord(Base):
    __tablename__ = "health_config_records"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(Integer, default=1, index=True)
    changed_by = Column(String(100), default="admin")
    changed_at = Column(DateTime, default=datetime.utcnow)
    old_value_json = Column(Text, nullable=True)
    new_value_json = Column(Text, nullable=False)
    notes = Column(String(255), nullable=True)
