import json
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.behaviour_event import BehaviourEvent
from app.models.behaviour_rule import BehaviourRule
from app.models.behaviour_feedback import BehaviourFeedback
from app.models.audit_log import SecurityAuditLog
from app.services.behaviour.feature_extractor import feature_extractor
from app.services.behaviour.baseline_engine import baseline_engine
from app.services.behaviour.explainable_risk_engine import explainable_risk_engine

logger = logging.getLogger("ibvap.behaviour.service")

class BehaviourIntelligenceService:
    """
    Central Orchestrator for Advanced Behaviour Analytics, Multi-Signal
    Anomaly Detection, and Explainable Threat Assessments.
    """

    def __init__(self):
        # In-memory cooldown tracking: (camera_id, local_track_id, event_type) -> last_alert_time
        self._cooldown_map: Dict[str, datetime] = {}
        # Track history cache for kinematic and repeated approach analysis:
        # (camera_id, local_track_id) -> list of (x, y, timestamp_sec)
        self._track_histories: Dict[str, List[Tuple[float, float, float]]] = {}

    def update_track_kinematics(
        self,
        camera_id: str,
        local_track_id: int,
        x: float,
        y: float,
        timestamp_sec: float
    ):
        """
        Maintains sliding position history window for a track on a given camera.
        """
        key = f"{camera_id}:{local_track_id}"
        if key not in self._track_histories:
            self._track_histories[key] = []

        history = self._track_histories[key]
        history.append((x, y, timestamp_sec))
        # Keep last 30 positions (approx. 10-30 seconds of activity)
        if len(history) > 30:
            self._track_histories[key] = history[-30:]

    def analyze_track_behaviour(
        self,
        camera_id: str,
        local_track_id: int,
        object_type: str = "person",
        global_track_id: Optional[str] = None,
        zone_id: Optional[str] = None,
        zone_name: Optional[str] = None,
        zone_type: str = "RESTRICTED",
        zone_polygon: Optional[List[Dict[str, float]]] = None,
        is_night: bool = False,
        is_authorized: bool = False,
        is_suspect: bool = False,
        confidence: float = 0.90
    ) -> List[BehaviourEvent]:
        """
        Analyzes track trajectory, checks rules, runs multi-signal correlation,
        evaluates risk scores and persists detected behavioural events.
        """
        key = f"{camera_id}:{local_track_id}"
        history = self._track_histories.get(key, [])
        if len(history) < 4:
            return []

        now = datetime.utcnow()
        detected_events: List[BehaviourEvent] = []

        # 1. Kinematic Analysis
        kinematics = feature_extractor.calculate_kinematics(history)
        speed = kinematics["speed"]
        acc = kinematics["acceleration"]

        # Sudden Running / Speed Anomaly for persons
        if object_type == "person" and (speed > 3.8 or acc > 2.5):
            evt = self._check_and_emit_anomaly(
                camera_id=camera_id,
                local_track_id=local_track_id,
                global_track_id=global_track_id,
                object_type=object_type,
                event_type="SUDDEN_SPEED_CHANGE",
                zone_id=zone_id,
                zone_name=zone_name,
                zone_type=zone_type,
                is_night=is_night,
                is_sudden_speed=True,
                is_authorized=is_authorized,
                is_suspect=is_suspect,
                confidence=confidence,
                details={"speed": speed, "acceleration": acc}
            )
            if evt: detected_events.append(evt)

        # Rapid Direction Changes
        has_rapid_dir, dir_changes = feature_extractor.detect_rapid_direction_changes(history)
        if has_rapid_dir:
            evt = self._check_and_emit_anomaly(
                camera_id=camera_id,
                local_track_id=local_track_id,
                global_track_id=global_track_id,
                object_type=object_type,
                event_type="RAPID_DIRECTION_CHANGE",
                zone_id=zone_id,
                zone_name=zone_name,
                zone_type=zone_type,
                is_night=is_night,
                is_rapid_direction=True,
                is_authorized=is_authorized,
                is_suspect=is_suspect,
                confidence=confidence,
                details={"direction_changes": dir_changes}
            )
            if evt: detected_events.append(evt)

        # Stop-and-Go Pattern
        has_stop_go, stops = feature_extractor.detect_stop_and_go(history)
        if has_stop_go:
            evt = self._check_and_emit_anomaly(
                camera_id=camera_id,
                local_track_id=local_track_id,
                global_track_id=global_track_id,
                object_type=object_type,
                event_type="STOP_GO_ANOMALY",
                zone_id=zone_id,
                zone_name=zone_name,
                zone_type=zone_type,
                is_night=is_night,
                is_stop_and_go=True,
                is_authorized=is_authorized,
                is_suspect=is_suspect,
                confidence=confidence,
                details={"stops_count": stops}
            )
            if evt: detected_events.append(evt)

        # Fence-Edge Movement
        if zone_polygon and feature_extractor.detect_fence_edge_movement(history, zone_polygon):
            evt = self._check_and_emit_anomaly(
                camera_id=camera_id,
                local_track_id=local_track_id,
                global_track_id=global_track_id,
                object_type=object_type,
                event_type="FENCE_EDGE_MOVEMENT",
                zone_id=zone_id,
                zone_name=zone_name,
                zone_type=zone_type,
                is_night=is_night,
                is_fence_edge=True,
                is_authorized=is_authorized,
                is_suspect=is_suspect,
                confidence=confidence,
                details={"zone": zone_name or zone_id}
            )
            if evt: detected_events.append(evt)

        return detected_events

    def _check_and_emit_anomaly(
        self,
        camera_id: str,
        local_track_id: Optional[int],
        global_track_id: Optional[str],
        object_type: str,
        event_type: str,
        zone_id: Optional[str] = None,
        zone_name: Optional[str] = None,
        zone_type: str = "RESTRICTED",
        is_night: bool = False,
        is_repeated_approach: bool = False,
        is_fence_edge: bool = False,
        is_route_anomaly: bool = False,
        is_rapid_direction: bool = False,
        is_stop_and_go: bool = False,
        is_sudden_speed: bool = False,
        is_density_anomaly: bool = False,
        is_vehicle_dwell: bool = False,
        is_authorized: bool = False,
        is_suspect: bool = False,
        has_zone_breach: bool = False,
        confidence: float = 0.90,
        details: Optional[Dict[str, Any]] = None
    ) -> Optional[BehaviourEvent]:
        """
        Evaluates risk score, enforces cooldown deduplication, and records BehaviourEvent.
        """
        cooldown_key = f"{camera_id}:{local_track_id or 0}:{event_type}"
        now = datetime.utcnow()

        last_time = self._cooldown_map.get(cooldown_key)
        if last_time and (now - last_time).total_seconds() < 45.0:
            return None # Cooldown active

        self._cooldown_map[cooldown_key] = now

        # Multi-Signal Risk Assessment
        risk_score, decayed_score, level, factors, counter_factors, _ = explainable_risk_engine.assess_risk(
            event_type=event_type,
            zone_type=zone_type,
            is_repeated_approach=is_repeated_approach,
            is_fence_edge=is_fence_edge,
            is_route_anomaly=is_route_anomaly,
            is_rapid_direction=is_rapid_direction,
            is_stop_and_go=is_stop_and_go,
            is_sudden_speed=is_sudden_speed,
            is_density_anomaly=is_density_anomaly,
            is_vehicle_dwell=is_vehicle_dwell,
            is_night=is_night,
            is_authorized_watchlist=is_authorized,
            is_suspect_watchlist=is_suspect,
            has_zone_breach=has_zone_breach,
            detection_confidence=confidence
        )

        db: Session = SessionLocal()
        try:
            event_id = f"BHV-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            event = BehaviourEvent(
                event_id=event_id,
                global_track_id=global_track_id,
                camera_id=camera_id,
                local_track_id=local_track_id,
                object_type=object_type,
                event_type=event_type,
                risk_score=risk_score,
                decayed_risk_score=decayed_score,
                risk_level=level,
                confidence=confidence,
                zone_id=zone_id,
                zone_name=zone_name,
                factors_json=json.dumps(factors),
                counter_factors_json=json.dumps(counter_factors),
                details_json=json.dumps(details or {}),
                status="DETECTED",
                created_at=now,
                updated_at=now
            )
            db.add(event)
            db.commit()
            db.refresh(event)
            logger.info(f"Emitted Behaviour Anomaly {event_id} ({event_type}) Risk={risk_score} Level={level}")
            return event
        finally:
            db.close()

    def record_feedback(
        self,
        event_id: str,
        feedback_type: str,
        notes: Optional[str] = None,
        operator_username: str = "operator"
    ) -> BehaviourFeedback:
        """
        Stores operator feedback for false-positive analytics and audit trails.
        """
        db: Session = SessionLocal()
        try:
            fb = BehaviourFeedback(
                event_id=event_id,
                feedback_type=feedback_type,
                operator_username=operator_username,
                notes=notes,
                created_at=datetime.utcnow()
            )
            db.add(fb)

            # Update event status
            event = db.query(BehaviourEvent).filter(BehaviourEvent.event_id == event_id).first()
            if event:
                if feedback_type == "FALSE_POSITIVE":
                    event.status = "FALSE_ALARM"
                elif feedback_type == "CORRECT_DETECTION":
                    event.status = "CONFIRMED"
                elif feedback_type == "NEEDS_REVIEW":
                    event.status = "INVESTIGATING"

            audit = SecurityAuditLog(
                username=operator_username,
                action=f"BEHAVIOUR_FEEDBACK_{feedback_type}",
                resource_type="BEHAVIOUR_EVENT",
                resource_id=event_id,
                details=json.dumps({"feedback": feedback_type, "notes": notes or ""})
            )
            db.add(audit)
            db.commit()
            db.refresh(fb)
            return fb
        finally:
            db.close()

behaviour_service = BehaviourIntelligenceService()
