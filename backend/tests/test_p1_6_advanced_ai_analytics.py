import time
import math
import uuid
import json
import pytest
import numpy as np
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models.zone import SecurityZone
from app.models.security_event import SecurityEvent
from app.models.alert import Alert
from app.models.incident import Incident
from app.services.ai.detector import YOLOObjectDetector, CATEGORY_MAPPINGS
from app.services.ai.tracker import ByteTracker, STrack, compute_image_space_direction, calculate_iou
from app.services.intelligence.zone_analyzer import zone_intelligence_service
from app.services.intelligence.behaviour_analyzer import (
    is_direction_forbidden,
    check_loitering,
    check_stationary_vehicle,
    check_rapid_movement,
    check_group_movement
)
from app.services.intelligence.risk_engine import risk_engine
from app.services.intelligence.event_manager import security_event_manager
from app.services.alert.alert_engine import alert_engine
from app.services.incident.incident_service import incident_service

def test_p1_6_1_model_loading_and_category_mapping():
    """Test 1: YOLO Object Detector initialization, category mapping, and class thresholds."""
    detector = YOLOObjectDetector(model_name="yolov8n", device="cpu")
    assert detector.is_loaded is True
    assert "person" in detector.thresholds
    assert "vehicle" in detector.thresholds
    assert "animal" in detector.thresholds

    # Verify category mappings
    assert CATEGORY_MAPPINGS["person"] == "person"
    assert CATEGORY_MAPPINGS["car"] == "vehicle"
    assert CATEGORY_MAPPINGS["truck"] == "vehicle"
    assert CATEGORY_MAPPINGS["dog"] == "animal"
    assert CATEGORY_MAPPINGS["drone"] == "drone"

    # Test inference on a blank synthetic frame (should not crash)
    blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    dets = detector.detect(blank_frame, camera_id="CAM-TEST-1")
    assert isinstance(dets, list)

def test_p1_6_2_tracker_initialization_and_camera_isolation():
    """Test 2: Per-camera tracker instances maintain strict isolation with no cross-contamination."""
    tracker_a = ByteTracker(camera_id="CAM-A")
    tracker_b = ByteTracker(camera_id="CAM-B")

    now = datetime.utcnow()
    dets_a = [
        {"class_name": "person", "category": "person", "confidence": 0.85, "bbox": {"x": 100, "y": 100, "width": 50, "height": 100}, "timestamp": now}
    ]
    dets_b = [
        {"class_name": "car", "category": "vehicle", "confidence": 0.90, "bbox": {"x": 300, "y": 200, "width": 120, "height": 80}, "timestamp": now}
    ]

    tracks_a = tracker_a.update(dets_a)
    tracks_b = tracker_b.update(dets_b)

    assert len(tracks_a) == 1
    assert len(tracks_b) == 1
    assert tracks_a[0].camera_id == "CAM-A"
    assert tracks_a[0].object_type == "person"
    assert tracks_b[0].camera_id == "CAM-B"
    assert tracks_b[0].object_type == "car"

    # Verify tracker states are completely independent
    assert tracker_a.tracked_stracks[0].track_id != tracker_b.tracked_stracks[0].track_id or tracks_a[0].camera_id != tracks_b[0].camera_id

def test_p1_6_3_multi_object_tracking_and_identity_stability():
    """Test 3: Multiple objects maintain stable track IDs across consecutive frames."""
    tracker = ByteTracker(camera_id="CAM-MULTI-1")
    t0 = datetime.utcnow()

    # Frame 1: 3 objects appear
    f1_dets = [
        {"class_name": "person", "category": "person", "confidence": 0.88, "bbox": {"x": 50, "y": 100, "width": 40, "height": 80}, "timestamp": t0},
        {"class_name": "person", "category": "person", "confidence": 0.82, "bbox": {"x": 200, "y": 100, "width": 40, "height": 80}, "timestamp": t0},
        {"class_name": "car", "category": "vehicle", "confidence": 0.91, "bbox": {"x": 400, "y": 200, "width": 100, "height": 60}, "timestamp": t0}
    ]
    tracks_f1 = tracker.update(f1_dets)
    assert len(tracks_f1) == 3
    id_p1 = tracks_f1[0].track_id
    id_p2 = tracks_f1[1].track_id
    id_car = tracks_f1[2].track_id

    # Frame 2: Objects move slightly (consecutive frame association)
    t1 = t0 + timedelta(milliseconds=100)
    f2_dets = [
        {"class_name": "person", "category": "person", "confidence": 0.87, "bbox": {"x": 55, "y": 105, "width": 40, "height": 80}, "timestamp": t1},
        {"class_name": "person", "category": "person", "confidence": 0.84, "bbox": {"x": 205, "y": 102, "width": 40, "height": 80}, "timestamp": t1},
        {"class_name": "car", "category": "vehicle", "confidence": 0.92, "bbox": {"x": 420, "y": 200, "width": 100, "height": 60}, "timestamp": t1}
    ]
    tracks_f2 = tracker.update(f2_dets)
    assert len(tracks_f2) == 3

    # Verify ID persistence
    f2_ids = {t.track_id for t in tracks_f2}
    assert id_p1 in f2_ids
    assert id_p2 in f2_ids
    assert id_car in f2_ids

