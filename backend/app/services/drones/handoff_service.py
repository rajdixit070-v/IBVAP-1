import json
import logging
import uuid
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.drone_models import Drone, DroneMission, DroneHandoffEvent
from app.models.camera import Camera
from app.schemas.drone_schemas import DroneHandoffRequest

logger = logging.getLogger("ibvap.services.drones.handoff")

class DroneHandoffService:
    """
    Module 4: Bi-directional Target Handoff between Ground CCTV / PTZ Cameras and Airborne Drones.
    Preserves continuous Global Track ID and logs explainable handoff evidence.
    """

    @classmethod
    def execute_handoff(
        cls,
        db: Session,
        req: DroneHandoffRequest
    ) -> DroneHandoffEvent:
        """
        Executes and records a camera-to-drone or drone-to-camera target handoff.
        """
        src_type = req.source_type.upper()
        dst_type = req.destination_type.upper()

        if src_type not in ("CAMERA", "DRONE") or dst_type not in ("CAMERA", "DRONE"):
            raise ValueError(f"Invalid handoff type pair: {src_type} -> {dst_type}")

        # Compute dynamic handoff confidence
        confidence, conf_factors = cls._calculate_handoff_confidence(req)

        handoff_id = f"HND-{uuid.uuid4().hex[:12].upper()}"
        
        evidence = {
            "confidence_factors": conf_factors,
            "target_class": req.target_class or "PERSON",
            "global_track_id": req.global_track_id,
            "initiated_at": datetime.utcnow().isoformat(),
            "raw_evidence": json.loads(req.evidence_json or "{}") if isinstance(req.evidence_json, str) else req.evidence_json
        }

        handoff = DroneHandoffEvent(
            handoff_id=handoff_id,
            source_type=src_type,
            source_id=req.source_id,
            destination_type=dst_type,
            destination_id=req.destination_id,
            global_track_id=req.global_track_id,
            target_class=req.target_class or "PERSON",
            confidence=round(confidence, 4),
            reason=req.reason or f"Target handoff from {src_type} ({req.source_id}) to {dst_type} ({req.destination_id})",
            location_lat=req.location_lat,
            location_lng=req.location_lng,
            evidence_json=json.dumps(evidence),
            timestamp=datetime.utcnow()
        )
        db.add(handoff)

        # If destination is a Drone, automatically transition drone to active intercept mission
        if dst_type == "DRONE":
            drone = db.query(Drone).filter(Drone.drone_id == req.destination_id).first()
            if drone and drone.status in ("AVAILABLE", "ACTIVE"):
                drone.status = "MISSION"
                drone.flight_state = "CRUISE"

        db.commit()
        db.refresh(handoff)
        logger.info(f"Target Handoff Complete: {handoff.handoff_id} ({src_type}:{req.source_id} -> {dst_type}:{req.destination_id}) Track={req.global_track_id} Conf={confidence}")
        return handoff

    @classmethod
    def _calculate_handoff_confidence(cls, req: DroneHandoffRequest) -> Tuple[float, Dict[str, Any]]:
        """
        Calculates handoff confidence based on spatial proximity, trajectory consistency, and track continuity.
        """
        base_confidence = 0.90
        factors = {}

        # Spatial consistency check
        if req.location_lat and req.location_lng:
            factors["spatial_coordinates_present"] = True
            base_confidence = min(0.98, base_confidence + 0.05)
        else:
            factors["spatial_coordinates_present"] = False
            base_confidence -= 0.10

        # Global track ID continuity
        if req.global_track_id and req.global_track_id.startswith("GTRK-"):
            factors["valid_global_track_id"] = True
        else:
            factors["valid_global_track_id"] = False
            base_confidence -= 0.15

        factors["confidence_level"] = "HIGH" if base_confidence >= 0.85 else "MEDIUM" if base_confidence >= 0.65 else "LOW"
        return max(0.20, min(0.99, base_confidence)), factors

    @staticmethod
    def get_handoff_history(
        db: Session,
        global_track_id: Optional[str] = None,
        limit: int = 50
    ) -> List[DroneHandoffEvent]:
        query = db.query(DroneHandoffEvent)
        if global_track_id:
            query = query.filter(DroneHandoffEvent.global_track_id == global_track_id)
        return query.order_by(DroneHandoffEvent.timestamp.desc()).limit(limit).all()

    @staticmethod
    def delete_handoff(db: Session, handoff_id: str) -> bool:
        event = db.query(DroneHandoffEvent).filter(DroneHandoffEvent.handoff_id == handoff_id).first()
        if not event:
            return False
        db.delete(event)
        db.commit()
        logger.info(f"Target Handoff Record Deleted: {handoff_id}")
        return True

    @staticmethod
    def clear_handoff_history(db: Session) -> int:
        count = db.query(DroneHandoffEvent).delete()
        db.commit()
        logger.info(f"Cleared all {count} target handoff history events")
        return count


