import pytest
import numpy as np
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.camera import Camera
from app.models.edge_node import EdgeNode
from app.models.incident import Incident
from app.models.health_models import HealthEvent, MaintenanceWindow, HealthConfigRecord
from app.models.audit_log import SecurityAuditLog
from app.services.health.camera_quality_analyzer import camera_quality_analyzer
from app.services.health.diagnostic_engine import diagnostic_engine
from app.services.health.system_health_service import system_health_service

client = TestClient(app)

@pytest.fixture(scope="function")
def db():
    session = SessionLocal()
    yield session
    session.close()

def test_explainable_health_score_calculation(db):
    """Test that system health summary returns an explainable 0-100 score with 5 factor contributors."""
    res = client.get("/api/v1/health/system")
    assert res.status_code == 200
    data = res.json()

    assert "overall_score" in data
    assert 0.0 <= data["overall_score"] <= 100.0
    assert data["status"] in ["HEALTHY", "DEGRADED", "WARNING", "CRITICAL"]
    assert "status_label" in data

    contributors = data["contributors"]
    assert len(contributors) == 5

    names = [c["name"] for c in contributors]
    assert "Camera Availability" in names
    assert "RTSP Stability" in names
    assert "AI Inference Pipeline" in names
    assert "Network & Edge Fleet" in names
    assert "Storage & Database Latency" in names

    total_weight = sum(c["weight"] for c in contributors)
    assert pytest.approx(total_weight, 0.01) == 1.0

def test_camera_health_list_and_fps_degradation(db):
    """Test camera health reporting with FPS metrics and degradation detection."""
    # Ensure test camera exists with degraded FPS
    cam = db.query(Camera).filter(Camera.camera_id == "CAM-001").first()
    if not cam:
        cam = Camera(
            camera_id="CAM-001",
            camera_name="Test North Tower",
            bop_site="BOP Alpha",
            sector="North Sector",
            rtsp_url="test://cam01",
            status="HEALTHY",
            enabled=True,
            expected_fps=25.0,
            fps=8.0 # Degraded!
        )
        db.add(cam)
    else:
        cam.status = "HEALTHY"
        cam.is_maintenance = False
        cam.expected_fps = 25.0
        cam.fps = 8.0
    db.commit()

    res = client.get("/api/v1/health/cameras")
    assert res.status_code == 200
    cameras = res.json()
    assert len(cameras) >= 1

    c1 = next((c for c in cameras if c["camera_id"] == "CAM-001"), None)
    assert c1 is not None
    assert c1["expected_fps"] == 25.0
    assert c1["actual_fps"] == 8.0
    assert c1["fps_degraded"] is True
    assert c1["status"] in ["ONLINE", "HEALTHY"]

def test_camera_image_quality_and_confidence_modulation():
    """Test optical quality analysis (blur, brightness, contrast) and AI confidence modulation."""
    # 1. Normal sharp test frame (100x100 random noise)
    sharp_frame = np.random.randint(50, 200, (100, 100, 3), dtype=np.uint8)
    metrics_sharp = camera_quality_analyzer.analyze_frame(sharp_frame)

    assert metrics_sharp["image_quality_score"] > 40.0
    assert metrics_sharp["tampering_detected"] is False
    assert metrics_sharp["confidence_multiplier"] >= 0.70

    # 2. Extreme low-light / pitch black frame
    black_frame = np.zeros((100, 100, 3), dtype=np.uint8)
    metrics_black = camera_quality_analyzer.analyze_frame(black_frame)

    assert metrics_black["brightness_score"] < 5.0
    assert metrics_black["tampering_detected"] is True
    assert "obstruction" in metrics_black["tampering_reason"].lower()
    assert metrics_black["confidence_multiplier"] <= 0.50

def test_camera_tampering_detection():
    """Test obstruction / tampering detection on solid blurred occlusion frame."""
    # Create solid grey frame with zero contrast and zero sharpness
    grey_frame = np.full((100, 100, 3), 128, dtype=np.uint8)
    metrics = camera_quality_analyzer.analyze_frame(grey_frame)

    assert metrics["blur_score"] < 5.0
    assert metrics["contrast_score"] < 5.0
    assert metrics["tampering_detected"] is True
    assert "Potential camera obstruction" in metrics["tampering_reason"]

def test_edge_node_unresponsive_detection(db):
    """Test that edge nodes with stale heartbeats are marked unresponsive with affected cameras."""
    node = db.query(EdgeNode).filter(EdgeNode.node_id == "EDGE-BOP-001").first()
    if not node:
        node = EdgeNode(
            node_id="EDGE-BOP-001",
            name="Alpha Outpost Gateway",
            bop_site="BOP Alpha",
            status="ONLINE"
        )
        db.add(node)
    # Stale heartbeat (120s ago)
    node.last_heartbeat = datetime.utcnow() - timedelta(seconds=120)
    db.commit()

    res = client.get("/api/v1/health/edges")
    assert res.status_code == 200
    nodes = res.json()
    n1 = next((n for n in nodes if n["node_id"] == "EDGE-BOP-001"), None)
    assert n1 is not None
    assert n1["is_unresponsive"] is True
    assert n1["status"] == "OFFLINE"
    assert n1["heartbeat_age_seconds"] >= 100.0

