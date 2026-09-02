import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any, Set
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.zone import SecurityZone
from app.services.ai.tracker import STrack
from app.services.intelligence.spatial import is_point_in_polygon, get_ground_plane_point_normalized
from app.services.intelligence.behaviour_analyzer import (
    is_night_hour,
    is_direction_forbidden,
    check_loitering,
    check_stationary_vehicle,
    check_rapid_movement,
    check_group_movement
)
from app.services.intelligence.event_manager import security_event_manager

logger = logging.getLogger("ibvap.intelligence.zone_analyzer")

class CameraZoneStateTracker:
    """
    Maintains active track-to-zone occupancy states for a single camera.
    """
    def __init__(self, camera_id: str):
        self.camera_id = camera_id
        # (zone_id, track_id) -> { "entry_time": datetime, "is_inside": bool, "loitering_triggered": bool, "stationary_triggered": bool, "direction_triggered": bool }
        self._occupancy: Dict[str, Dict[str, Any]] = {}
        self._cached_zones: List[Dict[str, Any]] = []
        self._last_zone_fetch = datetime.min
        self._fov_last_triggered: Dict[int, datetime] = {}

    def refresh_zones_if_needed(self):
        """Reloads active security zones from DB every 5 seconds."""
        now = datetime.utcnow()
        if (now - self._last_zone_fetch).total_seconds() > 5.0:
            db: Session = SessionLocal()
            try:
                records = db.query(SecurityZone).filter(
                    SecurityZone.camera_id == self.camera_id,
                    SecurityZone.enabled == True
                ).all()
                
                self._cached_zones = [
                    {
                        "zone_id": z.zone_id,
                        "name": z.name,
                        "zone_type": z.zone_type,
                        "polygon": json.loads(z.polygon_json),
                        "monitored_classes": json.loads(z.monitored_classes_json or '[]'),
                        "direction_rule": z.direction_rule,
                        "severity": z.severity
                    }
                    for z in records
                ]
                self._last_zone_fetch = now
            except Exception as e:
                logger.error(f"Failed to fetch zones for camera {self.camera_id}: {e}")
            finally:
                db.close()

    def analyze_tracks(self, tracks: List[STrack], frame_width: int = 1920, frame_height: int = 1080, frame: Optional[Any] = None):
        """
        Executes spatial zone intersection, boundary crossing, and behavioural anomaly detection.
        Captures cryptographic forensic evidence snapshots on every confirmed detection.
        """
        self.refresh_zones_if_needed()
        if not self._cached_zones:
            # If no virtual boundary polygons are configured on this camera, zone analysis is skipped.
            return

        now = datetime.utcnow()
        is_night = is_night_hour(20, 6)

        # Pre-compute tracks that fall inside configured virtual zones
        tracks_in_zones = set()
        for track in tracks:
            gp_norm = get_ground_plane_point_normalized(track.bbox, frame_width, frame_height)
            for zone in self._cached_zones:
                if is_point_in_polygon(gp_norm["x"], gp_norm["y"], zone["polygon"]):
                    tracks_in_zones.add(track.track_id)
                    break

        # 1. Real-Time Field of View (FOV) Detection for tracks outside configured zones
        for track in tracks:
            if track.track_id in tracks_in_zones:
                continue  # Handled with high-priority zone boundary crossing below
            if track.frame_count >= 1:
                last_time = self._fov_last_triggered.get(track.track_id)
                if not last_time or (now - last_time).total_seconds() > 8.0:
                    self._fov_last_triggered[track.track_id] = now
                    
                    obj_cat = track.category.lower()
                    event_type = (
                        "PERSON_DETECTED" if obj_cat in ["person", "human"]
                        else "VEHICLE_DETECTED" if obj_cat in ["vehicle", "car", "truck", "motorcycle", "bus"]
                        else "ANIMAL_INTRUSION" if obj_cat in ["animal", "dog", "horse", "cow", "cat"]
                        else "DRONE_DETECTED" if obj_cat in ["drone", "uav", "aircraft"]
                        else "SUSPICIOUS_OBJECT_DETECTED"
                    )

                    evd = None
                    if frame is not None and frame.size > 0:
                        try:
                            from app.services.evidence.evidence_manager import evidence_manager
                            evd = evidence_manager.capture_and_save_frame(
                                camera_id=self.camera_id,
                                frame=frame,
                                track=track,
                                event_type=event_type
                            )
                        except Exception as fe_err:
                            logger.warning(f"FOV evidence capture error on {self.camera_id}: {fe_err}")

                    security_event_manager.dispatch_security_event(
                        camera_id=self.camera_id,
                        track_id=track.track_id,
                        object_type=track.object_type,
                        event_type=event_type,
                        zone_id=None,
                        zone_name="Camera Field of View",
                        zone_type="MONITORED",
                        is_night=is_night,
                        confidence=track.confidence,
                        bbox=track.bbox,
                        direction=track.direction,
                        speed=track.speed,
                        timeline_message=f"Live Detection: {track.object_type.capitalize()} #{track.track_id} confirmed in camera field of view (Confidence: {int(track.confidence * 100)}%)",
                        evidence_id=evd.evidence_id if evd else None,
                        evidence_path=evd.file_path if evd else None
                    )

                    # Feed observation to Multimodal Tactical AI Engine
                    try:
                        from app.services.multimodal.multimodal_engine import MultimodalEngine
                        from app.database import SessionLocal
                        db_mm = SessionLocal()
                        try:
                            MultimodalEngine.record_observation({
                                "camera_id": self.camera_id,
                                "track_id": track.track_id,
                                "observation_type": "PERSON" if obj_cat in ["person", "human"] else "VEHICLE" if obj_cat in ["vehicle", "car", "truck", "motorcycle", "bus"] else "ANIMAL" if obj_cat in ["animal", "dog", "horse", "cow", "cat"] else "DRONE" if obj_cat in ["drone", "uav"] else "OTHER",
                                "confidence": track.confidence,
                                "bbox": track.bbox,
                                "speed": track.speed
                            }, db=db_mm, auto_fuse=True)
                        finally:
                            db_mm.close()
                    except Exception as mm_err:
                        logger.debug(f"Multimodal observation feed notice: {mm_err}")

        if not self._cached_zones:
            # If no virtual boundary polygons are configured on this camera, polygon analysis is complete.
            return

        # 2. Group Movement Evaluation
        groups = check_group_movement(tracks, max_distance_px=140.0)
        for group in groups:
            sample_track = next((t for t in tracks if t.track_id == group[0]), None)
            if sample_track:
                evd = None
                if frame is not None:
                    try:
                        from app.services.evidence.evidence_manager import evidence_manager
                        evd = evidence_manager.capture_and_save_frame(
                            camera_id=self.camera_id,
                            frame=frame,
                            track=sample_track,
                            event_type="GROUP_MOVEMENT"
                        )
                    except Exception:
                        pass
                security_event_manager.dispatch_security_event(
                    camera_id=self.camera_id,
                    track_id=group[0],
                    object_type=sample_track.object_type,
                    event_type="GROUP_MOVEMENT",
                    is_night=is_night,
                    is_group=True,
                    confidence=sample_track.confidence,
                    bbox=sample_track.bbox,
                    direction=sample_track.direction,
                    speed=sample_track.speed,
                    timeline_message=f"Group movement detected: {len(group)} subjects moving in coordination (Tracks: {group})",
                    evidence_id=evd.evidence_id if evd else None,
                    evidence_path=evd.file_path if evd else None
                )

        # 2b. Crowd Gathering Evaluation
        person_tracks_in_cam = [t for t in tracks if t.category == "person" and t.frame_count >= 2]
        if len(person_tracks_in_cam) >= 4:
            sample_track = person_tracks_in_cam[0]
            evd = None
            if frame is not None:
                try:
                    from app.services.evidence.evidence_manager import evidence_manager
                    evd = evidence_manager.capture_and_save_frame(
                        camera_id=self.camera_id,
                        frame=frame,
                        track=sample_track,
                        event_type="CROWD_GATHERING"
                    )
                except Exception:
                    pass
            security_event_manager.dispatch_security_event(
                camera_id=self.camera_id,
                track_id=sample_track.track_id,
                object_type="person",
                event_type="CROWD_GATHERING",
                is_night=is_night,
                is_group=True,
                confidence=sample_track.confidence,
                bbox=sample_track.bbox,
                direction=sample_track.direction,
                speed=sample_track.speed,
                timeline_message=f"Crowd gathering detected: {len(person_tracks_in_cam)} persons detected concurrently on {self.camera_id}",
                evidence_id=evd.evidence_id if evd else None,
                evidence_path=evd.file_path if evd else None
            )

        # 3. Per-Track Per-Zone Analysis
        for track in tracks:
            # Calculate ground plane normalized bottom-center point
            gp_norm = get_ground_plane_point_normalized(track.bbox, frame_width, frame_height)

            for zone in self._cached_zones:
                zone_id = zone["zone_id"]
                zone_name = zone["name"]
                zone_type = zone["zone_type"]
                monitored = zone["monitored_classes"]
                direction_rule = zone["direction_rule"]

                # Animal / Non-threat filtering: Skip if category is not monitored
                if track.category not in monitored and track.object_type not in monitored:
                    continue

                # Point-in-Polygon calculation
                inside = is_point_in_polygon(gp_norm["x"], gp_norm["y"], zone["polygon"])
                occ_key = f"{zone_id}:{track.track_id}"
                state = self._occupancy.get(occ_key)

                # State Transition 1: OUTSIDE -> INSIDE (Boundary Crossing / Intrusion)
                if inside:
                    # Temporal consistency check: Require at least 2 confirmed frames
                    if track.frame_count < 2:
                        continue

                    if not state or not state.get("is_inside"):
                        # ENTER EVENT (ZONE_INTRUSION)
                        self._occupancy[occ_key] = {
                            "entry_time": now,
                            "is_inside": True,
                            "loitering_triggered": False,
                            "stationary_triggered": False,
                            "direction_triggered": False
                        }

                        # Check for forbidden direction at moment of entry
                        is_forbid = is_direction_forbidden(track.direction, direction_rule)

                        evd = None
                        if frame is not None:
                            try:
                                from app.services.evidence.evidence_manager import evidence_manager
                                evd = evidence_manager.capture_and_save_frame(
                                    camera_id=self.camera_id,
                                    frame=frame,
                                    track=track,
                                    event_type="ZONE_INTRUSION"
                                )
                            except Exception:
                                pass

                        security_event_manager.dispatch_security_event(
                            camera_id=self.camera_id,
                            track_id=track.track_id,
                            object_type=track.object_type,
                            event_type="ZONE_INTRUSION",
                            zone_id=zone_id,
                            zone_name=zone_name,
                            zone_type=zone_type,
                            is_night=is_night,
                            is_forbidden_direction=is_forbid,
                            confidence=track.confidence,
                            bbox=track.bbox,
                            direction=track.direction,
                            speed=track.speed,
                            timeline_message=f"{track.object_type.capitalize()} #{track.track_id} crossed boundary into {zone_name} ({zone_type})",
                            evidence_id=evd.evidence_id if evd else None,
                            evidence_path=evd.file_path if evd else None
                        )

                    else:
                        # Subject remains INSIDE: Evaluate Behavioural Anomalies
                        entry_time = state["entry_time"]

                        # Check Loitering
                        if not state.get("loitering_triggered"):
                            if check_loitering(track, entry_time, min_duration_sec=10.0):
                                state["loitering_triggered"] = True
                                evd = None
                                if frame is not None:
                                    try:
                                        from app.services.evidence.evidence_manager import evidence_manager
                                        evd = evidence_manager.capture_and_save_frame(
                                            camera_id=self.camera_id,
                                            frame=frame,
                                            track=track,
                                            event_type="LOITERING"
                                        )
                                    except Exception:
                                        pass
                                security_event_manager.dispatch_security_event(
                                    camera_id=self.camera_id,
                                    track_id=track.track_id,
                                    object_type=track.object_type,
                                    event_type="LOITERING",
                                    zone_id=zone_id,
                                    zone_name=zone_name,
                                    zone_type=zone_type,
                                    is_night=is_night,
                                    is_loitering=True,
                                    confidence=track.confidence,
                                    bbox=track.bbox,
                                    direction=track.direction,
                                    speed=track.speed,
                                    timeline_message=f"{track.object_type.capitalize()} #{track.track_id} loitering in {zone_name} exceeding 10s dwell limit",
                                    evidence_id=evd.evidence_id if evd else None,
                                    evidence_path=evd.file_path if evd else None
                                )

                        # Check Stationary Vehicle
                        if not state.get("stationary_triggered") and track.category == "vehicle":
                            if check_stationary_vehicle(track, entry_time, min_duration_sec=12.0):
                                state["stationary_triggered"] = True
                                evd = None
                                if frame is not None:
                                    try:
                                        from app.services.evidence.evidence_manager import evidence_manager
                                        evd = evidence_manager.capture_and_save_frame(
                                            camera_id=self.camera_id,
                                            frame=frame,
                                            track=track,
                                            event_type="STATIONARY_VEHICLE"
                                        )
                                    except Exception:
                                        pass
                                security_event_manager.dispatch_security_event(
                                    camera_id=self.camera_id,
                                    track_id=track.track_id,
                                    object_type=track.object_type,
                                    event_type="STATIONARY_VEHICLE",
                                    zone_id=zone_id,
                                    zone_name=zone_name,
                                    zone_type=zone_type,
                                    is_night=is_night,
                                    is_stationary_vehicle=True,
                                    confidence=track.confidence,
                                    bbox=track.bbox,
                                    direction=track.direction,
                                    speed=track.speed,
                                    timeline_message=f"Suspicious stationary vehicle #{track.track_id} stopped in {zone_name} (>12s)",
                                    evidence_id=evd.evidence_id if evd else None,
                                    evidence_path=evd.file_path if evd else None
                                )

                        # Check Wrong Direction Breach
                        if not state.get("direction_triggered") and direction_rule != "NONE":
                            if is_direction_forbidden(track.direction, direction_rule):
                                state["direction_triggered"] = True
                                evd = None
                                if frame is not None:
                                    try:
                                        from app.services.evidence.evidence_manager import evidence_manager
                                        evd = evidence_manager.capture_and_save_frame(
                                            camera_id=self.camera_id,
                                            frame=frame,
                                            track=track,
                                            event_type="WRONG_DIRECTION"
                                        )
                                    except Exception:
                                        pass
                                security_event_manager.dispatch_security_event(
                                    camera_id=self.camera_id,
                                    track_id=track.track_id,
                                    object_type=track.object_type,
                                    event_type="WRONG_DIRECTION",
                                    zone_id=zone_id,
                                    zone_name=zone_name,
                                    zone_type=zone_type,
                                    is_night=is_night,
                                    is_forbidden_direction=True,
                                    confidence=track.confidence,
                                    bbox=track.bbox,
                                    direction=track.direction,
                                    speed=track.speed,
                                    timeline_message=f"{track.object_type.capitalize()} #{track.track_id} moving in forbidden direction ({track.direction}) in {zone_name}",
                                    evidence_id=evd.evidence_id if evd else None,
                                    evidence_path=evd.file_path if evd else None
                                )

                        # Check Rapid Movement
                        if check_rapid_movement(track, speed_threshold=70.0):
                            security_event_manager.dispatch_security_event(
                                camera_id=self.camera_id,
                                track_id=track.track_id,
                                object_type=track.object_type,
                                event_type="RAPID_MOVEMENT",
                                zone_id=zone_id,
                                zone_name=zone_name,
                                zone_type=zone_type,
                                is_night=is_night,
                                is_rapid_movement=True,
                                confidence=track.confidence,
                                bbox=track.bbox,
                                direction=track.direction,
                                speed=track.speed,
                                timeline_message=f"Rapid abnormal velocity ({round(track.speed)} px/s) detected for track #{track.track_id} in {zone_name}"
                            )

                else:
                    # State Transition 2: INSIDE -> OUTSIDE (Zone Exit)
                    if state and state.get("is_inside"):
                        state["is_inside"] = False
                        logger.info(f"Track #{track.track_id} exited {zone_name}")
                        security_event_manager.dispatch_security_event(
                            camera_id=self.camera_id,
                            track_id=track.track_id,
                            object_type=track.object_type,
                            event_type="ZONE_EXIT",
                            zone_id=zone_id,
                            zone_name=zone_name,
                            zone_type=zone_type,
                            confidence=track.confidence,
                            bbox=track.bbox,
                            direction=track.direction,
                            speed=track.speed,
                            timeline_message=f"{track.object_type.capitalize()} #{track.track_id} exited {zone_name}"
                        )

class ZoneIntelligenceService:
    """
    Singleton service managing per-camera zone state trackers.
    """
    def __init__(self):
        self._trackers: Dict[str, CameraZoneStateTracker] = {}

    def get_tracker(self, camera_id: str) -> CameraZoneStateTracker:
        if camera_id not in self._trackers:
            self._trackers[camera_id] = CameraZoneStateTracker(camera_id)
        return self._trackers[camera_id]

# Global Singleton
zone_intelligence_service = ZoneIntelligenceService()
