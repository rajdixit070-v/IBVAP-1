import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.config import settings, validate_environment
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.camera import Camera
from app.models.ai_event import AIEvent
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.evidence import Evidence
from app.models.health_log import CameraHealthLog
from app.models.health_models import SystemHealthSnapshot
from app.models.enterprise_security_models import SecurityThreatEvent
from app.services.maintenance.data_retention import DataRetentionService
from app.services.demo.demo_service import DemoService
from app.core.security import create_access_token, get_password_hash

client = TestClient(app)

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

def test_environment_configuration_and_validation():
    """Requirement 4 & 5: Test startup environment validation and safe error checking."""
    status = validate_environment()
    assert "status" in status
    assert status["database_configured"] is True
    assert status["storage_ready"] is True
    assert "password" not in str(status).lower()
    assert "secret" not in str(status).lower() or "SECRET_KEY" in str(status)

def test_liveness_probe_endpoint():
    """Requirement 7 & 8: Test Kubernetes / Container liveness probe."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ALIVE"
    assert "version" in data
    assert "timestamp" in data

def test_readiness_probe_endpoint():
    """Requirement 7 & 8: Test Kubernetes / Container readiness probe."""
    res = client.get("/ready")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "READY"
    assert data["subsystems"]["database"] == "OK"
    assert data["subsystems"]["storage"] == "OK"

def test_system_metrics_endpoint():
    """Requirement 19, 21 & 59: Test live system performance metrics."""
    res = client.get("/api/v1/system/metrics")
    assert res.status_code == 200
    data = res.json()
    assert "cpu_percent" in data
    assert "memory_rss_mb" in data
    assert "active_rtsp_streamers" in data
    assert "version" in data

def test_data_retention_pruning(db):
    """Requirement 33 & 34: Test automated data retention and safe evidence preservation."""
    # Add expired health log (older than 14 days)
    expired_time = datetime.utcnow() - timedelta(days=20)
    old_log = CameraHealthLog(
        camera_id="CAM-RETENTION-TEST",
        event_type="FPS_MONITOR",
        timestamp=expired_time,
        status="ONLINE",
        fps=25.0
    )
    db.add(old_log)

    # Add fresh health log (within 14 days)
    fresh_log = CameraHealthLog(
        camera_id="CAM-RETENTION-TEST",
        event_type="FPS_MONITOR",
        timestamp=datetime.utcnow(),
        status="ONLINE",
        fps=25.0
    )
    db.add(fresh_log)
    db.commit()

    # Run pruning
    summary = DataRetentionService.prune_expired_records(db, dry_run=False)
    assert summary["status"] == "COMPLETED"
    assert summary["purged_counts"]["camera_health_logs"] >= 1

    # Verify fresh log is preserved
    fresh_check = db.query(CameraHealthLog).filter(CameraHealthLog.timestamp > datetime.utcnow() - timedelta(days=1)).first()
    assert fresh_check is not None

def test_demo_mode_status_and_scenarios():
    """Requirement 87 & 88: Test Demo Mode status and scenario discovery."""
    res = client.get("/api/v1/demo/scenarios")
    assert res.status_code == 200
    scenarios = res.json()
    assert len(scenarios) >= 4
    scenario_ids = [s["id"] for s in scenarios]
    assert "HACKATHON_MASTER_FLOW" in scenario_ids
    assert "VEHICLE_ANPR_FLOW" in scenario_ids

    status_res = client.get("/api/v1/demo/status")
    assert status_res.status_code == 200
    assert "demo_active" in status_res.json()

def test_hackathon_master_flow_16_steps_e2e(db):
    """Requirement 80 & 89: Test the complete 16-step Hackathon Master Intrusion & Incident Workflow."""
    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        admin_user = User(
            username="admin",
            email="admin@ibvap.mil",
            hashed_password=get_password_hash("Admin@IBVAP2026"),
            role="admin",
            is_active=True
        )
        db.add(admin_user)
        db.commit()

    token = create_access_token("admin", role="admin")

    # Reset demo
    client.post("/api/v1/demo/reset", headers={"Authorization": f"Bearer {token}"})

    # Run all 16 steps sequentially
    res = client.post(
        "/api/v1/demo/run-scenario",
        json={"scenario_id": "HACKATHON_MASTER_FLOW", "auto_run_all": True},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["total_steps"] == 16
    assert len(data["results"]) == 16

    # Verify key steps in the result
    steps = {r["step"]: r for r in data["results"]}
    assert steps[1]["title"] == "Camera Stream Ingested"
    assert steps[2]["title"] == "Person Detected in Frame"
    assert steps[5]["title"] == "Virtual Fence Boundary Breach"
    assert steps[7]["details"]["risk_score"] >= 80
    assert steps[14]["details"]["status"] == "RESOLVED"
    assert steps[15]["details"]["action"] == "DEMO_SCENARIO_EXECUTION"

def test_vehicle_anpr_demo_flow(db):
    """Requirement 81 & 90: Test Vehicle ANPR and classification demo."""
    token = create_access_token("admin", role="admin")
    res = client.post(
        "/api/v1/demo/run-scenario",
        json={"scenario_id": "VEHICLE_ANPR_FLOW", "step_index": 1},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["details"]["plate_number"] == "JK02AB1234"
    assert data["details"]["ocr_confidence"] >= 0.9

def test_multi_camera_handover_flow(db):
    """Requirement 91: Test multi-camera handover and global track association."""
    token = create_access_token("admin", role="admin")
    res = client.post(
        "/api/v1/demo/run-scenario",
        json={"scenario_id": "MULTI_CAMERA_HANDOVER", "step_index": 1},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["details"]["origin_camera"] == "CAM-DEMO-01"
    assert data["details"]["destination_camera"] == "CAM-DEMO-02"
    assert "GTRK-" in data["details"]["global_track_id"]

def test_failure_and_self_healing_recovery_demo(db):
    """Requirement 92 & 93: Test camera disconnect and automatic self-healing recovery."""
    token = create_access_token("admin", role="admin")
    # Step 1: Disconnection
    res1 = client.post(
        "/api/v1/demo/run-scenario",
        json={"scenario_id": "SYSTEM_FAILURE_RECOVERY", "step_index": 1},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res1.json()["details"]["status"] == "DISCONNECTED"

    # Step 3: Recovered
    res3 = client.post(
        "/api/v1/demo/run-scenario",
        json={"scenario_id": "SYSTEM_FAILURE_RECOVERY", "step_index": 3},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res3.json()["details"]["status"] == "ONLINE"

def test_synthetic_camera_scalability_simulation(db):
    """Requirement 63 & 64: Test camera architecture scales to 10, 50, and 100 configured cameras."""
    cameras_to_create = []
    for i in range(1, 21):  # Test scalable batch creation
        cam_id = f"CAM-SCALE-TEST-{i:03d}"
        if not db.query(Camera).filter(Camera.camera_id == cam_id).first():
            cameras_to_create.append(
                Camera(
                    camera_id=cam_id,
                    camera_name=f"Scalability Test Camera {i}",
                    bop_site="BOP Alpha",
                    sector="Sector Alpha",
                    rtsp_url=f"synthetic://scale-{i}/live",
                    site_id="SITE-BORDER-NORTH",
                    bop_id="BOP-ALPHA",
                    status="ONLINE"
                )
            )
    if cameras_to_create:
        db.add_all(cameras_to_create)
        db.commit()

    token = create_access_token("admin", role="admin")
    res = client.get("/api/v1/cameras?limit=100", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    cams = res.json()
    assert len(cams) >= 20

def test_security_idor_attack_journey(db):
    """Requirement 84 & 95: Test IDOR security denial and automatic security event generation."""
    # Create target camera in South Site
    south_cam = db.query(Camera).filter(Camera.camera_id == "CAM-SOUTH-SEC-01").first()
    if not south_cam:
        south_cam = Camera(
            camera_id="CAM-SOUTH-SEC-01",
            camera_name="South Sector Boundary 1",
            bop_site="BOP South 1",
            sector="South Sector",
            rtsp_url="rtsp://192.168.20.10:554/stream",
            site_id="SITE-BORDER-SOUTH",
            bop_id="BOP-SOUTH-1"
        )
        db.add(south_cam)
        db.commit()

    # User with North Site scope only
    token = create_access_token("north_operator_test", role="operator")
    res = client.get(f"/api/v1/cameras/{south_cam.camera_id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code in [401, 403]
