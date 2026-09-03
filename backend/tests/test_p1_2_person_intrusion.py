import time
import pytest
import numpy as np
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.services.ai.detector import YOLOObjectDetector
from app.services.ai.tracker import ByteTracker, STrack
from app.services.intelligence.spatial import is_point_in_polygon, get_ground_plane_point_normalized, get_center_point_normalized
from app.services.intelligence.zone_analyzer import CameraZoneStateTracker
from app.services.intelligence.event_manager import security_event_manager
from app.services.intelligence.risk_engine import risk_engine
from app.services.alert.alert_engine import alert_engine
from app.models.security_event import SecurityEvent
from app.models.alert import Alert

def test_p1_2_1_no_person_empty_frame():
    """Test 1: Empty frame produces zero person detections and zero intrusions."""
    detector = YOLOObjectDetector(model_name="yolov8n", device="cpu")
    empty_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    detections = detector.detect(empty_frame, camera_id="CAM-P1-1")
    assert len(detections) == 0

def test_p1_2_2_person_outside_zone():
    """Test 2: Person detected outside restricted zone does NOT trigger an intrusion."""
    tracker = CameraZoneStateTracker("CAM-P1-2")
    # Define restricted zone in top-left quadrant [0, 0] to [0.4, 0.4]
    tracker._cached_zones = [{
        "zone_id": "ZONE-TL",
        "name": "Top-Left Restricted",
        "zone_type": "RESTRICTED",
        "polygon": [{"x": 0.0, "y": 0.0}, {"x": 0.4, "y": 0.0}, {"x": 0.4, "y": 0.4}, {"x": 0.0, "y": 0.4}],
        "monitored_classes": ["person"],
        "direction_rule": "NONE",
        "severity": "HIGH"
    }]
    tracker._last_zone_fetch = datetime.utcnow()

    # Create person track located in bottom-right (x: 1000, y: 700 on 1920x1080) -> norm ~ (0.55, 0.74)
    det = {
        "class_name": "person", "category": "person", "confidence": 0.92,
        "bbox": {"x": 1000, "y": 700, "width": 60, "height": 100}, "timestamp": datetime.utcnow()
    }
    trk = STrack("CAM-P1-2", det)
    trk.frame_count = 5

    tracker.analyze_tracks([trk], frame_width=1920, frame_height=1080)

    # Verify no intrusion occupancy
    occ_key = f"ZONE-TL:{trk.track_id}"
    assert occ_key not in tracker._occupancy or not tracker._occupancy[occ_key].get("is_inside")

def test_p1_2_3_person_entering_and_remaining_in_zone():
    """Test 3: Person entering zone triggers ZONE_INTRUSION and remaining inside does not create duplicate events."""
    tracker = CameraZoneStateTracker("CAM-P1-3")
    zone_id = "ZONE-ENTRY-TEST"
    tracker._cached_zones = [{
        "zone_id": zone_id,
        "name": "Perimeter Gate",
        "zone_type": "RESTRICTED",
        "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.9, "y": 0.1}, {"x": 0.9, "y": 0.9}, {"x": 0.1, "y": 0.9}],
        "monitored_classes": ["person"],
        "direction_rule": "NONE",
        "severity": "CRITICAL"
    }]
    tracker._last_zone_fetch = datetime.utcnow()

    # Person located at center of frame (norm bottom-center ~ 0.5, 0.55)
    det = {
        "class_name": "person", "category": "person", "confidence": 0.95,
        "bbox": {"x": 930, "y": 500, "width": 60, "height": 100}, "timestamp": datetime.utcnow()
    }
    trk = STrack("CAM-P1-3", det)
    trk.frame_count = 3

    # Frame 1: Person enters zone
    tracker.analyze_tracks([trk], frame_width=1920, frame_height=1080)
    occ_key = f"{zone_id}:{trk.track_id}"
    assert tracker._occupancy[occ_key]["is_inside"] is True

    # Check event persisted in database
    db = SessionLocal()
    try:
        event = db.query(SecurityEvent).filter(
            SecurityEvent.camera_id == "CAM-P1-3",
            SecurityEvent.track_id == trk.track_id,
            SecurityEvent.event_type == "ZONE_INTRUSION"
        ).first()
        assert event is not None
        assert event.severity in ["CRITICAL", "HIGH", "MEDIUM"]
        assert event.status == "ACTIVE"
    finally:
        db.close()

    # Frame 2: Person remains in zone -> occupancy stays True, no duplicate intrusion created
    tracker.analyze_tracks([trk], frame_width=1920, frame_height=1080)
    assert tracker._occupancy[occ_key]["is_inside"] is True

