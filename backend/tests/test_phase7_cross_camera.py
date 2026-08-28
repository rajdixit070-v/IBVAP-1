import pytest
import uuid
import json
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.camera_transition import CameraTransition
from app.models.global_track import GlobalTrack
from app.models.track_observation import TrackObservation
from app.models.track_association import TrackAssociation
from app.models.movement_anomaly import MovementAnomaly
from app.models.audit_log import SecurityAuditLog
from app.services.cross_camera.correlation_engine import correlation_engine
from app.services.cross_camera.camera_graph import camera_graph_service

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    yield db
    db.close()

def test_camera_graph_transitions_crud(db_session):
    """Test camera topology transition graph creation, query, and updates."""
    res = client.get("/api/v1/cross-camera/graph")
    assert res.status_code == 200
    transitions = res.json()
    assert len(transitions) >= 1

    # Add new transition edge
    from_c = f"CAM-TEST-{uuid.uuid4().hex[:4].upper()}"
    to_c = f"CAM-TEST-{uuid.uuid4().hex[:4].upper()}"
    payload = {
        "from_camera_id": from_c,
        "to_camera_id": to_c,
        "min_travel_time_sec": 25.0,
        "expected_travel_time_sec": 70.0,
        "max_travel_time_sec": 400.0,
        "direction": "EAST",
        "transition_confidence": 0.90,
        "is_enabled": True
    }
    create_res = client.post("/api/v1/cross-camera/graph/transitions", json=payload)
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["from_camera_id"] == from_c

    # Update
    update_res = client.put(f"/api/v1/cross-camera/graph/transitions/{data['id']}", json={"min_travel_time_sec": 30.0})
    assert update_res.status_code == 200
    assert update_res.json()["min_travel_time_sec"] == 30.0

def test_person_cross_camera_association_and_global_track(db_session):
    """Test person detection moving between connected cameras creating a continuous Global Track."""
    t0 = datetime.utcnow()
    p_id1 = int(uuid.uuid4().int % 100000 + 1000)
    p_id2 = int(uuid.uuid4().int % 100000 + 2000)
    unique_color = f"jacket_blue_{uuid.uuid4().hex[:4]}"

    # 1. First sighting on CAM-001
    gt1, obs1, asc1 = correlation_engine.ingest_observation(
        camera_id="CAM-001",
        local_track_id=p_id1,
        object_type="person",
        timestamp=t0,
        direction="EAST",
        appearance_features={"upper_color": unique_color, "category": "jacket"},
        confidence=0.90
    )
    assert gt1 is not None
    assert gt1.status == "ACTIVE"

    # 2. Second sighting on CAM-002 45 seconds later (expected time)
    t1 = t0 + timedelta(seconds=45)
    gt2, obs2, asc2 = correlation_engine.ingest_observation(
        camera_id="CAM-002",
        local_track_id=p_id2,
        object_type="person",
        timestamp=t1,
        direction="EAST",
        appearance_features={"upper_color": unique_color, "category": "jacket"},
        confidence=0.88
    )

    assert gt2.global_track_id == gt1.global_track_id
    assert gt2.total_observations >= 2
    assert asc2 is not None
    assert asc2.from_camera_id == "CAM-001"
    assert asc2.to_camera_id == "CAM-002"

def test_vehicle_journey_with_anpr_consensus(db_session):
    """Test multi-camera vehicle journey tracking using ANPR plate consensus."""
    plate = f"MH02Z{uuid.uuid4().hex[:4].upper()}"
    t0 = datetime.utcnow()
    v1 = int(uuid.uuid4().int % 100000 + 100)
    v2 = int(uuid.uuid4().int % 100000 + 200)
    v3 = int(uuid.uuid4().int % 100000 + 300)

    # CAM-001
    gt1, _, _ = correlation_engine.ingest_observation(
        camera_id="CAM-001",
        local_track_id=v1,
        object_type="vehicle",
        timestamp=t0,
        direction="EAST",
        plate_number=plate,
        plate_confidence=0.95
    )

    # CAM-002
    gt2, _, asc2 = correlation_engine.ingest_observation(
        camera_id="CAM-002",
        local_track_id=v2,
        object_type="vehicle",
        timestamp=t0 + timedelta(seconds=40),
        direction="EAST",
        plate_number=plate,
        plate_confidence=0.96
    )

    # CAM-003
    gt3, _, asc3 = correlation_engine.ingest_observation(
        camera_id="CAM-003",
        local_track_id=v3,
        object_type="vehicle",
        timestamp=t0 + timedelta(seconds=100),
        direction="SOUTH-EAST",
        plate_number=plate,
        plate_confidence=0.94
    )

    assert gt3.primary_identifier == plate
    assert gt3.global_track_id == gt1.global_track_id
    assert gt3.total_observations >= 3
    assert asc3.match_category == "HIGH_CONFIDENCE_MATCH"

