import pytest
import numpy as np
import json
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.vehicle_watchlist import VehicleWatchlist
from app.models.person_watchlist import PersonWatchlist
from app.models.anpr_event import ANPREvent
from app.models.face_event import FaceEvent
from app.services.anpr.ocr_engine import normalize_plate_number, ocr_engine
from app.services.anpr.consensus import VehicleTrackPlateHistory, MultiFramePlateConsensusManager
from app.services.anpr.plate_detector import estimate_plate_quality, preprocess_plate_image, crop_plate_region
from app.services.face.face_detector import evaluate_face_quality, crop_face_region
from app.services.face.embedding_engine import face_embedding_engine, compute_cosine_similarity
from app.services.intelligence.risk_engine import risk_engine

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield

# 1. Plate Normalization Tests
def test_plate_normalization():
    assert normalize_plate_number("UP 32 AB 1234") == "UP32AB1234"
    assert normalize_plate_number("DL-01-C-8899") == "DL01C8899"
    assert normalize_plate_number("mh  12   de 1432") == "MH12DE1432"
    assert normalize_plate_number("!@#abc-123") == "ABC123"

# 2. Plate Preprocessing & Quality Assessment
def test_plate_preprocessing_and_quality():
    # Synthetic clean plate image
    clean_plate = np.ones((60, 180, 3), dtype=np.uint8) * 200
    # Add high contrast edges
    clean_plate[20:40, 30:150] = 20
    
    preprocessed = preprocess_plate_image(clean_plate)
    assert preprocessed is not None
    assert preprocessed.shape[0] == 80

    quality, is_acceptable = estimate_plate_quality(clean_plate)
    assert quality > 0.30
    assert is_acceptable is True

    # Blurry / tiny image rejection
    tiny_plate = np.zeros((10, 20, 3), dtype=np.uint8)
    q_tiny, ok_tiny = estimate_plate_quality(tiny_plate)
    assert ok_tiny is False

# 3. Multi-Frame Plate Consensus Voting
def test_multi_frame_plate_consensus():
    history = VehicleTrackPlateHistory(track_id=42, camera_id="CAM-001")
    
    # Frame 1: Slightly noisy OCR
    p1, c1, cnt1 = history.add_reading("UP 32 AB 12?4", "UP32AB124", 0.70)
    assert cnt1 == 1

    # Frame 2: Clear OCR
    p2, c2, cnt2 = history.add_reading("UP 32 AB 1234", "UP32AB1234", 0.92)
    assert cnt2 == 2

    # Frame 3: Clear OCR consensus confirmation
    p3, c3, cnt3 = history.add_reading("UP 32 AB 1234", "UP32AB1234", 0.95)
    assert cnt3 == 3
    assert p3 == "UP32AB1234"
    assert c3 >= 0.90

# 4. Face Quality Assessment
def test_face_quality_assessment():
    # Good face with contrast features
    good_face = np.ones((80, 80, 3), dtype=np.uint8) * 150
    good_face[20:30, 20:35] = 40
    good_face[20:30, 45:60] = 40
    good_face[50:60, 30:50] = 50

    q_score, is_ok = evaluate_face_quality(good_face)
    assert q_score > 0.40
    assert is_ok is True

    # Tiny / blurry face
    blurred_face = np.ones((25, 25, 3), dtype=np.uint8) * 120
    q_bad, is_bad_ok = evaluate_face_quality(blurred_face)
    assert is_bad_ok is False

# 5. Face Embedding & Cosine Similarity
def test_face_embedding_and_cosine_similarity():
    img1 = np.ones((100, 100, 3), dtype=np.uint8) * 180
    img1[30:50, 30:70] = 20
    emb1 = face_embedding_engine.extract_embedding(img1)
    assert len(emb1) == 128

    # Identical image similarity should be 1.0
    sim_self = compute_cosine_similarity(emb1, emb1)
    assert sim_self >= 0.99

    # Orthogonal dummy vectors
    vec_a = [1.0] + [0.0] * 127
    vec_b = [0.0, 1.0] + [0.0] * 126
    assert compute_cosine_similarity(vec_a, vec_b) == 0.0