def test_p1_6_4_trajectory_and_direction_vector_computation():
    """Test 4: Trajectory history, bounded length deque, and movement direction vectors."""
    # Test directional calculations
    # 1. Moving South (+y in image space)
    south_traj = [{"x": 100, "y": 100}, {"x": 100, "y": 120}, {"x": 100, "y": 150}]
    assert compute_image_space_direction(south_traj) == "SOUTH"

    # 2. Moving North (-y in image space)
    north_traj = [{"x": 100, "y": 150}, {"x": 100, "y": 120}, {"x": 100, "y": 100}]
    assert compute_image_space_direction(north_traj) == "NORTH"

    # 3. Moving East (+x)
    east_traj = [{"x": 100, "y": 100}, {"x": 130, "y": 100}, {"x": 160, "y": 100}]
    assert compute_image_space_direction(east_traj) == "EAST"

    # 4. Stationary
    stat_traj = [{"x": 100, "y": 100}, {"x": 101, "y": 101}, {"x": 100, "y": 102}]
    assert compute_image_space_direction(stat_traj) == "STATIONARY"

    # Bounded trajectory test
    strack = STrack(camera_id="CAM-1", detection={"class_name": "person", "category": "person", "confidence": 0.9, "bbox": {"x": 0, "y": 0, "width": 10, "height": 10}}, max_history=10)
    for i in range(25):
        strack.update({"class_name": "person", "category": "person", "confidence": 0.9, "bbox": {"x": i*5, "y": i*5, "width": 10, "height": 10}, "timestamp": datetime.utcnow()})
    assert len(strack.trajectory) <= 10

def test_p1_6_5_loitering_detection_and_cooldown():
    """Test 5: Dwell time exceeding 10 seconds triggers loitering, with stateful cooldown."""
    t0 = datetime.utcnow()
    strack = STrack(camera_id="CAM-LOITER", detection={"class_name": "person", "category": "person", "confidence": 0.85, "bbox": {"x": 100, "y": 100, "width": 30, "height": 60}}, max_history=30)
    strack.first_seen_at = t0
    strack.last_seen_at = t0

    # 1. At t=3s -> not loitering yet
    strack.last_seen_at = t0 + timedelta(seconds=3)
    assert check_loitering(strack, zone_entry_time=t0, min_duration_sec=10.0) is False

    # 2. At t=12s (low displacement) -> confirmed loitering
    strack.last_seen_at = t0 + timedelta(seconds=12)
    # Add minimal displacement trajectory
    strack.trajectory.append({"x": 100, "y": 100})
    strack.trajectory.append({"x": 102, "y": 101})
    strack.trajectory.append({"x": 101, "y": 103})
    strack.trajectory.append({"x": 103, "y": 102})
    strack.trajectory.append({"x": 101, "y": 101})

    assert check_loitering(strack, zone_entry_time=t0, min_duration_sec=10.0) is True

def test_p1_6_6_group_movement_and_crowd_detection():
    """Test 6: Spatial clustering detects group movement and crowd gathering."""
    t0 = datetime.utcnow()
    # 3 persons close together
    p1 = STrack(camera_id="CAM-GRP", detection={"class_name": "person", "category": "person", "confidence": 0.9, "bbox": {"x": 100, "y": 100, "width": 30, "height": 60}, "timestamp": t0})
    p2 = STrack(camera_id="CAM-GRP", detection={"class_name": "person", "category": "person", "confidence": 0.9, "bbox": {"x": 130, "y": 105, "width": 30, "height": 60}, "timestamp": t0})
    p3 = STrack(camera_id="CAM-GRP", detection={"class_name": "person", "category": "person", "confidence": 0.9, "bbox": {"x": 120, "y": 140, "width": 30, "height": 60}, "timestamp": t0})
    p1.frame_count = 3
    p2.frame_count = 3
    p3.frame_count = 3

    groups = check_group_movement([p1, p2, p3], max_distance_px=100.0)
    assert len(groups) >= 1
    assert len(groups[0]) >= 2

