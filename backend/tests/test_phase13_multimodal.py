import json
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta

from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.camera import Camera
from app.models.multimodal_models import (
    AIObservation,
    MultimodalSecurityEvent,
    AIModelRegistry,
    AIOperatorFeedback,
    CameraAIProfile
)
from app.models.federation_models import Site, BOP, SiteUserScope
from app.services.federation.scope_service import ScopeService
from app.services.multimodal.multimodal_engine import MultimodalEngine

client = TestClient(app)

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture(autouse=True)
def setup_phase13_data(db):
    """Sets up default Phase 13 test environment."""
    # Ensure default site and BOP exist
    site = db.query(Site).filter(Site.site_id == "SITE-BORDER-NORTH").first()
    if not site:
        site = Site(
            site_id="SITE-BORDER-NORTH",
            region_id="REG-NORTH",
            name="Northern Border Tactical Command",
            code="S-NORTH",
            status="ACTIVE"
        )
        db.add(site)

    bop = db.query(BOP).filter(BOP.bop_id == "BOP-ALPHA").first()
    if not bop:
        bop = BOP(
            bop_id="BOP-ALPHA",
            site_id="SITE-BORDER-NORTH",
            name="BOP Alpha",
            code="BOP-A",
            status="ACTIVE",
            operational_priority="CRITICAL"
        )
        db.add(bop)

    # Ensure Camera CAM-001 exists
    cam = db.query(Camera).filter(Camera.camera_id == "CAM-001").first()
    if not cam:
        cam = Camera(
            camera_id="CAM-001",
            camera_name="Perimeter Zero-Line Thermal Alpha",
            rtsp_url="rtsp://mock-cam-001:554/live",
            site_id="SITE-BORDER-NORTH",
            bop_site="BOP Alpha",
            bop_id="BOP-ALPHA",
            status="ONLINE",
            enabled=True
        )
        db.add(cam)

    db.commit()


