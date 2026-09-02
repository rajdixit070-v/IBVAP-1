import json
import logging
import time
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.sensor_models import Sensor, SensorTelemetry, SensorFusionEvent
from app.schemas.sensor_schemas import SensorCreate, SensorUpdate, SensorTelemetryCreate

logger = logging.getLogger("ibvap.services.sensors")

class SensorService:
    """
    Module 1: Multi-Sensor Registry and Health Management Service.
    """

    @staticmethod
    def get_all_sensors(
        db: Session,
        site_id: Optional[str] = None,
        bop_id: Optional[str] = None,
        sensor_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[Sensor]:
        query = db.query(Sensor)
        if site_id:
            query = query.filter(Sensor.site_id == site_id)
        if bop_id:
            query = query.filter(Sensor.bop_id == bop_id)
        if sensor_type:
            query = query.filter(Sensor.sensor_type == sensor_type.upper())
        if status:
            query = query.filter(Sensor.status == status.upper())
        return query.order_by(Sensor.created_at.desc()).limit(limit).all()

    @staticmethod
    def get_sensor_by_id(db: Session, sensor_id: str) -> Optional[Sensor]:
        return db.query(Sensor).filter(Sensor.sensor_id == sensor_id).first()

    @staticmethod
    def create_sensor(db: Session, data: SensorCreate) -> Sensor:
        existing = db.query(Sensor).filter(Sensor.sensor_id == data.sensor_id).first()
        if existing:
            raise ValueError(f"Sensor with ID '{data.sensor_id}' already exists.")

        sensor = Sensor(
            sensor_id=data.sensor_id,
            name=data.name,
            sensor_type=data.sensor_type.upper(),
            site_id=data.site_id,
            bop_id=data.bop_id,
            sector=data.sector,
            zone_id=data.zone_id,
            camera_id=data.camera_id,
            location=data.location,
            latitude=data.latitude,
            longitude=data.longitude,
            altitude_m=data.altitude_m or 0.0,
            status=data.status.upper(),
            health_score=data.health_score if data.health_score is not None else 100.0,
            latency_ms=data.latency_ms if data.latency_ms is not None else 20.0,
            packet_loss_pct=data.packet_loss_pct if data.packet_loss_pct is not None else 0.0,
            battery_pct=data.battery_pct,
            temperature_c=data.temperature_c if data.temperature_c is not None else 24.0,
            signal_quality_pct=data.signal_quality_pct if data.signal_quality_pct is not None else 95.0,
            capabilities_json=data.capabilities_json or "{}",
            config_json=data.config_json or "{}",
            reliability_weight=data.reliability_weight if data.reliability_weight is not None else 0.90,
            last_seen_at=datetime.utcnow()
        )
        db.add(sensor)
        db.commit()
        db.refresh(sensor)
        logger.info(f"Registered new sensor: id={sensor.sensor_id} type={sensor.sensor_type}")
        return sensor

    @staticmethod
    def update_sensor(db: Session, sensor_id: str, data: SensorUpdate) -> Optional[Sensor]:
        sensor = db.query(Sensor).filter(Sensor.sensor_id == sensor_id).first()
        if not sensor:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if key in ("sensor_type", "status") and value:
                setattr(sensor, key, value.upper())
            else:
                setattr(sensor, key, value)

        sensor.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(sensor)
        return sensor

    @staticmethod
    def delete_sensor(db: Session, sensor_id: str) -> bool:
        sensor = db.query(Sensor).filter(Sensor.sensor_id == sensor_id).first()
        if not sensor:
            return False
        db.delete(sensor)
        db.commit()
        return True

    @staticmethod
    def record_telemetry(db: Session, telemetry_data: SensorTelemetryCreate) -> SensorTelemetry:
        sensor = db.query(Sensor).filter(Sensor.sensor_id == telemetry_data.sensor_id).first()
        telemetry_id = f"TEL-{uuid.uuid4().hex[:12].upper()}"
        
        entry = SensorTelemetry(
            telemetry_id=telemetry_id,
            sensor_id=telemetry_data.sensor_id,
            battery_pct=telemetry_data.battery_pct,
            temperature_c=telemetry_data.temperature_c,
            signal_strength_dbm=telemetry_data.signal_strength_dbm,
            status=telemetry_data.status.upper() if telemetry_data.status else "ONLINE",
            reading_value=telemetry_data.reading_value,
            reading_unit=telemetry_data.reading_unit,
            raw_payload_json=telemetry_data.raw_payload_json or "{}"
        )
        db.add(entry)

        # Update sensor heartbeat and current state
        if sensor:
            sensor.last_seen_at = datetime.utcnow()
            if telemetry_data.battery_pct is not None:
                sensor.battery_pct = telemetry_data.battery_pct
            if telemetry_data.temperature_c is not None:
                sensor.temperature_c = telemetry_data.temperature_c
            if telemetry_data.status:
                sensor.status = telemetry_data.status.upper()
                
            # Compute dynamic health score
            health = 100.0
            if sensor.battery_pct is not None and sensor.battery_pct < 20:
                health -= 30.0
            if sensor.latency_ms and sensor.latency_ms > 150:
                health -= 25.0
            if sensor.packet_loss_pct and sensor.packet_loss_pct > 5.0:
                health -= 20.0
            sensor.health_score = max(0.0, min(100.0, health))

        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def get_telemetries(db: Session, sensor_id: str, limit: int = 50) -> List[SensorTelemetry]:
        return db.query(SensorTelemetry).filter(SensorTelemetry.sensor_id == sensor_id).order_by(SensorTelemetry.timestamp.desc()).limit(limit).all()

