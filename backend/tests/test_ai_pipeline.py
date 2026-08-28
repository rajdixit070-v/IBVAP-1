import pytest
import numpy as np
from datetime import datetime
from app.services.ai.detector import YOLOObjectDetector, CATEGORY_MAPPINGS
from app.services.ai.tracker import ByteTracker, STrack, compute_image_space_direction, calculate_iou
from app.services.ai.pipeline import CameraAIWorker, AIPipelineManager

def test_category_mappings():
    assert CATEGORY_MAPPINGS["person"] == "person"
    assert CATEGORY_MAPPINGS["car"] == "vehicle"
    assert CATEGORY_MAPPINGS["truck"] == "vehicle"
    assert CATEGORY_MAPPINGS["dog"] == "animal"
    assert CATEGORY_MAPPINGS["drone"] == "drone"

def test_iou_calculation():
    box1 = {"x": 100, "y": 100, "width": 50, "height": 50}
    box2 = {"x": 100, "y": 100, "width": 50, "height": 50}
    assert calculate_iou(box1, box2) == 1.0

    box3 = {"x": 200, "y": 200, "width": 50, "height": 50}
    assert calculate_iou(box1, box3) == 0.0

def test_direction_calculation():
    # Downward movement (+y) in image coordinates = SOUTH
    traj_south = [{"x": 100, "y": 100}, {"x": 100, "y": 120}, {"x": 100, "y": 150}]
    assert compute_image_space_direction(traj_south) == "SOUTH"

    # Upward movement (-y) in image coordinates = NORTH
    traj_north = [{"x": 100, "y": 150}, {"x": 100, "y": 120}, {"x": 100, "y": 100}]
    assert compute_image_space_direction(traj_north) == "NORTH"

    # Rightward movement (+x) = EAST
    traj_east = [{"x": 100, "y": 100}, {"x": 130, "y": 100}, {"x": 160, "y": 100}]
    assert compute_image_space_direction(traj_east) == "EAST"

    # Stationary (below min displacement)
    traj_stat = [{"x": 100, "y": 100}, {"x": 101, "y": 101}, {"x": 102, "y": 101}]
    assert compute_image_space_direction(traj_stat) == "STATIONARY"

def test_bytetrack_persistent_id():
    tracker = ByteTracker(camera_id="CAM-TEST-01", track_thresh=0.4)

    # Frame 1: Person at (100, 100)
    det_f1 = [{
        "class_name": "person",
        "category": "person",
        "confidence": 0.92,
        "bbox": {"x": 100.0, "y": 100.0, "width": 50.0, "height": 120.0},
        "timestamp": datetime.utcnow()
    }]
    tracks_f1 = tracker.update(det_f1)
    assert len(tracks_f1) == 1
    t1_id = tracks_f1[0].track_id

    # Frame 2: Same person moved slightly to (105, 102)
    det_f2 = [{
        "class_name": "person",
        "category": "person",
        "confidence": 0.94,
        "bbox": {"x": 105.0, "y": 102.0, "width": 50.0, "height": 120.0},
        "timestamp": datetime.utcnow()
    }]
    tracks_f2 = tracker.update(det_f2)
    assert len(tracks_f2) == 1
    assert tracks_f2[0].track_id == t1_id
    assert tracks_f2[0].frame_count == 2
    assert tracks_f2[0].state == "TRACKING"

def test_multiple_objects_separate_ids():
    tracker = ByteTracker(camera_id="CAM-TEST-02", track_thresh=0.4)

    # Frame 1: Person and Vehicle at distinct locations
    dets = [
        {
            "class_name": "person",
            "category": "person",
            "confidence": 0.90,
            "bbox": {"x": 50.0, "y": 50.0, "width": 40.0, "height": 100.0},
            "timestamp": datetime.utcnow()
        },
        {
            "class_name": "car",
            "category": "vehicle",
            "confidence": 0.88,
            "bbox": {"x": 400.0, "y": 300.0, "width": 120.0, "height": 80.0},
            "timestamp": datetime.utcnow()
        }
    ]
    tracks = tracker.update(dets)
    assert len(tracks) == 2
    assert tracks[0].track_id != tracks[1].track_id
    categories = {t.category for t in tracks}
    assert "person" in categories
    assert "vehicle" in categories

def test_track_expiration():
    tracker = ByteTracker(camera_id="CAM-TEST-03", track_thresh=0.4, max_lost_frames=2)

    # Frame 1: Detected
    tracker.update([{
        "class_name": "person",
        "category": "person",
        "confidence": 0.90,
        "bbox": {"x": 50.0, "y": 50.0, "width": 40.0, "height": 100.0},
        "timestamp": datetime.utcnow()
    }])

    # Frame 2 & 3: Empty frames (object disappeared)
    tracker.update([])
    tracker.update([])
    tracker.update([]) # Exceeds max_lost_frames=2

    assert len(tracker.tracked_stracks) == 0
    assert len(tracker.lost_stracks) == 0

def test_multi_camera_isolation():
    tracker_cam1 = ByteTracker(camera_id="CAM-001")
    tracker_cam2 = ByteTracker(camera_id="CAM-002")

    det = [{
        "class_name": "person",
        "category": "person",
        "confidence": 0.90,
        "bbox": {"x": 100.0, "y": 100.0, "width": 50.0, "height": 100.0},
        "timestamp": datetime.utcnow()
    }]

    t1 = tracker_cam1.update(det)
    t2 = tracker_cam2.update(det)

    assert t1[0].camera_id == "CAM-001"
    assert t2[0].camera_id == "CAM-002"

def test_detector_inference():
    detector = YOLOObjectDetector(model_name="yolov8n", device="cpu")
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    dets = detector.detect(dummy_frame, camera_id="CAM-TEST-04")
    assert isinstance(dets, list)

def test_ai_api_endpoints(client, admin_token_headers):
    # Status endpoint
    res = client.get("/api/v1/ai/status", headers=admin_token_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # Metrics endpoint
    res_m = client.get("/api/v1/ai/metrics", headers=admin_token_headers)
    assert res_m.status_code == 200
    data = res_m.json()
    assert "model" in data
    assert "device" in data

    # Config endpoint
    res_c = client.get("/api/v1/ai/cameras/CAM-001/config", headers=admin_token_headers)
    assert res_c.status_code == 200
    cfg = res_c.json()
    assert cfg["camera_id"] == "CAM-001"
    assert "conf_person" in cfg

    # Update config endpoint
    res_u = client.put(
        "/api/v1/ai/cameras/CAM-001/config",
        json={"conf_person": 0.55, "target_fps": 12.0},
        headers=admin_token_headers
    )
    assert res_u.status_code == 200
    assert res_u.json()["conf_person"] == 0.55
    assert res_u.json()["target_fps"] == 12.0