def test_self_diagnostic_engine_root_cause_correlation(db):
    """Test that the self-diagnostic engine identifies likely root cause with confidence and evidence."""
    # Setup node and cameras in offline state
    node = db.query(EdgeNode).filter(EdgeNode.node_id == "EDGE-TEST-09").first()
    if not node:
        node = EdgeNode(
            node_id="EDGE-TEST-09",
            name="Remote Sector Node",
            bop_site="BOP Delta",
            status="ONLINE"
        )
        db.add(node)
    node.last_heartbeat = datetime.utcnow() - timedelta(seconds=180)
    db.commit()

    findings = diagnostic_engine.evaluate_diagnostics()
    assert len(findings) >= 1

    edge_finding = next((f for f in findings if "EDGE-TEST-09" in f.what_happened), None)
    assert edge_finding is not None
    assert edge_finding.event_type == "EDGE_NODE_UNRESPONSIVE"
    assert edge_finding.severity == "CRITICAL"
    assert "Likely edge-node" in edge_finding.possible_root_cause
    assert edge_finding.confidence_percent >= 70.0
    assert len(edge_finding.evidence_signals) >= 1
    assert len(edge_finding.recommendations) >= 1

def test_infrastructure_incident_creation(db):
    """Test that correlated infrastructure outages automatically create Phase 10 INFRASTRUCTURE incidents."""
    inc = db.query(Incident).filter(Incident.incident_type == "INFRASTRUCTURE").first()
    assert inc is not None
    assert inc.incident_type == "INFRASTRUCTURE"
    assert inc.playbook_id == "PB-INFRASTRUCTURE-OUTAGE"

def test_maintenance_mode_and_alert_suppression(db):
    """Test placing a camera in maintenance mode and verifying alert suppression."""
    res = client.post("/api/v1/health/maintenance", json={
        "target_type": "CAMERA",
        "target_id": "CAM-001",
        "reason": "Optical lens replacement and realignment",
        "duration_minutes": 120,
        "authorized_by": "supervisor"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["target_id"] == "CAM-001"
    assert data["status"] == "ACTIVE"

    # Verify camera state updated
    cam = db.query(Camera).filter(Camera.camera_id == "CAM-001").first()
    assert cam.is_maintenance is True
    assert cam.status == "MAINTENANCE"

    # Verify camera listing reflects maintenance
    c_res = client.get("/api/v1/health/cameras/CAM-001")
    assert c_res.status_code == 200
    assert c_res.json()["is_maintenance"] is True
    assert c_res.json()["status"] == "MAINTENANCE"

def test_camera_priority_configuration_and_audit(db):
    """Test changing camera operational priority with audit trail."""
    res = client.post("/api/v1/health/cameras/CAM-001/priority", json={
        "priority": "CRITICAL",
        "reason": "Active intrusion investigation",
        "authorized_by": "commander"
    })
    assert res.status_code == 200
    assert res.json()["priority"] == "CRITICAL"

    cam = db.query(Camera).filter(Camera.camera_id == "CAM-001").first()
    assert cam.priority == "CRITICAL"

    audit = db.query(SecurityAuditLog).filter(
        SecurityAuditLog.action == "CAMERA_PRIORITY_CHANGED",
        SecurityAuditLog.resource_id == "CAM-001"
    ).first()
    assert audit is not None
    assert audit.username == "commander"

def test_storage_and_network_telemetry_endpoints():
    """Test storage, network, queues, and service dependency endpoints."""
    # Storage
    s_res = client.get("/api/v1/health/storage")
    assert s_res.status_code == 200
    s_data = s_res.json()
    assert "total_gb" in s_data
    assert "used_gb" in s_data
    assert "retention_days" in s_data
    assert s_data["retention_days"] == 30

    # Network
    n_res = client.get("/api/v1/health/network")
    assert n_res.status_code == 200
    n_data = n_res.json()
    assert n_data["status"] in ["GOOD", "DEGRADED", "POOR", "OFFLINE"]

    # Queues
    q_res = client.get("/api/v1/health/queues")
    assert q_res.status_code == 200
    assert len(q_res.json()) >= 1

    # Services
    srv_res = client.get("/api/v1/health/services")
    assert srv_res.status_code == 200
    assert len(srv_res.json()) >= 4

def test_health_config_versioning_and_audit(db):
    """Test updating health thresholds and verifying version increment and audit log."""
    cfg_get = client.get("/api/v1/health/config")
    assert cfg_get.status_code == 200

    update_res = client.put("/api/v1/health/config", json={
        "heartbeat_timeout_seconds": 75,
        "storage_warning_percent": 82.0,
        "notes": "Adjusting SLA thresholds for high-winds storm",
        "changed_by": "sysadmin"
    })
    assert update_res.status_code == 200
    assert update_res.json()["heartbeat_timeout_seconds"] == 75
    assert update_res.json()["storage_warning_percent"] == 82.0

    record = db.query(HealthConfigRecord).order_by(HealthConfigRecord.version.desc()).first()
    assert record is not None
    assert record.changed_by == "sysadmin"

    audit = db.query(SecurityAuditLog).filter(SecurityAuditLog.action == "HEALTH_CONFIG_UPDATED").first()
    assert audit is not None
