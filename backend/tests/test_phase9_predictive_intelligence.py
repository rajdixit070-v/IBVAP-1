import pytest
import uuid
import json
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.camera import Camera
from app.models.edge_node import EdgeNode
from app.models.early_warning import EarlyWarning
from app.models.baseline_shift import BaselineShift
from app.models.activity_baseline import ActivityBaseline
from app.models.model_health import ModelHealth
from app.models.prediction_feedback import PredictionFeedback
from app.models.audit_log import SecurityAuditLog
from app.services.predictive.time_series_engine import time_series_engine
from app.services.predictive.forecasting_engine import forecasting_engine
from app.services.predictive.infrastructure_correlator import infrastructure_correlator
from app.services.predictive.early_warning_service import early_warning_service
from app.services.predictive.predictive_service import predictive_service
from app.services.predictive.hotspot_analyzer import hotspot_analyzer

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    yield db
    db.close()

def test_time_series_aggregation_and_trend_detection():
    """Test time-series point generation and slope-based linear trend detection."""
    points, trend, slope = time_series_engine.aggregate_activity(
        target_type="camera",
        target_id="CAM-001",
        window_minutes=15,
        history_points=12
    )
    assert len(points) == 12
    assert "actual_count" in points[0]
    assert "expected_count" in points[0]
    assert "lower_bound" in points[0]
    assert "upper_bound" in points[0]
    assert trend in ["INCREASING", "STABLE", "DECREASING", "VOLATILE"]

def test_forecasting_with_sufficient_data(db_session):
    """Test short-term forecast generation with uncertainty bands and driver attribution."""
    # Ensure CAM-001 is healthy in DB
    cam = db_session.query(Camera).filter(Camera.camera_id == "CAM-001").first()
    if cam:
        cam.status = "HEALTHY"
        db_session.commit()

    # Sustained rising history: [10, 14, 18, 22, 28, 34]
    history = [10.0, 14.0, 18.0, 22.0, 28.0, 34.0]
    res = forecasting_engine.predict(
        target_type="camera",
        target_id="CAM-001",
        history_values=history,
        baseline_expected=12.0,
        forecast_horizon_minutes=60,
        current_risk_score=45,
        has_route_anomalies=True,
        has_behaviour_probing=True
    )
    assert res["status"] == "COMPLETED"
    assert res["forecast_level"] in ["ELEVATED", "HIGH"]
    assert res["expected_activity_count"] > 12.0
    assert res["expected_range_min"] <= res["expected_activity_count"]
    assert res["expected_range_max"] >= res["expected_activity_count"]
    assert res["confidence"] > 0.60
    assert len(res["reasons"]) >= 2
    assert any(r["driver"] == "PERIMETER_PROBING_INDICATORS" for r in res["reasons"])

def test_forecasting_insufficient_data_behavior(db_session):
    """Test that sparse historical data returns INSUFFICIENT_DATA without fabricating predictions."""
    cam = db_session.query(Camera).filter(Camera.camera_id == "CAM-001").first()
    if cam:
        cam.status = "HEALTHY"
        db_session.commit()

    history = [10.0, 12.0] # Only 2 points, below minimum threshold (4)
    res = forecasting_engine.predict(
        target_type="camera",
        target_id="CAM-001",
        history_values=history,
        baseline_expected=12.0
    )
    assert res["status"] == "INSUFFICIENT_DATA"
    assert res["confidence"] <= 0.50
    assert any(r["driver"] == "HISTORICAL_SAMPLE_SPARSE" for r in res["reasons"])

def test_infrastructure_outage_vs_activity_drop(db_session):
    """Test that an offline camera triggers INFRASTRUCTURE_DEGRADED rather than a false activity drop."""
    offline_cam_id = f"CAM-OFFLINE-{uuid.uuid4().hex[:4].upper()}"
    cam = Camera(
        camera_id=offline_cam_id,
        camera_name="Offline Test Post",
        bop_site="BOP Alpha",
        sector="North Sector",
        enabled=True,
        status="OFFLINE",
        rtsp_url="synthetic://offline/main"
    )
    db_session.add(cam)
    db_session.commit()

    dq_score, is_down, reason = infrastructure_correlator.evaluate_camera_data_quality(offline_cam_id)
    assert is_down is True
    assert reason == "CAMERA_OFFLINE"
    assert dq_score <= 0.30

    # Forecasting should detect infrastructure degradation
    res = forecasting_engine.predict(
        target_type="camera",
        target_id=offline_cam_id,
        history_values=[10.0, 12.0, 14.0, 16.0]
    )
    assert res["status"] == "INFRASTRUCTURE_DEGRADED"

