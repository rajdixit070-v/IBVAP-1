from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class Drone(Base):
    """
    Module 4: Autonomous Border Drone (UAV) Fleet Registry.
    """
    __tablename__ = "drones"

    id = Column(Integer, primary_key=True, index=True)
    drone_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. UAV-BOP-01
    name = Column(String(100), nullable=False)
    model = Column(String(100), default="BorderGuardian-X8")
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True, nullable=False)
    bop_id = Column(String(50), default="BOP-ALPHA", index=True, nullable=True)
    
    # Status: AVAILABLE, ACTIVE, MISSION, RETURNING, CHARGING, OFFLINE, EMERGENCY
    status = Column(String(30), default="AVAILABLE", index=True)
    battery_pct = Column(Float, default=98.0) # 0 to 100
    
    # Real-time Telemetry
    latitude = Column(Float, default=31.6240)
    longitude = Column(Float, default=74.8720)
    altitude_m = Column(Float, default=50.0)
    heading_deg = Column(Float, default=0.0)
    speed_mps = Column(Float, default=0.0)
    flight_state = Column(String(30), default="HOVER") # HOVER, CRUISE, ASCENDING, DESCENDING, RTH
    gps_satellites = Column(Integer, default=16)
    link_quality_pct = Column(Float, default=95.0)
    
    # Payloads & Video Pipeline
    camera_stream_url = Column(String(500), nullable=True) # rtsp://192.168.1.150:8554/uav01
    camera_gimbal_pitch = Column(Float, default=-45.0) # -90 to +30 deg
    capabilities_json = Column(Text, default='{"has_thermal": true, "max_speed_mps": 22.0, "max_range_m": 10000, "max_flight_time_min": 45}')
    
    last_seen_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DroneMission(Base):
    """
    Module 4: Mission lifecycle state machine for UAV border patrol and interdiction.
    Lifecycle: DRAFT -> PLANNED -> AUTHORIZED -> DISPATCHED -> ACTIVE -> COMPLETED / ABORTED
    """
    __tablename__ = "drone_missions"

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(String(64), unique=True, index=True, nullable=False) # e.g. MSN-2026-001
    drone_id = Column(String(50), index=True, nullable=False)
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True, nullable=False)
    bop_id = Column(String(50), default="BOP-ALPHA", index=True, nullable=True)
    
    mission_type = Column(String(50), default="PATROL", index=True) # PATROL, INTERCEPT, TRACK_TARGET, RECONNAISSANCE, EMERGENCY_RESPONSE
    status = Column(String(30), default="PLANNED", index=True) # DRAFT, PLANNED, AUTHORIZED, DISPATCHED, ACTIVE, PAUSED, COMPLETED, ABORTED, FAILED
    priority = Column(String(20), default="HIGH", index=True) # CRITICAL, HIGH, MEDIUM, LOW
    objective = Column(String(255), nullable=False)
    
    # Tracking Association
    target_track_id = Column(Integer, nullable=True)
    global_track_id = Column(String(50), index=True, nullable=True)
    
    # Geofence & Waypoints
    waypoints_json = Column(Text, default='[]') # [{"lat": 31.62, "lng": 74.87, "alt": 50, "action": "LOITER"}]
    geofence_boundary_json = Column(Text, default='[]')
    max_duration_sec = Column(Integer, default=1800)
    min_battery_threshold = Column(Float, default=25.0)
    
    dispatched_by_user = Column(String(100), default="operator")
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    abort_reason = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DroneHandoffEvent(Base):
    """
    Module 4: Bi-directional target handoff between Fixed Ground Cameras and Airborne Drones.
    """
    __tablename__ = "drone_handoff_events"

    id = Column(Integer, primary_key=True, index=True)
    handoff_id = Column(String(64), unique=True, index=True, nullable=False)
    source_type = Column(String(20), nullable=False) # CAMERA or DRONE
    source_id = Column(String(50), index=True, nullable=False) # CAM-001 or UAV-BOP-01
    destination_type = Column(String(20), nullable=False) # DRONE or CAMERA
    destination_id = Column(String(50), index=True, nullable=False)
    
    global_track_id = Column(String(50), index=True, nullable=False)
    target_class = Column(String(50), default="PERSON")
    confidence = Column(Float, default=0.88)
    reason = Column(String(255), nullable=True)
    
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    evidence_json = Column(Text, default='{}')
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