# 6. Risk Engine Integration for ANPR and Face Watchlists
def test_risk_engine_watchlist_escalation():
    # Standard restricted zone entry
    score_base, level_base, _ = risk_engine.calculate_risk(
        event_type="ZONE_INTRUSION",
        zone_type="RESTRICTED"
    )
    assert score_base >= 25

    # Watchlist vehicle entering restricted zone
    score_wl, level_wl, factors = risk_engine.calculate_risk(
        event_type="ZONE_INTRUSION",
        zone_type="RESTRICTED",
        is_anpr_watchlist=True,
        is_night=True
    )
    assert score_wl >= 70
    assert level_wl in ["HIGH", "CRITICAL"]
    factor_names = [f["factor"] for f in factors]
    assert "ANPR_WATCHLIST_MATCH" in factor_names
    assert "NIGHT_MOVEMENT" in factor_names

# 7. Vehicle Watchlist REST API CRUD
def test_vehicle_watchlist_api_crud(auth_headers):
    # 1. Create
    resp = client.post("/api/v1/vehicles/", json={
        "plate_number": "KA 05 MN 9988",
        "vehicle_type": "truck",
        "owner_name": "Test Carrier Co",
        "status": "WATCHLIST",
        "watchlist_category": "SUSPICIOUS_MOVEMENT",
        "notes": "Automated test record."
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["normalized_plate_number"] == "KA05MN9988"
    vid = data["id"]

    # 2. Duplicate Check
    resp_dup = client.post("/api/v1/vehicles/", json={
        "plate_number": "KA-05-MN-9988",
        "vehicle_type": "truck"
    }, headers=auth_headers)
    assert resp_dup.status_code == 400

    # 3. List
    resp_list = client.get("/api/v1/vehicles/?search=KA05MN9988", headers=auth_headers)
    assert resp_list.status_code == 200
    assert len(resp_list.json()) >= 1

    # 4. Update
    resp_up = client.put(f"/api/v1/vehicles/{vid}", json={"status": "AUTHORIZED"}, headers=auth_headers)
    assert resp_up.status_code == 200
    assert resp_up.json()["status"] == "AUTHORIZED"

    # 5. Delete
    resp_del = client.delete(f"/api/v1/vehicles/{vid}", headers=auth_headers)
    assert resp_del.status_code == 200

# 8. Person Watchlist REST API CRUD
def test_person_watchlist_api_crud(auth_headers):
    # 1. Create
    resp = client.post("/api/v1/watchlist/persons/", json={
        "person_id": "PID-TEST-999",
        "display_name": "Test Subject 999",
        "category": "WATCHLIST",
        "status": "ACTIVE",
        "notes": "Testing face identity registry",
        "embedding": [0.0] * 128
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["person_id"] == "PID-TEST-999"
    pid = data["id"]

    # 2. List
    resp_list = client.get("/api/v1/watchlist/persons/?search=PID-TEST-999", headers=auth_headers)
    assert resp_list.status_code == 200
    assert len(resp_list.json()) == 1

    # 3. Delete
    resp_del = client.delete(f"/api/v1/watchlist/persons/{pid}", headers=auth_headers)
    assert resp_del.status_code == 200

# 9. ANPR and Face Events Endpoints
def test_anpr_and_face_events_summary(auth_headers):
    # Summary ANPR
    resp_anpr = client.get("/api/v1/anpr/summary", headers=auth_headers)
    assert resp_anpr.status_code == 200
    data_anpr = resp_anpr.json()
    assert "total_reads" in data_anpr

    # Summary Face
    resp_face = client.get("/api/v1/face/summary", headers=auth_headers)
    assert resp_face.status_code == 200
    data_face = resp_face.json()
    assert "total_faces" in data_face
