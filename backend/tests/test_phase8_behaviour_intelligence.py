import pytest
import uuid
import json
import time
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.behaviour_event import BehaviourEvent
from app.models.behaviour_rule import BehaviourRule
from app.models.activity_baseline import ActivityBaseline
from app.models.behaviour_feedback import BehaviourFeedback
from app.models.audit_log import SecurityAuditLog
from app.services.behaviour.feature_extractor import feature_extractor
from app.services.behaviour.baseline_engine import baseline_engine
from app.services.behaviour.explainable_risk_engine import explainable_risk_engine
from app.services.behaviour.behaviour_service import behaviour_service

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    yield db
    db.close()

def test_feature_extractor_kinematics_and_sudden_running():
    """Test velocity, acceleration, and sudden sprint detection."""
    # Rapid sprinting trajectory: 0 to 10 meters in 2 seconds
    t0 = time.time()
    trajectory = [
        (0.0, 0.0, t0),
        (2.0, 0.0, t0 + 0.4),
        (5.0, 0.0, t0 + 0.8),
        (9.0, 0.0, t0 + 1.2),
        (14.0, 0.0, t0 + 1.6)
    ]
    kin = feature_extractor.calculate_kinematics(trajectory)
    assert kin["speed"] > 4.0
    assert kin["max_speed"] >= kin["speed"]

def test_rapid_direction_changes_and_stop_go():
    """Test directional reversals and intermittent stop-and-go movements."""
    t0 = time.time()
    # Back-and-forth oscillation: (0 -> 5 -> 0 -> 5 -> 0)
    osc_trajectory = [
        (0.0, 0.0, t0),
        (5.0, 0.0, t0 + 1.0),
        (0.0, 0.0, t0 + 2.0),
        (5.0, 0.0, t0 + 3.0),
        (0.0, 0.0, t0 + 4.0)
    ]
    has_rapid, count = feature_extractor.detect_rapid_direction_changes(osc_trajectory, min_changes=3)
    assert has_rapid is True
    assert count >= 3

    # Stop-and-go: move then pause then move then pause
    stop_go_traj = [
        (0.0, 0.0, t0),
        (1.0, 0.0, t0 + 1.0),
        (1.0, 0.0, t0 + 3.0), # stop 1
        (3.0, 0.0, t0 + 4.0), # move
        (3.0, 0.0, t0 + 6.0), # stop 2
        (5.0, 0.0, t0 + 7.0), # move
        (5.0, 0.0, t0 + 9.0)  # stop 3
    ]
    has_stop_go, stops = feature_extractor.detect_stop_and_go(stop_go_traj, min_stops=3)
    assert has_stop_go is True
    assert stops >= 3

def test_fence_edge_movement_detection():
    """Test detection of movement closely parallel to perimeter fence line."""
    polygon = [
        {"x": 0.0, "y": 0.0},
        {"x": 1.0, "y": 0.0},
        {"x": 1.0, "y": 1.0},
        {"x": 0.0, "y": 1.0}
    ]
    t0 = time.time()
    # Moving along y=0.04 (within 0.12 of top fence line y=0.0)
    fence_traj = [
        (0.1, 0.04, t0),
        (0.3, 0.04, t0 + 1.0),
        (0.5, 0.04, t0 + 2.0),
        (0.7, 0.04, t0 + 3.0),
        (0.9, 0.04, t0 + 4.0)
    ]
    is_fence_edge = feature_extractor.detect_fence_edge_movement(fence_traj, polygon, distance_threshold=0.10)
    assert is_fence_edge is True

def test_activity_baseline_density_anomaly():
    """Test statistical baseline evaluation for crowd density spikes."""
    cam_id = f"CAM-TEST-{uuid.uuid4().hex[:4].upper()}"
    # Normal baseline for night hour 2 is ~1.0 person
    is_anomaly, z_score, msg = baseline_engine.evaluate_density_deviation(
        camera_id=cam_id,
        current_count=18,
        hour_of_day=2,
        object_type="person"
    )
    assert is_anomaly is True
    assert z_score > 2.5
    assert "Normal baseline" in msg

def test_explainable_risk_scoring_and_counter_signals():
    """Test explainable multi-signal risk calculation with positive factors and mitigating counter-signals."""
    # Scenario A: Suspect repeated approach + fence edge at night (High Risk)
    score_a, decayed_a, level_a, factors_a, counters_a, _ = explainable_risk_engine.assess_risk(
        event_type="POTENTIAL_PERIMETER_PROBING_PATTERN",
        zone_type="RESTRICTED",
        is_repeated_approach=True,
        is_fence_edge=True,
        is_night=True,
        is_authorized_watchlist=False,
        is_suspect_watchlist=True
    )
    assert score_a >= 70
    assert level_a in ["HIGH", "CRITICAL"]
    assert len(factors_a) >= 3

    # Scenario B: Authorized patrol performing inspection in daylight (Counter-signals reduce risk)
    score_b, decayed_b, level_b, factors_b, counters_b, _ = explainable_risk_engine.assess_risk(
        event_type="FENCE_EDGE_MOVEMENT",
        zone_type="RESTRICTED",
        is_fence_edge=True,
        is_night=False,
        is_authorized_watchlist=True,
        has_zone_breach=False
    )
    assert score_b < score_a # Mitigation applied
    assert any(c["signal"] == "AUTHORIZED_PERSONNEL_MATCH" for c in counters_b)