def test_impossible_travel_anomaly_detection(db_session):
    """Test flagging IMPOSSIBLE_TRANSITION when travel time is shorter than physical minimum."""
    t0 = datetime.utcnow()
    plate = f"DL01IMP{uuid.uuid4().hex[:3].upper()}"
    v1 = int(uuid.uuid4().int % 100000 + 500)
    v2 = int(uuid.uuid4().int % 100000 + 600)

    # CAM-001 (min travel time to CAM-002 is 15s)
    gt, _, _ = correlation_engine.ingest_observation(
        camera_id="CAM-001",
        local_track_id=v1,
        object_type="vehicle",
        timestamp=t0,
        plate_number=plate
    )

    # Sighting on CAM-002 only 2 seconds later (impossible!)
    correlation_engine.ingest_observation(
        camera_id="CAM-002",
        local_track_id=v2,
        object_type="vehicle",
        timestamp=t0 + timedelta(seconds=2),
        plate_number=plate
    )

    anomaly = db_session.query(MovementAnomaly).filter(
        MovementAnomaly.anomaly_type == "IMPOSSIBLE_TRANSITION",
        MovementAnomaly.global_track_id == gt.global_track_id
    ).order_by(MovementAnomaly.created_at.desc()).first()

    assert anomaly is not None
    assert anomaly.severity == "CRITICAL"

def test_route_deviation_anomaly_detection(db_session):
    """Test flagging ROUTE_DEVIATION when sighting occurs across non-connected camera."""
    t0 = datetime.utcnow()
    p1 = int(uuid.uuid4().int % 100000 + 700)
    p2 = int(uuid.uuid4().int % 100000 + 800)
    unique_dev_color = f"bright_orange_{uuid.uuid4().hex[:4]}"

    # CAM-001 sighting
    gt, _, _ = correlation_engine.ingest_observation(
        camera_id="CAM-001",
        local_track_id=p1,
        object_type="person",
        appearance_features={"upper_color": unique_dev_color},
        timestamp=t0
    )

    # Sighting on CAM-004 (no direct transition edge from CAM-001)
    correlation_engine.ingest_observation(
        camera_id="CAM-004",
        local_track_id=p2,
        object_type="person",
        appearance_features={"upper_color": unique_dev_color},
        timestamp=t0 + timedelta(seconds=30)
    )

    anomaly = db_session.query(MovementAnomaly).filter(
        MovementAnomaly.anomaly_type == "ROUTE_DEVIATION"
    ).order_by(MovementAnomaly.created_at.desc()).first()

    assert anomaly is not None

def test_operator_association_review_workflow(db_session):
    """Test operator confirm / reject association workflow with audit logging."""
    t0 = datetime.utcnow()
    p1 = int(uuid.uuid4().int % 100000 + 900)
    p2 = int(uuid.uuid4().int % 100000 + 950)
    rev_color = f"forest_green_{uuid.uuid4().hex[:4]}"

    _, _, _ = correlation_engine.ingest_observation(
        camera_id="CAM-001",
        local_track_id=p1,
        object_type="person",
        direction="EAST",
        appearance_features={"upper_color": rev_color},
        timestamp=t0
    )
    _, _, asc = correlation_engine.ingest_observation(
        camera_id="CAM-002",
        local_track_id=p2,
        object_type="person",
        direction="EAST",
        appearance_features={"upper_color": rev_color},
        timestamp=t0 + timedelta(seconds=50)
    )
    assert asc is not None

    res = client.post(f"/api/v1/cross-camera/associations/{asc.association_id}/review", json={
        "action": "CONFIRM",
        "notes": "Verified visually by duty officer",
        "operator_username": "commander_1"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "CONFIRMED"
    assert data["reviewed_by"] == "commander_1"

    # Verify audit log
    audit = db_session.query(SecurityAuditLog).filter(
        SecurityAuditLog.resource_id == asc.association_id,
        SecurityAuditLog.action == "ASSOCIATION_CONFIRMED"
    ).first()
    assert audit is not None

def test_global_track_detail_endpoint(db_session):
    """Test full multi-camera journey dossier endpoint."""
    res = client.get("/api/v1/cross-camera/tracks?limit=1")
    assert res.status_code == 200
    tracks = res.json()
    assert len(tracks) >= 1

    gt_id = tracks[0]["global_track_id"]
    detail_res = client.get(f"/api/v1/cross-camera/tracks/{gt_id}")
    assert detail_res.status_code == 200
    data = detail_res.json()
    assert "observations" in data
    assert "associations" in data
    assert "anomalies" in data

def test_cross_camera_analytics_summary(db_session):
    """Test analytics summary endpoint for cross-camera correlation metrics."""
    res = client.get("/api/v1/cross-camera/analytics/summary")
    assert res.status_code == 200
    data = res.json()
    assert "total_global_tracks" in data
    assert "vehicle_journeys" in data
    assert "movement_anomalies" in data
    assert "active_transitions_count" in data
