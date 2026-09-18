from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text
from datetime import datetime
from app.database import Base

class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. CAM-001
    camera_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    bop_site = Column(String(100), index=True, nullable=False) # Border Outpost name, e.g. BOP Alpha
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True) # Phase 12 Multi-Site
    bop_id = Column(String(50), nullable=True, index=True)               # Phase 12 BOP reference
    sector = Column(String(100), index=True, nullable=False)   # Sector / Zone, e.g. North Sector
    location = Column(String(200), nullable=True)             # Specific point / tower
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Edge Appliance assignment
    edge_node_id = Column(String(50), default="EDGE-BOP-001", index=True)
    
    # Connection details
    rtsp_url = Column(String(500), nullable=False)
    sub_stream_url = Column(String(500), nullable=True) # Low-bandwidth SD secondary stream
    username = Column(String(100), nullable=True)
    encrypted_password = Column(Text, nullable=True) # AES-256 encrypted
    stream_type = Column(String(50), default="main")  # main, sub, thermal, ptz
    
    # Video properties
    resolution = Column(String(50), nullable=True)   # e.g. 1920x1080
    fps = Column(Float, default=0.0)
    expected_fps = Column(Float, default=25.0)
    frame_drops = Column(Integer, default=0)
    stream_latency_ms = Column(Float, default=35.0)
    reconnect_count = Column(Integer, default=0)
    codec = Column(String(50), nullable=True)        # e.g. H.264, H.265
    stream_profile = Column(String(20), default="HIGH") # HIGH, MEDIUM, LOW
    
    # Priority & Maintenance (Phase 11)
    priority = Column(String(20), default="NORMAL", index=True) # CRITICAL, HIGH, NORMAL, LOW
    is_maintenance = Column(Boolean, default=False, index=True)
    maintenance_reason = Column(String(255), nullable=True)
    image_quality_score = Column(Float, default=88.0) # 0 to 100
    tampering_detected = Column(Boolean, default=False, index=True)
    
    # State flags
    enabled = Column(Boolean, default=True, index=True)
    status = Column(String(50), default="ONLINE", index=True) # ONLINE, HEALTHY, DEGRADED, OFFLINE, ERROR, CONNECTING, MAINTENANCE
    
    # Timestamps
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