def test_risk_score_decay():
    """Test graceful risk score decay as time elapses without new anomalies."""
    score_active, decayed_0, _, _, _, _ = explainable_risk_engine.assess_risk(
        event_type="ZONE_INTRUSION",
        zone_type="RESTRICTED",
        has_zone_breach=True,
        elapsed_sec=0.0
    )
    _, decayed_300, _, _, _, _ = explainable_risk_engine.assess_risk(
        event_type="ZONE_INTRUSION",
        zone_type="RESTRICTED",
        has_zone_breach=True,
        elapsed_sec=300.0 # 5 minutes later
    )
    assert decayed_300 < score_active
    assert decayed_300 > 0

def test_behaviour_events_api_and_pagination(db_session, auth_headers):
    """Test behaviour events listing, search, and pagination endpoints."""
    res = client.get("/api/v1/behaviour/events?limit=10", headers=auth_headers)
    assert res.status_code == 200
    events = res.json()
    assert len(events) >= 1
    assert "factors" in events[0]
    assert "counter_factors" in events[0]

    evt_id = events[0]["event_id"]
    detail_res = client.get(f"/api/v1/behaviour/events/{evt_id}", headers=auth_headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["event_id"] == evt_id

def test_behaviour_rules_crud_and_versioning(db_session, auth_headers):
    """Test rule creation and update with automatic version increment and audit logging."""
    rule_id = f"RULE-TEST-{uuid.uuid4().hex[:4].upper()}"
    create_payload = {
        "rule_id": rule_id,
        "name": "Test Loitering Rule",
        "description": "Test description",
        "event_type": "LOITERING_ANOMALY",
        "is_enabled": True,
        "dwell_threshold_sec": 45.0,
        "base_risk_weight": 20,
        "max_risk_cap": 35,
        "cooldown_sec": 60
    }
    res = client.post("/api/v1/behaviour/rules", json=create_payload, headers=auth_headers)
    assert res.status_code == 201
    created_rule = res.json()
    assert created_rule["rule_version"] == 1

    # Update Rule
    update_res = client.put(f"/api/v1/behaviour/rules/{rule_id}", json={
        "dwell_threshold_sec": 60.0,
        "changed_by": "supervisor_1"
    }, headers=auth_headers)
    assert update_res.status_code == 200
    updated_rule = update_res.json()
    assert updated_rule["rule_version"] == 2
    assert updated_rule["changed_by"] == "admin"

    # Verify audit log
    audit = db_session.query(SecurityAuditLog).filter(
        SecurityAuditLog.resource_id == rule_id,
        SecurityAuditLog.action == "UPDATE_BEHAVIOUR_RULE"
    ).first()
    assert audit is not None

def test_operator_feedback_and_false_positive_metrics(db_session, auth_headers):
    """Test operator feedback submission and analytics summary calculation."""
    # Find or emit an event
    res = client.get("/api/v1/behaviour/events?limit=1", headers=auth_headers)
    events = res.json()
    assert len(events) >= 1
    evt_id = events[0]["event_id"]

    fb_payload = {
        "event_id": evt_id,
        "feedback_type": "FALSE_POSITIVE",
        "notes": "Verified as authorized maintenance activity",
        "operator_username": "commander_alpha"
    }
    fb_res = client.post("/api/v1/behaviour/feedback", json=fb_payload, headers=auth_headers)
    assert fb_res.status_code == 200
    fb_data = fb_res.json()
    assert fb_data["feedback_type"] == "FALSE_POSITIVE"

    # Verify Analytics Summary
    summary_res = client.get("/api/v1/behaviour/analytics/summary", headers=auth_headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert "total_behaviour_events" in summary
    assert "false_positive_rate_percent" in summary
    assert summary["false_positive_rate_percent"] >= 0.0

def test_track_risk_assessment_endpoint(auth_headers):
    """Test real-time explainable assessment endpoint for a live track."""
    res = client.get(
        "/api/v1/behaviour/assessments/TRK-TEST-99?zone_type=RESTRICTED&is_repeated_approach=true&is_night=true",
        headers=auth_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["risk_score"] >= 40
    assert len(data["factors"]) >= 1
    assert "confidence" in data