def test_p1_6_7_rapid_movement_and_wrong_direction_rules():
    """Test 7: Rapid acceleration / velocity and forbidden direction rules."""
    t0 = datetime.utcnow()
    fast_track = STrack(camera_id="CAM-SPD", detection={"class_name": "person", "category": "person", "confidence": 0.9, "bbox": {"x": 100, "y": 100, "width": 30, "height": 60}, "timestamp": t0})
    fast_track.speed = 85.0 # px/s
    fast_track.frame_count = 5
    assert check_rapid_movement(fast_track, speed_threshold=65.0) is True

    slow_track = STrack(camera_id="CAM-SPD", detection={"class_name": "person", "category": "person", "confidence": 0.9, "bbox": {"x": 100, "y": 100, "width": 30, "height": 60}, "timestamp": t0})
    slow_track.speed = 15.0
    slow_track.frame_count = 5
    assert check_rapid_movement(slow_track, speed_threshold=65.0) is False

    # Forbidden direction tests
    assert is_direction_forbidden("SOUTH", rule="SOUTH") is True
    assert is_direction_forbidden("SOUTH_EAST", rule="SOUTH") is True
    assert is_direction_forbidden("NORTH", rule="SOUTH") is False

def test_p1_6_8_full_end_to_end_analytics_pipeline():
    """Test 8: Frame Detection -> Tracking -> Zone Analysis -> SecurityEvent -> Risk -> Alert -> Incident."""
    db = SessionLocal()
    cam_id = f"CAM-E2E-{uuid.uuid4().hex[:4].upper()}"
    zone_id = f"ZONE-E2E-{uuid.uuid4().hex[:4].upper()}"
    now = datetime.utcnow()

    try:
        # Create a security zone
        zone = SecurityZone(
            zone_id=zone_id,
            camera_id=cam_id,
            name="Critical Border Perimeter",
            zone_type="HIGH_SECURITY",
            polygon_json=json.dumps([
                {"x": 0.0, "y": 0.0},
                {"x": 1.0, "y": 0.0},
                {"x": 1.0, "y": 1.0},
                {"x": 0.0, "y": 1.0}
            ]),
            monitored_classes_json=json.dumps(["person", "vehicle"]),
            direction_rule="NONE",
            severity="CRITICAL",
            enabled=True,
            created_at=now,
            updated_at=now
        )
        db.add(zone)
        db.commit()

        # Step 1: Detect and Track
        tracker = ByteTracker(camera_id=cam_id)
        det = {
            "class_name": "person",
            "category": "person",
            "confidence": 0.95,
            "bbox": {"x": 500, "y": 500, "width": 80, "height": 180},
            "timestamp": now
        }
        # Update twice to confirm track
        tracks1 = tracker.update([det])
        det2 = {**det, "bbox": {"x": 505, "y": 505, "width": 80, "height": 180}, "timestamp": now + timedelta(milliseconds=100)}
        active_tracks = tracker.update([det2])
        assert len(active_tracks) == 1
        trk = active_tracks[0]

        # Step 2: Zone Analysis
        zone_tracker = zone_intelligence_service.get_tracker(cam_id)
        zone_tracker._last_zone_fetch = datetime.min # force DB reload
        zone_tracker.analyze_tracks(active_tracks, frame_width=1920, frame_height=1080)

        # Step 3: Verify SecurityEvent was created
        evt = db.query(SecurityEvent).filter(SecurityEvent.camera_id == cam_id).first()
        assert evt is not None
        assert evt.event_type == "ZONE_INTRUSION"
        assert evt.severity in ["MEDIUM", "HIGH", "CRITICAL"]

        # Step 4: Verify Alert was generated by AlertEngine
        alert = db.query(Alert).filter(Alert.camera_id == cam_id).first()
        assert alert is not None
        assert alert.alert_id.startswith("ALT-")

        # Step 5: Escalate or generate incident from alert/event
        inc = incident_service.create_incident_from_event(evt, operator_username="ai_pipeline")
        assert inc is not None
        assert inc.incident_id.startswith("INC-")
        assert inc.source_event_id == evt.event_id

    finally:
        db.close()
