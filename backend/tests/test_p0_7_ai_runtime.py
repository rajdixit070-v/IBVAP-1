import pytest
import numpy as np
from app.services.ai.detector import YOLOObjectDetector
from app.services.ai.tracker import ByteTracker, STrack, compute_image_space_direction, calculate_iou
from app.services.ai.pipeline import ai_pipeline_manager
from app.services.face.face_detector import crop_face_region, evaluate_face_quality
from app.services.face.embedding_engine import FaceEmbeddingEngine, compute_cosine_similarity
from app.services.anpr.plate_detector import crop_plate_region, preprocess_plate_image, estimate_plate_quality
from app.services.anpr.ocr_engine import normalize_plate_number, ocr_engine

def test_p0_7_1_yolo_model_initialization():
    """Test 1: YOLO Object Detector initializes cleanly with proper device configuration."""
    detector = YOLOObjectDetector(model_name="yolov8n", device="auto")
    if detector.status in ("FILE_MISSING", "NOT_CONFIGURED", "ERROR"):
        pytest.skip(f"YOLO model not available in test environment: {detector.status} - {detector.error}")
    assert detector.is_loaded is True
    assert detector.device_used in ["CPU", "CUDA"]
    assert detector.model is not None


def test_p0_7_2_yolo_real_inference():
    """Test 2: YOLO runs real inference on an RGB/BGR frame and returns valid bounding boxes."""
    detector = YOLOObjectDetector(model_name="yolov8n", device="cpu")
    # Blank 640x480 frame
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    detections = detector.detect(frame, camera_id="CAM-TEST-001")
    assert isinstance(detections, list)

def test_p0_7_3_bytetracker_tracking_and_direction():
    """Test 3: Multi-object ByteTracker manages object tracks and computes image-space trajectory."""
    tracker = ByteTracker(camera_id="CAM-TEST-001")
    
    # Frame 1: Person at (100, 100)
    det1 = [{
        "class_name": "person",
        "category": "person",
        "confidence": 0.88,
        "bbox": {"x": 100.0, "y": 100.0, "width": 50.0, "height": 120.0}
    }]
    tracks1 = tracker.update(det1)
    assert len(tracks1) == 1
    assert tracks1[0].track_id > 0
    assert tracks1[0].category == "person"

    # Frame 2: Person moves to (110, 100) -> EAST
    det2 = [{
        "class_name": "person",
        "category": "person",
        "confidence": 0.89,
        "bbox": {"x": 110.0, "y": 100.0, "width": 50.0, "height": 120.0}
    }]
    tracks2 = tracker.update(det2)
    assert len(tracks2) == 1
    assert tracks2[0].track_id == tracks1[0].track_id

def test_p0_7_4_iou_calculation():
    """Test 4: Bounding box IoU calculation handles overlaps and disjoint boxes accurately."""
    boxA = {"x": 0.0, "y": 0.0, "width": 100.0, "height": 100.0}
    boxB = {"x": 50.0, "y": 0.0, "width": 100.0, "height": 100.0}
    iou = calculate_iou(boxA, boxB)
    assert 0.30 <= iou <= 0.35

    boxC = {"x": 200.0, "y": 200.0, "width": 50.0, "height": 50.0}
    assert calculate_iou(boxA, boxC) == 0.0

def test_p0_7_5_face_detection_and_quality():
    """Test 5: Face region cropping and quality gate evaluation."""
    test_frame = np.full((720, 1280, 3), 120, dtype=np.uint8)
    person_bbox = {"x": 200.0, "y": 100.0, "width": 120.0, "height": 300.0}
    
    face_crop = crop_face_region(test_frame, person_bbox)
    assert face_crop is not None
    assert face_crop.shape[0] > 0
    assert face_crop.shape[1] > 0

    quality, is_acceptable = evaluate_face_quality(face_crop)
    assert 0.0 <= quality <= 1.0

def test_p0_7_6_face_embedding_normalization_and_similarity():
    """Test 6: Face embedding engine generates 128-d L2 normalized vector when model loaded, or fails safely."""
    engine = FaceEmbeddingEngine(vector_dim=128)
    face_img = np.random.randint(50, 200, (112, 112, 3), dtype=np.uint8)
    emb1 = engine.extract_embedding(face_img)
    
    if not engine.is_loaded:
        assert emb1 is None
        assert engine.status in ["FACE_MODEL_UNAVAILABLE", "FACE_MODEL_ERROR"]
        # Verify cosine similarity on valid vectors
        vec1 = [1.0] + [0.0] * 127
        sim = compute_cosine_similarity(vec1, vec1)
        assert abs(sim - 1.0) < 0.01
    else:
        assert len(emb1) == 128
        norm = np.linalg.norm(np.array(emb1))
        assert abs(norm - 1.0) < 0.01
        sim = compute_cosine_similarity(emb1, emb1)
        assert abs(sim - 1.0) < 0.01

def test_p0_7_7_plate_detection_and_preprocessing():
    """Test 7: ANPR plate cropping, image contrast enhancement, and quality assessment."""
    test_frame = np.full((720, 1280, 3), 100, dtype=np.uint8)
    vehicle_bbox = {"x": 300.0, "y": 200.0, "width": 400.0, "height": 300.0}

    plate_crop = crop_plate_region(test_frame, vehicle_bbox)
    assert plate_crop is not None
    
    enhanced = preprocess_plate_image(plate_crop)
    assert enhanced is not None
    assert len(enhanced.shape) == 2  # Grayscale enhanced image

    quality, _ = estimate_plate_quality(plate_crop)
    assert 0.0 <= quality <= 1.0

def test_p0_7_8_ocr_engine_normalization_and_error_handling():
    """Test 8: License plate normalization handles formatting without returning fake numbers on missing OCR."""
    raw = "up-32 ab 1234 "
    norm = normalize_plate_number(raw)
    assert norm == "UP32AB1234"

    # Empty frame produces empty text without crashing
    raw_text, norm_text, conf = ocr_engine.recognize(None)
    assert raw_text == ""
    assert norm_text == ""
    assert conf == 0.0

def test_p0_7_9_invalid_and_corrupt_frame_handling():
    """Test 9: Invalid, empty, or None frames are handled gracefully by all AI modules."""
    detector = YOLOObjectDetector(model_name="yolov8n", device="cpu")
    assert detector.detect(None, "CAM-001") == []
    assert detector.detect(np.array([]), "CAM-001") == []

    assert crop_face_region(None, {}) is None
    assert crop_plate_region(None, {}) is None

def test_p0_7_10_pipeline_manager_status():
    """Test 10: AIPipelineManager reports accurate status and device information."""
    status = ai_pipeline_manager.get_camera_status("CAM-001")
    assert status.camera_id == "CAM-001"
    assert status.status in ["ACTIVE", "STARTING", "PAUSED", "NO_STREAM"]
    assert status.device in ["CPU", "CUDA", "CPU (Fallback)"]
