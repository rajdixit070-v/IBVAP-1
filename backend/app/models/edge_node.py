from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from datetime import datetime
from app.database import Base

class EdgeNode(Base):
    __tablename__ = "edge_nodes"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. EDGE-BOP-001
    name = Column(String(100), nullable=False)
    bop_site = Column(String(100), nullable=False) # BOP Alpha, Sector 4, etc.
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True) # Phase 12 Multi-Site
    bop_id = Column(String(50), nullable=True, index=True)               # Phase 12 BOP reference
    location = Column(String(100), nullable=True)
    
    # Status: ONLINE, DEGRADED, OFFLINE, RECONNECTING, SYNCING
    status = Column(String(30), default="ONLINE", index=True, nullable=False)
    
    software_version = Column(String(30), default="1.0.0")
    hardware_info = Column(String(255), default="NVIDIA Jetson Orin NX / Linux ARM64")
    
    # Telemetry
    cpu_percent = Column(Float, default=25.0)
    memory_percent = Column(Float, default=45.0)
    disk_percent = Column(Float, default=30.0)
    gpu_percent = Column(Float, default=35.0)
    
    active_cameras_count = Column(Integer, default=0)
    total_cameras_count = Column(Integer, default=0)
    queued_events_count = Column(Integer, default=0)
    
    # Sync Status: SYNCHRONIZED, DELAYED, SYNCING, OFFLINE
    sync_status = Column(String(30), default="SYNCHRONIZED")
    
    config_version = Column(Integer, default=1)
    low_bandwidth_mode = Column(Boolean, default=False)
    latency_ms = Column(Float, default=25.0)
    
    last_heartbeat = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