def test_multimodal_signal_ingestion_and_fusion(db):
    """Section 106: Test Person + Track + Restricted Zone + Night -> Correlated Security Event."""
    payload = {
        "camera_id": "CAM-001",
        "site_id": "SITE-BORDER-NORTH",
        "bop_id": "BOP-ALPHA",
        "zone_id": "ZONE-RESTRICTED-A",
        "track_id": 101,
        "observation_type": "PERSON",
        "confidence": 0.88,
        "lighting_condition": "NIGHT",
        "image_quality_score": 0.95,
        "model_name": "YOLOv8-Border-Detector",
        "model_version": "v1.0.0"
    }

    res = client.post("/api/v1/multimodal/observations", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["observation_id"].startswith("OBS-")
    assert data["confidence_level"] == "HIGH"

    # Verify a correlated MultimodalSecurityEvent was created
    events_res = client.get("/api/v1/multimodal/events?site_id=SITE-BORDER-NORTH")
    assert events_res.status_code == 200
    events = events_res.json()
    assert len(events) >= 1
    ev = events[0]
    assert ev["event_type"] in ["CORRELATED_ANOMALY", "MULTIMODAL_INTRUSION"]
    assert ev["risk_score"] >= 70
    assert ev["confidence_level"] == "HIGH"


def test_temporal_loitering_and_prolonged_presence(db):
    """Section 107: Test Person remaining in zone beyond threshold -> PROLONGED_PRESENCE."""
    track_id = 202
    camera_id = "CAM-001"

    # Ensure profile has low threshold for quick testing
    prof = db.query(CameraAIProfile).filter(CameraAIProfile.camera_id == camera_id).first()
    if not prof:
        prof = CameraAIProfile(camera_id=camera_id, loitering_threshold_seconds=10)
        db.add(prof)
    else:
        prof.loitering_threshold_seconds = 10
    db.commit()

    # Ingest initial point
    obs1, _ = MultimodalEngine.record_observation({
        "camera_id": camera_id,
        "site_id": "SITE-BORDER-NORTH",
        "bop_id": "BOP-ALPHA",
        "zone_id": "ZONE-SENSITIVE-GATE",
        "track_id": track_id,
        "observation_type": "PERSON",
        "confidence": 0.90,
        "lighting_condition": "DAY",
        "speed": 0.1
    }, db, auto_fuse=False)

    # Ingest point after threshold
    track_key = f"{camera_id}:{track_id}"
    MultimodalEngine._track_history_cache[track_key][0]["timestamp"] = (datetime.utcnow() - timedelta(seconds=25)).isoformat()

    obs2, event = MultimodalEngine.record_observation({
        "camera_id": camera_id,
        "site_id": "SITE-BORDER-NORTH",
        "bop_id": "BOP-ALPHA",
        "zone_id": "ZONE-SENSITIVE-GATE",
        "track_id": track_id,
        "observation_type": "PERSON",
        "confidence": 0.92,
        "lighting_condition": "DAY",
        "speed": 0.05
    }, db, auto_fuse=True)

    assert event is not None
    assert event.event_type == "PROLONGED_PRESENCE"
    assert event.risk_score >= 75
    assert "Prolonged Presence" in event.title


def test_duplicate_suppression_and_cooldown(db):
    """Section 108: Test same detection repeated within cooldown does not cause alert storms."""
    camera_id = "CAM-001"
    zone_id = "ZONE-CORRIDOR-01"
    
    # First detection creates event
    obs1, ev1 = MultimodalEngine.record_observation({
        "camera_id": camera_id,
        "site_id": "SITE-BORDER-NORTH",
        "bop_id": "BOP-ALPHA",
        "zone_id": zone_id,
        "track_id": 303,
        "observation_type": "PERSON",
        "confidence": 0.85,
        "lighting_condition": "DAY"
    }, db, auto_fuse=True)
    assert ev1 is not None

    # Immediate second detection with same track and zone is suppressed
    obs2, ev2 = MultimodalEngine.record_observation({
        "camera_id": camera_id,
        "site_id": "SITE-BORDER-NORTH",
        "bop_id": "BOP-ALPHA",
        "zone_id": zone_id,
        "track_id": 303,
        "observation_type": "PERSON",
        "confidence": 0.86,
        "lighting_condition": "DAY"
    }, db, auto_fuse=True)
    assert ev2 is None # Cooldown active, suppressed!


def test_anpr_temporal_voting_and_consensus(db):
    """Section 110: Test multi-frame plate readings improve confidence and resolve voting."""
    vehicle_track = "VTRK-901"

    # Frame 1 with partial noise
    p1, c1 = MultimodalEngine.temporal_plate_aggregation(vehicle_track, "PB08AX123?", 0.70)
    assert p1 == "PB08AX123?"

    # Frame 2 with clear text
    p2, c2 = MultimodalEngine.temporal_plate_aggregation(vehicle_track, "PB08AX1234", 0.92)
    # Frame 3 with clear text
    p3, c3 = MultimodalEngine.temporal_plate_aggregation(vehicle_track, "PB08AX1234", 0.95)

    assert p3 == "PB08AX1234"
    assert c3 >= 0.85


def test_face_analytics_confidence_and_privacy_redaction(db):
    """Section 111 & 117: Test face recognition confidence thresholds and privacy redactions."""
    # Low confidence -> UNKNOWN_FACE
    res_low = MultimodalEngine.resolve_face_status("SUSPECT_JOHNDOE", 0.55, user_role="SUPER_ADMIN")
    assert res_low["status"] == "UNKNOWN_FACE"
    assert res_low["person_name"] == "UNKNOWN"

    # High confidence for ADMIN -> Unredacted
    res_admin = MultimodalEngine.resolve_face_status("SUSPECT_JOHNDOE", 0.89, user_role="SUPER_ADMIN")
    assert res_admin["status"] == "FACE_MATCHED"
    assert res_admin["person_name"] == "SUSPECT_JOHNDOE"
    assert res_admin["privacy_masked"] is False

    # High confidence for ANALYST -> Redacted
    res_analyst = MultimodalEngine.resolve_face_status("SUSPECT_JOHNDOE", 0.89, user_role="ANALYST")
    assert res_analyst["status"] == "FACE_MATCHED"
    assert res_analyst["person_name"].startswith("REDACTED-")
    assert res_analyst["privacy_masked"] is True


def test_low_light_adaptation_confidence_modulation(db):
    """Section 112: Test degraded image quality in low light modulates confidence."""
    obs_data = {
        "camera_id": "CAM-001",
        "site_id": "SITE-BORDER-NORTH",
        "bop_id": "BOP-ALPHA",
        "zone_id": "ZONE-RIVER-BED",
        "track_id": 404,
        "observation_type": "PERSON",
        "confidence": 0.90,
        "lighting_condition": "LOW_LIGHT",
        "image_quality_score": 0.50 # Degraded blur / occluded
    }

    obs, _ = MultimodalEngine.record_observation(obs_data, db, auto_fuse=False)
    # Confidence must be scaled down by image quality
    assert obs.confidence < 0.90
    assert obs.confidence <= 0.65


def test_multimodal_vehicle_plate_person_fusion(db):
    """Section 114: Test vehicle + plate + zone generates unified correlated event."""
    obs_data = {
        "camera_id": "CAM-001",
        "site_id": "SITE-BORDER-NORTH",
        "bop_id": "BOP-ALPHA",
        "zone_id": "ZONE-GATE-NORTH",
        "track_id": 505,
        "observation_type": "VEHICLE",
        "vehicle_class": "truck",
        "plate_text": "PB02BV9988",
        "plate_ocr_confidence": 0.94,
        "confidence": 0.91,
        "lighting_condition": "NIGHT"
    }

    obs, ev = MultimodalEngine.record_observation(obs_data, db, auto_fuse=True)
    assert ev is not None
    assert ev.event_type == "VEHICLE_PLATE_CORRELATION"
    assert "PB02BV9988" in ev.title
    assert ev.risk_score >= 65


def test_event_relationship_graph_and_timeline(db):
    """Section 41-42: Test explainable timeline and graph endpoints."""
    # Create an event
    obs_data = {
        "camera_id": "CAM-001",
        "site_id": "SITE-BORDER-NORTH",
        "bop_id": "BOP-ALPHA",
        "zone_id": "ZONE-FENCE-02",
        "track_id": 606,
        "observation_type": "PERSON",
        "confidence": 0.88,
        "lighting_condition": "NIGHT"
    }
    _, ev = MultimodalEngine.record_observation(obs_data, db, auto_fuse=True)
    assert ev is not None

    # Test Timeline API
    res_tl = client.get(f"/api/v1/multimodal/events/{ev.event_id}/timeline")
    assert res_tl.status_code == 200
    timeline = res_tl.json()
    assert len(timeline) == 7
    stages = [t["stage"] for t in timeline]
    assert stages == ["DETECTION", "TRACKING", "CONTEXT", "CORRELATION", "RISK", "ALERT", "INCIDENT"]

    # Test Graph API
    res_gr = client.get(f"/api/v1/multimodal/events/{ev.event_id}/graph")
    assert res_gr.status_code == 200
    graph = res_gr.json()
    assert len(graph["nodes"]) >= 4
    assert len(graph["edges"]) >= 3


def test_ai_model_registry_and_rollback(db):
    """Section 56-61: Test AI model registration and active version rollback."""
    # Register candidate model
    payload = {
        "model_name": "YOLOv8-Border-Detector",
        "version": "v1.1.0-RC1",
        "model_type": "OBJECT_DETECTION",
        "status": "STANDBY",
        "is_active": False,
        "precision": 0.955,
        "recall": 0.930,
        "latency_ms": 14.8
    }
    res = client.post("/api/v1/multimodal/models", json=payload)
    assert res.status_code == 201
    model_id = res.json()["id"]

    # Rollback/Activate this version
    res_rb = client.post(f"/api/v1/multimodal/models/{model_id}/rollback")
    assert res_rb.status_code == 200
    assert res_rb.json()["active_model_id"] == model_id

    # Verify model is now ACTIVE
    model = db.query(AIModelRegistry).filter(AIModelRegistry.id == model_id).first()
    assert model.is_active is True
    assert model.status == "ACTIVE"


def test_human_in_the_loop_feedback_and_analytics(db):
    """Section 62-63: Test operator feedback submission and analytics aggregation."""
    # Create test event
    ev = MultimodalSecurityEvent(
        event_id=f"MME-TEST-FB-{datetime.utcnow().strftime('%S%f')}",
        event_group_id="GRP-FB",
        title="Test Anomaly for Feedback",
        event_type="CORRELATED_ANOMALY",
        site_id="SITE-BORDER-NORTH",
        bop_id="BOP-ALPHA",
        primary_camera_id="CAM-001",
        confidence=0.75,
        risk_score=70
    )
    db.add(ev)
    db.commit()

    # Submit FALSE_POSITIVE feedback
    fb_res = client.post(f"/api/v1/multimodal/events/{ev.event_id}/feedback", json={
        "label": "FALSE_POSITIVE",
        "reason": "Authorized maintenance patrol in zone"
    })
    assert fb_res.status_code == 200
    assert fb_res.json()["label"] == "FALSE_POSITIVE"

    # Verify Analytics
    an_res = client.get("/api/v1/multimodal/feedback/analytics")
    assert an_res.status_code == 200
    data = an_res.json()
    assert data["total_feedbacks"] >= 1
    assert data["false_positive_count"] >= 1


def test_natural_language_ai_assistant_search(db):
    """Section 82-85: Test Natural Language AI Assistant with factual citations."""
    res = client.post("/api/v1/multimodal/assistant/query", json={
        "query": "Show high risk night time events in Alpha",
        "site_id": "SITE-BORDER-NORTH"
    })
    assert res.status_code == 200
    data = res.json()
    assert "query" in data
    assert "safety_notice" in data
    assert "explanation" in data
    assert isinstance(data["results"], list)


def test_camera_ai_profiles_and_feature_dependency_validation(db):
    """Section 93-96: Test profile update and ANPR vehicle dependency validation."""
    camera_id = "CAM-001"

    # Valid Profile Update to HIGH
    res = client.put(f"/api/v1/multimodal/profiles/{camera_id}", json={
        "profile": "HIGH",
        "loitering_threshold_seconds": 120
    })
    assert res.status_code == 200
    assert res.json()["profile"] == "HIGH"
    assert res.json()["target_fps"] == 20.0

    # Invalid Dependency: ANPR enabled while vehicle_detection is FALSE
    res_err = client.put(f"/api/v1/multimodal/profiles/{camera_id}", json={
        "anpr_enabled": True,
        "vehicle_detection": False
    })
    assert res_err.status_code == 400
    assert "ANPR requires vehicle detection" in res_err.json()["detail"]


def test_flow_analytics_and_heatmaps(db):
    """Section 50-55: Test Flow Analytics and Heatmap endpoints."""
    # Test Flows
    res_flow = client.get("/api/v1/multimodal/analytics/flows?site_id=SITE-BORDER-NORTH&hours=24")
    assert res_flow.status_code == 200
    flow = res_flow.json()
    assert "total_persons_detected" in flow
    assert "vehicles_per_hour" in flow
    assert "vehicle_classes_breakdown" in flow

    # Test Heatmaps
    res_hm = client.get("/api/v1/multimodal/analytics/heatmaps?site_id=SITE-BORDER-NORTH")
    assert res_hm.status_code == 200
    hm = res_hm.json()
    assert len(hm["activity_points"]) >= 1
    assert len(hm["anomaly_points"]) >= 1


def test_site_scope_data_isolation(db):
    """Section 119: Test events from unauthorized sites are isolated and rejected."""
    # Create isolated site if not existing
    isolated_site = db.query(Site).filter(Site.site_id == "SITE-BORDER-SOUTH").first()
    if not isolated_site:
        isolated_site = Site(
            site_id="SITE-BORDER-SOUTH",
            region_id="REG-SOUTH",
            name="Southern Border Command",
            code="S-SOUTH",
            status="ACTIVE"
        )
        db.add(isolated_site)
        db.commit()

    # User scoped ONLY to SITE-BORDER-NORTH
    scoped_user = db.query(User).filter((User.username == "operator_north_only") | (User.email == "north@ibvap.mil")).first()
    if not scoped_user:
        scoped_user = User(
            username="operator_north_only",
            email="north@ibvap.mil",
            hashed_password="mock",
            role="SITE_ADMIN",
            is_active=True
        )
        db.add(scoped_user)
        db.commit()

    user_scope = db.query(SiteUserScope).filter(
        SiteUserScope.username == "operator_north_only",
        SiteUserScope.scope_id == "SITE-BORDER-NORTH"
    ).first()
    if not user_scope:
        user_scope = SiteUserScope(
            username="operator_north_only",
            scope_type="SITE",
            scope_id="SITE-BORDER-NORTH",
            role="SITE_ADMIN"
        )
        db.add(user_scope)
        db.commit()

    # Check that can_access_site returns False for SITE-BORDER-SOUTH
    assert ScopeService.can_access_site(scoped_user, "SITE-BORDER-SOUTH", db) is False
    assert ScopeService.can_access_site(scoped_user, "SITE-BORDER-NORTH", db) is True