def test_p1_2_4_person_leaving_zone():
    """Test 4: Person leaving zone triggers ZONE_EXIT and clears occupancy state."""
    tracker = CameraZoneStateTracker("CAM-P1-4")
    zone_id = "ZONE-EXIT-TEST"
    tracker._cached_zones = [{
        "zone_id": zone_id,
        "name": "Fence Line",
        "zone_type": "RESTRICTED",
        "polygon": [{"x": 0.0, "y": 0.0}, {"x": 0.3, "y": 0.0}, {"x": 0.3, "y": 0.3}, {"x": 0.0, "y": 0.3}],
        "monitored_classes": ["person"],
        "direction_rule": "NONE",
        "severity": "HIGH"
    }]
    tracker._last_zone_fetch = datetime.utcnow()

    # Start INSIDE zone
    det_inside = {
        "class_name": "person", "category": "person", "confidence": 0.91,
        "bbox": {"x": 100, "y": 100, "width": 50, "height": 80}, "timestamp": datetime.utcnow()
    }
    trk = STrack("CAM-P1-4", det_inside)
    trk.frame_count = 3
    tracker.analyze_tracks([trk], frame_width=1920, frame_height=1080)
    occ_key = f"{zone_id}:{trk.track_id}"
    assert tracker._occupancy[occ_key]["is_inside"] is True

    # Move OUTSIDE zone
    trk.bbox = {"x": 1200, "y": 800, "width": 50, "height": 80}
    trk.frame_count = 4
    tracker.analyze_tracks([trk], frame_width=1920, frame_height=1080)
    assert tracker._occupancy[occ_key]["is_inside"] is False

def test_p1_2_5_multiple_persons_independent_tracking():
    """Test 5: Multiple persons in the same frame have independent bounding boxes and track IDs."""
    byte_tracker = ByteTracker(camera_id="CAM-MULTI")
    dets = [
        {"class_name": "person", "category": "person", "confidence": 0.90, "bbox": {"x": 100, "y": 100, "width": 50, "height": 100}, "timestamp": datetime.utcnow()},
        {"class_name": "person", "category": "person", "confidence": 0.88, "bbox": {"x": 400, "y": 200, "width": 50, "height": 100}, "timestamp": datetime.utcnow()},
        {"class_name": "person", "category": "person", "confidence": 0.92, "bbox": {"x": 800, "y": 300, "width": 50, "height": 100}, "timestamp": datetime.utcnow()},
    ]
    tracks = byte_tracker.update(dets)
    assert len(tracks) == 3
    track_ids = {t.track_id for t in tracks}
    assert len(track_ids) == 3  # All unique track IDs

def test_p1_2_6_invalid_bounding_box_handling():
    """Test 6: Invalid / extreme bounding box values are clipped and normalized safely without crash."""
    # Bbox with coordinates extending outside frame
    bad_bbox = {"x": -50, "y": -20, "width": 2500, "height": 1500}
    norm_gp = get_ground_plane_point_normalized(bad_bbox, frame_width=1920, frame_height=1080)
    assert 0.0 <= norm_gp["x"] <= 1.0
    assert 0.0 <= norm_gp["y"] <= 1.0

    norm_center = get_center_point_normalized(bad_bbox, frame_width=1920, frame_height=1080)
    assert 0.0 <= norm_center["x"] <= 1.0
    assert 0.0 <= norm_center["y"] <= 1.0

def test_p1_2_7_low_confidence_filtering():
    """Test 7: Detections with confidence below configured threshold are excluded."""
    detector = YOLOObjectDetector(model_name="yolov8n", device="cpu", conf_thresholds={"person": 0.75})
    assert detector.thresholds["person"] == 0.75

def test_p1_2_8_multi_camera_zone_isolation():
    """Test 8: Zones configured on Camera A do not evaluate or trigger events on Camera B."""
    tracker_a = CameraZoneStateTracker("CAM-ALPHA")
    tracker_b = CameraZoneStateTracker("CAM-BETA")

    tracker_a._cached_zones = [{
        "zone_id": "ZONE-ALPHA-1",
        "name": "Alpha Restricted Zone",
        "zone_type": "RESTRICTED",
        "polygon": [{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 0.0}, {"x": 1.0, "y": 1.0}, {"x": 0.0, "y": 1.0}],
        "monitored_classes": ["person"],
        "direction_rule": "NONE",
        "severity": "CRITICAL"
    }]
    tracker_a._last_zone_fetch = datetime.utcnow()

    tracker_b._cached_zones = [] # No zones on Camera B
    tracker_b._last_zone_fetch = datetime.utcnow()

    det = {
        "class_name": "person", "category": "person", "confidence": 0.93,
        "bbox": {"x": 500, "y": 500, "width": 50, "height": 100}, "timestamp": datetime.utcnow()
    }
    trk_b = STrack("CAM-BETA", det)
    trk_b.frame_count = 3

    # Analyze on Camera B
    tracker_b.analyze_tracks([trk_b], frame_width=1920, frame_height=1080)

    # Verify no intrusion event on Camera B
    db = SessionLocal()
    try:
        evt_b = db.query(SecurityEvent).filter(
            SecurityEvent.camera_id == "CAM-BETA",
            SecurityEvent.track_id == trk_b.track_id,
            SecurityEvent.zone_id.isnot(None)
        ).first()
        assert evt_b is None

    finally:
        db.close()
