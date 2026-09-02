from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class PTZDevice(Base):
    """
    Module 3: ONVIF PTZ Camera Device Profile and Controller State.
    """
    __tablename__ = "ptz_devices"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. PTZ-001
    camera_id = Column(String(50), unique=True, index=True, nullable=False) # Link to Camera
    onvif_endpoint = Column(String(255), nullable=True) # http://192.168.1.100/onvif/device_service
    onvif_port = Column(Integer, default=80)
    onvif_profile_token = Column(String(100), default="Profile_1")
    
    # PTZ Capabilities
    supports_continuous_move = Column(Boolean, default=True)
    supports_absolute_move = Column(Boolean, default=True)
    supports_relative_move = Column(Boolean, default=True)
    supports_presets = Column(Boolean, default=True)
    pan_min = Column(Float, default=-180.0)
    pan_max = Column(Float, default=180.0)
    tilt_min = Column(Float, default=-90.0)
    tilt_max = Column(Float, default=90.0)
    zoom_min = Column(Float, default=1.0)
    zoom_max = Column(Float, default=30.0)
    
    # Current PTZ Coordinates
    current_pan = Column(Float, default=0.0)
    current_tilt = Column(Float, default=0.0)
    current_zoom = Column(Float, default=1.0)
    
    # Operational & Auto-Tracking State
    status = Column(String(30), default="READY", index=True) # READY, MOVING, TRACKING, ERROR, LOCKED
    is_locked = Column(Boolean, default=False)
    locked_by_user = Column(String(100), nullable=True)
    lock_expires_at = Column(DateTime, nullable=True)
    tracking_target_id = Column(String(64), nullable=True)
    auto_track_enabled = Column(Boolean, default=False)
    
    last_command_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PTZPreset(Base):
    """
    Module 3: Pre-configured PTZ guard tour presets.
    """
    __tablename__ = "ptz_presets"

    id = Column(Integer, primary_key=True, index=True)
    preset_id = Column(String(64), unique=True, index=True, nullable=False)
    camera_id = Column(String(50), index=True, nullable=False)
    preset_token = Column(String(50), nullable=False)
    preset_name = Column(String(100), nullable=False)
    pan = Column(Float, default=0.0)
    tilt = Column(Float, default=0.0)
    zoom = Column(Float, default=1.0)
    fov_heading_deg = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)


class PTZAuditLog(Base):
    """
    Module 3: Secure Audit Trail for Operator PTZ commands.
    """
    __tablename__ = "ptz_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String(50), index=True, nullable=False)
    user_id = Column(String(100), index=True, nullable=False)
    action = Column(String(50), nullable=False) # PAN, TILT, ZOOM, GOTO_PRESET, AUTO_TRACK_START, AUTO_TRACK_STOP, OVERRIDE
    params_json = Column(Text, default='{}')
    result = Column(String(30), default="SUCCESS")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

