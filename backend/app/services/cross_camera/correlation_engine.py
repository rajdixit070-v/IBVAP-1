import json
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.global_track import GlobalTrack
from app.models.track_observation import TrackObservation
from app.models.track_association import TrackAssociation
from app.models.movement_anomaly import MovementAnomaly
from app.models.audit_log import SecurityAuditLog
from app.services.cross_camera.camera_graph import camera_graph_service

logger = logging.getLogger("ibvap.cross_camera.correlation")

class CrossCameraCorrelationEngine:
    """
    Multi-signal probabilistic cross-camera correlation engine for continuous
    movement reconstruction, vehicle journeys, and anomaly detection.
    """

    def ingest_observation(
        self,
        camera_id: str,
        local_track_id: int,
        object_type: str,
        timestamp: Optional[datetime] = None,
        bbox: Optional[List[float]] = None,
        direction: str = "NORTH",
        plate_number: Optional[str] = None,
        plate_confidence: Optional[float] = None,
        appearance_features: Optional[Dict[str, Any]] = None,
        confidence: float = 0.90
    ) -> Tuple[GlobalTrack, TrackObservation, Optional[TrackAssociation]]:
        """
        Ingests a local camera sighting, searches for candidate global tracks,
        computes association confidence, updates/creates the global track, and flags anomalies.
        """
        db: Session = SessionLocal()
        try:
            now = timestamp or datetime.utcnow()
            obs_id = f"OBS-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

            # 1. Candidate Search: active global tracks of same object_type within time window (15 mins)
            candidate_window_start = now - timedelta(minutes=15)
            active_tracks = db.query(GlobalTrack).filter(
                GlobalTrack.object_type == object_type,
                GlobalTrack.status.in_(["ACTIVE", "CREATED", "PAUSED"]),
                GlobalTrack.last_observation_time >= candidate_window_start
            ).order_by(GlobalTrack.last_observation_time.desc()).all()

            best_track: Optional[GlobalTrack] = None
            best_score = 0.0
            best_last_obs: Optional[TrackObservation] = None
            best_time_delta: float = 999999.0
            best_anomaly: Optional[str] = None

            for track in active_tracks:
                # Find last observation of this global track
                last_obs = db.query(TrackObservation).filter(
                    TrackObservation.global_track_id == track.global_track_id
                ).order_by(TrackObservation.timestamp.desc()).first()

                if not last_obs:
                    continue

                # Plate conflict check for vehicles
                if plate_number and track.primary_identifier and plate_number != track.primary_identifier:
                    continue

                # Same camera duplicate / continuation
                if last_obs.camera_id == camera_id and last_obs.local_track_id == local_track_id:
                    best_track = track
                    best_score = 0.98
                    best_last_obs = last_obs
                    best_time_delta = max(1.0, (now - last_obs.timestamp).total_seconds())
                    best_anomaly = None
                    break

                time_delta_sec = max(1.0, (now - last_obs.timestamp).total_seconds())

                is_valid, anom_type, topo_conf = camera_graph_service.validate_transition(
                    from_cam=last_obs.camera_id,
                    to_cam=camera_id,
                    time_delta_sec=time_delta_sec
                )

                score = self._calculate_association_score(
                    object_type=object_type,
                    from_cam=last_obs.camera_id,
                    to_cam=camera_id,
                    time_delta_sec=time_delta_sec,
                    topo_conf=topo_conf,
                    from_dir=last_obs.direction,
                    to_dir=direction,
                    from_plate=last_obs.plate_number or track.primary_identifier,
                    to_plate=plate_number,
                    from_app=json.loads(last_obs.appearance_features_json or "{}"),
                    to_app=appearance_features or {}
                )

                if plate_number and track.primary_identifier == plate_number:
                    score = max(score, 0.92)

                if score > best_score or (score == best_score and time_delta_sec < best_time_delta):
                    best_score = score
                    best_track = track
                    best_last_obs = last_obs
                    best_time_delta = time_delta_sec
                    best_anomaly = anom_type if not is_valid else None

            # 2. Determine Match Threshold (require >= 0.50 for valid association)
            created_assoc: Optional[TrackAssociation] = None
            if best_track and (best_score >= 0.50 or (plate_number and best_track.primary_identifier == plate_number)):
                # Associate with existing global track
                global_track = best_track
                global_track.previous_camera_id = global_track.current_camera_id
                global_track.current_camera_id = camera_id
                global_track.last_observation_time = now
                global_track.total_observations += 1
                global_track.overall_confidence = round((global_track.overall_confidence * 0.6 + best_score * 0.4), 2)
                global_track.status = "ACTIVE"

                if plate_number and not global_track.primary_identifier:
                    global_track.primary_identifier = plate_number

                # Record Observation
                obs = TrackObservation(
                    observation_id=obs_id,
                    global_track_id=global_track.global_track_id,
                    camera_id=camera_id,
                    local_track_id=local_track_id,
                    object_type=object_type,
                    timestamp=now,
                    bbox_json=json.dumps(bbox or [0, 0, 0, 0]),
                    direction=direction,
                    appearance_features_json=json.dumps(appearance_features or {}),
                    plate_number=plate_number,
                    plate_confidence=plate_confidence,
                    confidence=confidence,
                    created_at=now
                )
                db.add(obs)
                db.flush()

                # Determine match category
                if best_score >= 0.80:
                    match_cat = "HIGH_CONFIDENCE_MATCH"
                    assoc_status = "AUTO_CONFIRMED"
                elif best_score >= 0.50:
                    match_cat = "MEDIUM_CONFIDENCE_MATCH"
                    assoc_status = "PENDING_REVIEW"
                else:
                    match_cat = "LOW_CONFIDENCE_MATCH"
                    assoc_status = "PENDING_REVIEW"

                if best_last_obs and best_last_obs.camera_id != camera_id:
                    asc_id = f"ASC-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                    created_assoc = TrackAssociation(
                        association_id=asc_id,
                        global_track_id=global_track.global_track_id,
                        from_observation_id=best_last_obs.observation_id,
                        to_observation_id=obs_id,
                        from_camera_id=best_last_obs.camera_id,
                        to_camera_id=camera_id,
                        association_score=round(best_score, 2),
                        match_category=match_cat,
                        status=assoc_status,
                        created_at=now
                    )
                    db.add(created_assoc)

            else:
                # Create New Global Track
                new_gt_id = f"GT-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                global_track = GlobalTrack(
                    global_track_id=new_gt_id,
                    object_type=object_type,
                    primary_identifier=plate_number or f"{object_type.title()} #{local_track_id}",
                    status="ACTIVE",
                    current_camera_id=camera_id,
                    previous_camera_id=None,
                    last_observation_time=now,
                    total_observations=1,
                    overall_confidence=confidence,
                    created_at=now,
                    updated_at=now
                )
                db.add(global_track)
                db.flush()

                obs = TrackObservation(
                    observation_id=obs_id,
                    global_track_id=new_gt_id,
                    camera_id=camera_id,
                    local_track_id=local_track_id,
                    object_type=object_type,
                    timestamp=now,
                    bbox_json=json.dumps(bbox or [0, 0, 0, 0]),
                    direction=direction,
                    appearance_features_json=json.dumps(appearance_features or {}),
                    plate_number=plate_number,
                    plate_confidence=plate_confidence,
                    confidence=confidence,
                    created_at=now
                )
                db.add(obs)

            # Record Anomaly if detected on transition
            if best_anomaly and best_last_obs:
                anm_id = f"ANM-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                sev = "CRITICAL" if best_anomaly == "IMPOSSIBLE_TRANSITION" else "HIGH"
                anomaly = MovementAnomaly(
                    anomaly_id=anm_id,
                    global_track_id=global_track.global_track_id,
                    anomaly_type=best_anomaly,
                    from_camera_id=best_last_obs.camera_id,
                    to_camera_id=camera_id,
                    time_delta_sec=best_time_delta,
                    severity=sev,
                    details_json=json.dumps({
                        "from_camera": best_last_obs.camera_id,
                        "to_camera": camera_id,
                        "observed_delta_sec": best_time_delta
                    }),
                    created_at=now
                )
                db.add(anomaly)
                logger.warning(f"Logged Movement Anomaly {anm_id}: {best_anomaly} between {best_last_obs.camera_id} and {camera_id}")

            db.commit()
            db.refresh(global_track)
            db.refresh(obs)
            if created_assoc:
                db.refresh(created_assoc)

            return global_track, obs, created_assoc

        except Exception as e:
            logger.error(f"Error in cross-camera correlation: {e}", exc_info=True)
            db.rollback()
            raise
        finally:
            db.close()

    def _calculate_association_score(
        self,
        object_type: str,
        from_cam: str,
        to_cam: str,
        time_delta_sec: float,
        topo_conf: float,
        from_dir: str,
        to_dir: str,
        from_plate: Optional[str],
        to_plate: Optional[str],
        from_app: Dict[str, Any],
        to_app: Dict[str, Any]
    ) -> float:
        """
        Calculates normalized association confidence score [0.0 - 1.0].
        """
        # Direction Consistency Score (0.0 to 1.0)
        dir_score = 1.0 if from_dir == to_dir or from_dir == "ANY" or to_dir == "ANY" else 0.60

        # Temporal Decay
        if time_delta_sec < 5.0:
            time_score = 0.20
        elif time_delta_sec <= 180.0:
            time_score = 1.00
        else:
            time_score = max(0.20, 1.0 - (time_delta_sec - 180.0) / 600.0)

        if object_type == "vehicle":
            # Vehicle Correlation
            if from_plate and to_plate:
                if from_plate == to_plate:
                    plate_score = 1.0
                elif len(from_plate) == len(to_plate) and sum(a != b for a, b in zip(from_plate, to_plate)) == 1:
                    plate_score = 0.70 # 1-char OCR discrepancy
                else:
                    return 0.10 # Distinct license plates -> NO MATCH
            else:
                plate_score = 0.50

            total = (plate_score * 0.50) + (topo_conf * 0.25) + (time_score * 0.15) + (dir_score * 0.10)
            return round(min(1.0, max(0.0, total)), 2)

        else:
            # Person Correlation
            app_score = 0.70
            if from_app and to_app and from_app.get("upper_color") and to_app.get("upper_color"):
                if from_app.get("upper_color") == to_app.get("upper_color"):
                    app_score = 0.95
                else:
                    return 0.20 # Clearly different clothing -> NO MATCH

            total = (topo_conf * 0.30) + (time_score * 0.30) + (app_score * 0.25) + (dir_score * 0.15)
            return round(min(1.0, max(0.0, total)), 2)

    def review_association(
        self,
        association_id: str,
        action: str,
        notes: Optional[str] = None,
        operator_username: str = "operator"
    ) -> TrackAssociation:
        """
        Auditable human-in-the-loop review of medium/low confidence cross-camera associations.
        """
        db: Session = SessionLocal()
        try:
            assoc = db.query(TrackAssociation).filter(
                TrackAssociation.association_id == association_id
            ).first()

            if not assoc:
                raise ValueError(f"Association {association_id} not found.")

            target_status = "CONFIRMED" if action.upper() == "CONFIRM" else "REJECTED"
            assoc.status = target_status
            assoc.reviewed_by = operator_username
            assoc.review_notes = notes

            details_payload = json.dumps({"status": target_status, "notes": notes or ""})
            audit = SecurityAuditLog(
                username=operator_username,
                action=f"ASSOCIATION_{target_status}",
                resource_type="TRACK_ASSOCIATION",
                resource_id=association_id,
                details=details_payload
            )
            db.add(audit)
            db.commit()
            db.refresh(assoc)
            logger.info(f"Association {association_id} {target_status} by {operator_username}")
            return assoc
        finally:
            db.close()

# Global Singleton
correlation_engine = CrossCameraCorrelationEngine()
