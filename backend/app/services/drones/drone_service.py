import json
import logging
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.drone_models import Drone, DroneMission
from app.schemas.drone_schemas import DroneCreate, DroneUpdate, DroneTelemetryUpdate, DroneMissionCreate

logger = logging.getLogger("ibvap.services.drones")

class DroneService:
    """
    Module 4: Autonomous Drone Fleet Registry and Mission Lifecycle State Machine.
    """

    @staticmethod
    def get_all_drones(
        db: Session,
        site_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Drone]:
        query = db.query(Drone)
        if site_id:
            query = query.filter(Drone.site_id == site_id)
        if status:
            query = query.filter(Drone.status == status.upper())
        return query.order_by(Drone.created_at.desc()).all()

    @staticmethod
    def get_drone_by_id(db: Session, drone_id: str) -> Optional[Drone]:
        return db.query(Drone).filter(Drone.drone_id == drone_id).first()

    @staticmethod
    def create_drone(db: Session, data: DroneCreate) -> Drone:
        existing = db.query(Drone).filter(Drone.drone_id == data.drone_id).first()
        if existing:
            raise ValueError(f"Drone with ID '{data.drone_id}' already exists.")

        drone = Drone(
            drone_id=data.drone_id,
            name=data.name,
            model=data.model or "BorderGuardian-X8",
            site_id=data.site_id,
            bop_id=data.bop_id,
            status=data.status.upper() if data.status else "AVAILABLE",
            battery_pct=data.battery_pct if data.battery_pct is not None else 98.0,
            latitude=data.latitude if data.latitude is not None else 31.6240,
            longitude=data.longitude if data.longitude is not None else 74.8720,
            altitude_m=data.altitude_m if data.altitude_m is not None else 50.0,
            heading_deg=data.heading_deg if data.heading_deg is not None else 0.0,
            speed_mps=data.speed_mps if data.speed_mps is not None else 0.0,
            flight_state=data.flight_state or "HOVER",
            gps_satellites=data.gps_satellites if data.gps_satellites is not None else 16,
            link_quality_pct=data.link_quality_pct if data.link_quality_pct is not None else 95.0,
            camera_stream_url=data.camera_stream_url,
            camera_gimbal_pitch=data.camera_gimbal_pitch if data.camera_gimbal_pitch is not None else -45.0,
            capabilities_json=data.capabilities_json or '{"has_thermal": true, "max_speed_mps": 22.0, "max_range_m": 10000, "max_flight_time_min": 45}',
            last_seen_at=datetime.utcnow()
        )
        db.add(drone)
        db.commit()
        db.refresh(drone)
        logger.info(f"Registered new Drone: id={drone.drone_id} model={drone.model}")
        return drone

    @staticmethod
    def update_telemetry(db: Session, drone_id: str, telemetry: DroneTelemetryUpdate) -> Optional[Drone]:
        drone = db.query(Drone).filter(Drone.drone_id == drone_id).first()
        if not drone:
            return None

        drone.latitude = telemetry.latitude
        drone.longitude = telemetry.longitude
        drone.altitude_m = telemetry.altitude_m
        drone.heading_deg = telemetry.heading_deg
        drone.speed_mps = telemetry.speed_mps
        drone.battery_pct = telemetry.battery_pct
        drone.flight_state = telemetry.flight_state.upper()
        drone.gps_satellites = telemetry.gps_satellites
        drone.link_quality_pct = telemetry.link_quality_pct
        if telemetry.camera_gimbal_pitch is not None:
            drone.camera_gimbal_pitch = telemetry.camera_gimbal_pitch
        
        # Check automatic battery failsafe (RTH on critical battery)
        if drone.battery_pct <= 20.0 and drone.status not in ("RETURNING", "CHARGING", "OFFLINE"):
            drone.status = "RETURNING"
            drone.flight_state = "RTH"
            logger.warning(f"[{drone_id}] Low battery failsafe triggered: {drone.battery_pct}% -> Initiating RTH")

        drone.last_seen_at = datetime.utcnow()
        db.commit()
        db.refresh(drone)
        return drone

    @staticmethod
    def delete_drone(db: Session, drone_id: str) -> bool:
        drone = db.query(Drone).filter(Drone.drone_id == drone_id).first()
        if not drone:
            return False
        db.query(DroneMission).filter(DroneMission.drone_id == drone_id).delete()
        db.delete(drone)
        db.commit()
        logger.info(f"Deleted Drone: {drone_id}")
        return True

    @staticmethod
    def delete_mission(db: Session, mission_id: str) -> bool:
        mission = db.query(DroneMission).filter(DroneMission.mission_id == mission_id).first()
        if not mission:
            return False
        db.delete(mission)
        db.commit()
        logger.info(f"Deleted DroneMission: {mission_id}")
        return True

    @staticmethod
    def clear_all_drones(db: Session) -> int:
        db.query(DroneMission).delete()
        count = db.query(Drone).delete()
        db.commit()
        logger.info(f"Cleared all {count} drones and missions")
        return count

    # --- Mission Lifecycle State Machine ---
    @staticmethod
    def create_mission(db: Session, data: DroneMissionCreate, user_id: str = "operator") -> DroneMission:
        drone = db.query(Drone).filter(Drone.drone_id == data.drone_id).first()
        if not drone:
            raise ValueError(f"Target Drone '{data.drone_id}' not found.")

        # Safety: Check minimum battery threshold before allowing mission creation
        if drone.battery_pct < (data.min_battery_threshold or 25.0):
            raise ValueError(f"Drone battery ({drone.battery_pct}%) is below minimum required threshold ({data.min_battery_threshold}%)")

        mission_id = f"MSN-{uuid.uuid4().hex[:10].upper()}"
        mission = DroneMission(
            mission_id=mission_id,
            drone_id=data.drone_id,
            site_id=data.site_id,
            bop_id=data.bop_id,
            mission_type=data.mission_type.upper(),
            status="PLANNED",
            priority=data.priority.upper() if data.priority else "HIGH",
            objective=data.objective,
            target_track_id=data.target_track_id,
            global_track_id=data.global_track_id,
            waypoints_json=data.waypoints_json or '[]',
            geofence_boundary_json=data.geofence_boundary_json or '[]',
            max_duration_sec=data.max_duration_sec or 1800,
            min_battery_threshold=data.min_battery_threshold or 25.0,
            dispatched_by_user=user_id
        )
        db.add(mission)
        db.commit()
        db.refresh(mission)
        logger.info(f"Created Mission '{mission.mission_id}' for Drone '{mission.drone_id}' (Status=PLANNED)")
        return mission

    @staticmethod
    def dispatch_mission(db: Session, mission_id: str, user_id: str = "operator") -> DroneMission:
        mission = db.query(DroneMission).filter(DroneMission.mission_id == mission_id).first()
        if not mission:
            raise ValueError(f"Mission '{mission_id}' not found.")

        if mission.status not in ("PLANNED", "AUTHORIZED", "PAUSED"):
            raise ValueError(f"Cannot dispatch mission in status '{mission.status}'")

        drone = db.query(Drone).filter(Drone.drone_id == mission.drone_id).first()
        if drone:
            drone.status = "MISSION"
            drone.flight_state = "CRUISE"

        mission.status = "ACTIVE"
        mission.start_time = datetime.utcnow()
        mission.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(mission)
        logger.info(f"Dispatched Mission '{mission.mission_id}' -> ACTIVE")
        return mission

    @staticmethod
    def abort_mission(db: Session, mission_id: str, reason: str = "Operator Abort", user_id: str = "operator") -> DroneMission:
        mission = db.query(DroneMission).filter(DroneMission.mission_id == mission_id).first()
        if not mission:
            raise ValueError(f"Mission '{mission_id}' not found.")

        drone = db.query(Drone).filter(Drone.drone_id == mission.drone_id).first()
        if drone:
            drone.status = "RETURNING"
            drone.flight_state = "RTH"

        mission.status = "ABORTED"
        mission.end_time = datetime.utcnow()
        mission.abort_reason = reason
        mission.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(mission)
        logger.info(f"Aborted Mission '{mission.mission_id}' -> Reason: {reason}")
        return mission

    @staticmethod
    def complete_mission(db: Session, mission_id: str) -> DroneMission:
        mission = db.query(DroneMission).filter(DroneMission.mission_id == mission_id).first()
        if not mission:
            raise ValueError(f"Mission '{mission_id}' not found.")

        drone = db.query(Drone).filter(Drone.drone_id == mission.drone_id).first()
        if drone:
            drone.status = "AVAILABLE"
            drone.flight_state = "HOVER"

        mission.status = "COMPLETED"
        mission.end_time = datetime.utcnow()
        mission.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(mission)
        return mission

    @staticmethod
    def get_missions(db: Session, site_id: Optional[str] = None, status: Optional[str] = None) -> List[DroneMission]:
        query = db.query(DroneMission)
        if site_id:
            query = query.filter(DroneMission.site_id == site_id)
        if status:
            query = query.filter(DroneMission.status == status.upper())
        return query.order_by(DroneMission.created_at.desc()).all()