def test_early_warning_creation_and_deduplication(db_session):
    """Test creation and deduplication of early warnings."""
    cam_id = f"CAM-TEST-EW-{uuid.uuid4().hex[:4].upper()}"
    ew1 = early_warning_service.emit_or_update_warning(
        camera_id=cam_id,
        zone_id="ZONE-TEST",
        zone_name="Test Restricted Wire",
        site_id="BOP Alpha",
        warning_level="ELEVATED",
        forecast_risk_score=70,
        current_risk_score=45,
        confidence=0.80,
        data_quality_score=0.92,
        current_activity_count=25,
        baseline_expected_count=10.0,
        deviation_percent=150.0,
        trend="INCREASING",
        reasons=[{"driver": "SUSTAINED_SPIKE", "description": "Activity 2.5x baseline"}],
        counter_signals=[]
    )
    assert ew1.warning_id.startswith("EW-")
    assert ew1.lifecycle_status == "ACTIVE"

    # Second emit for same active camera/zone should update rather than duplicate
    ew2 = early_warning_service.emit_or_update_warning(
        camera_id=cam_id,
        zone_id="ZONE-TEST",
        zone_name="Test Restricted Wire",
        site_id="BOP Alpha",
        warning_level="HIGH",
        forecast_risk_score=85,
        current_risk_score=60,
        confidence=0.85,
        data_quality_score=0.92,
        current_activity_count=32,
        baseline_expected_count=10.0,
        deviation_percent=220.0,
        trend="INCREASING",
        reasons=[{"driver": "SUSTAINED_SPIKE", "description": "Activity 3.2x baseline"}],
        counter_signals=[]
    )
    assert ew2.warning_id == ew1.warning_id
    assert ew2.warning_level == "HIGH"
    assert ew2.forecast_risk_score == 85

def test_early_warning_acknowledgement_and_dismissal(db_session):
    """Test state transitions for early warnings."""
    res = client.get("/api/v1/predictive/warnings?limit=1")
    assert res.status_code == 200
    warnings = res.json()
    assert len(warnings) >= 1
    w_id = warnings[0]["warning_id"]

    # Acknowledge
    ack_res = client.post(f"/api/v1/predictive/warnings/{w_id}/acknowledge", json={"actor_username": "commander_1"})
    assert ack_res.status_code == 200
    assert ack_res.json()["lifecycle_status"] == "ACKNOWLEDGED"

    # Dismiss
    dism_res = client.post(f"/api/v1/predictive/warnings/{w_id}/dismiss", json={"actor_username": "commander_1", "notes": "Sector clear."})
    assert dism_res.status_code == 200
    assert dism_res.json()["lifecycle_status"] == "DISMISSED"

def test_baseline_shift_detection_and_approval(db_session):
    """Test baseline shift detection and admin approval."""
    cam_id = f"CAM-SHIFT-{uuid.uuid4().hex[:4].upper()}"
    # Seed baseline
    baseline = ActivityBaseline(
        camera_id=cam_id,
        hour_of_day=14,
        expected_person_count=10.0,
        expected_vehicle_count=3.0,
        version=1
    )
    db_session.add(baseline)
    db_session.commit()

    # Detect shift from 10.0 to 26.0 (+160%)
    shift = early_warning_service.detect_and_record_baseline_shift(
        camera_id=cam_id,
        hour_of_day=14,
        old_value=10.0,
        new_value=26.0
    )
    assert shift is not None
    assert shift.status == "REVIEW_REQUIRED"

    # Approve shift via API
    res = client.post(f"/api/v1/predictive/baseline-shifts/{shift.shift_id}/approve", json={
        "approve": True,
        "notes": "Approved new routine shift change baseline."
    })
    assert res.status_code == 200
    assert res.json()["status"] == "APPROVED"

    # Verify baseline updated
    db_session.refresh(baseline)
    assert baseline.expected_person_count == 26.0
    assert baseline.version == 2

def test_spatial_hotspot_analysis():
    """Test spatial security hotspot calculation across zones."""
    res = client.get("/api/v1/predictive/hotspots")
    assert res.status_code == 200
    hotspots = res.json()
    assert len(hotspots) >= 1
    assert "hotspot_level" in hotspots[0]
    assert "activity_density" in hotspots[0]
    assert "latitude" in hotspots[0]
    assert "longitude" in hotspots[0]

def test_predictive_camera_prioritization():
    """Test smart monitoring recommendations for prioritized cameras."""
    res = client.get("/api/v1/predictive/recommended-attention")
    assert res.status_code == 200
    data = res.json()
    assert "recommendations" in data
    assert len(data["recommendations"]) >= 1
    assert "priority" in data["recommendations"][0]
    assert "reason" in data["recommendations"][0]

def test_prediction_feedback_and_model_health_endpoint(db_session):
    """Test model health telemetry and prediction feedback recording."""
    health_res = client.get("/api/v1/predictive/model-health")
    assert health_res.status_code == 200
    health = health_res.json()
    assert health["status"] == "HEALTHY"
    assert "data_quality_score" in health
    assert "mae_score" in health

    # Submit feedback
    fb_res = client.post("/api/v1/predictive/feedback", json={
        "warning_id": "EW-DEMO-001",
        "feedback_type": "USEFUL_FORECAST",
        "notes": "Enabled early patrol deployment",
        "operator_username": "operator"
    })
    assert fb_res.status_code == 201
    assert fb_res.json()["feedback_type"] == "USEFUL_FORECAST"
