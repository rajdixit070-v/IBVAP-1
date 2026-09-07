import time
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.camera import Camera
from app.models.federation_models import SiteUserScope
from app.models.bop_dispatch import BOPDispatch
from app.models.evidence import Evidence
from app.core.security import get_password_hash, create_access_token

client = TestClient(app)

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

def test_camera_save_by_officer(db: Session):
    """Verifies that non-admin duty officers and operators can save/register checkpost cameras."""
    officer = db.query(User).filter(User.username == "test_duty_officer").first()
    if not officer:
        officer = User(
            username="test_duty_officer",
            email="duty_officer@ibvap.mil",
            hashed_password=get_password_hash("OfficerSecret#2026"),
            role="OFFICER",
            is_active=True
        )
        db.add(officer)
        db.commit()

    scope = db.query(SiteUserScope).filter(SiteUserScope.username == "test_duty_officer").first()
    if not scope:
        scope = SiteUserScope(
            username="test_duty_officer",
            scope_type="BOP",
            scope_id="BOP-ALPHA",
            role="OFFICER"
        )
        db.add(scope)
        db.commit()

    token = create_access_token("test_duty_officer", role="OFFICER")
    headers = {"Authorization": f"Bearer {token}"}

    cam_id = "CAM-REGTEST-01"
    # Cleanup if exists
    client.delete(f"/api/v1/cameras/{cam_id}", headers=headers)

    payload = {
        "camera_id": cam_id,
        "camera_name": "Checkpost Alpha Outer Gate",
        "bop_site": "BOP-ALPHA",
        "sector": "Sector-North",
        "rtsp_url": "rtsp://192.168.1.100:554/live",
        "stream_type": "RTSP",
        "latitude": 31.6245,
        "longitude": 74.8725,
        "location_description": "Alpha Gate Post",
        "resolution": "1920x1080",
        "fps": 25,
        "enabled": True,
        "ptz_enabled": False
    }

    res = client.post("/api/v1/cameras", json=payload, headers=headers)
    assert res.status_code in [200, 201], f"Expected 200/201, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["camera_id"] == cam_id
    assert data["camera_name"] == "Checkpost Alpha Outer Gate"

def test_live_stream_latency_and_snapshot(db: Session):
    """Verifies that live snapshot generation is ultra low-latency and yields valid JPEG bytes."""
    token = create_access_token("test_duty_officer", role="OFFICER")
    headers = {"Authorization": f"Bearer {token}"}

    t0 = time.time()
    res = client.get("/api/v1/cameras/CAM-REGTEST-01/snapshot", headers=headers)
    elapsed_ms = (time.time() - t0) * 1000

    assert res.status_code == 200
    assert "image/jpeg" in res.headers.get("content-type", "")
    assert len(res.content) > 100
    # Latency should be fast (<500ms)
    assert elapsed_ms < 500

def test_evidence_live_capture_and_sha256_sealing(db: Session):
    """Verifies live camera evidence capture with cryptographic SHA-256 seal & verification."""
    token = create_access_token("test_duty_officer", role="OFFICER")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Capture live evidence frame
    cap_res = client.post(
        "/api/v1/evidence/capture/CAM-REGTEST-01",
        params={"evidence_type": "SUSPECT_PERSON", "notes": "Automated test capture"},
        headers=headers
    )
    assert cap_res.status_code == 201
    evd = cap_res.json()
    evd_id = evd["evidence_id"]
    sha256 = evd["checksum_sha256"]

    assert evd_id.startswith("EVD-")
    assert sha256 is not None
    assert len(sha256) == 64

    # 2. Retrieve file bytes
    file_res = client.get(f"/api/v1/evidence/{evd_id}/file", headers=headers)
    assert file_res.status_code == 200
    assert len(file_res.content) > 0

    # 3. Verify integrity using direct stored file on disk
    verify_res_disk = client.post(
        f"/api/v1/evidence/{evd_id}/verify",
        json={},
        headers=headers
    )
    assert verify_res_disk.status_code == 200
    assert verify_res_disk.json()["is_valid"] is True

    # 4. Verify integrity using base64 payload
    import base64
    b64_content = base64.b64encode(file_res.content).decode("ascii")
    verify_res_b64 = client.post(
        f"/api/v1/evidence/{evd_id}/verify",
        json={"content": b64_content},
        headers=headers
    )
    assert verify_res_b64.status_code == 200
    assert verify_res_b64.json()["is_valid"] is True

def test_officer_transmit_sitrep_and_hq_acknowledgment(db: Session):
    """Verifies end-to-end Daily SITREP transmission from Outpost Officer to Central HQ with Directives."""
    officer_token = create_access_token("test_duty_officer", role="OFFICER")
    admin_token = create_access_token("admin", role="admin")

    # 1. Officer creates Daily SITREP dispatch
    sitrep_payload = {
        "bop_id": "BOP-ALPHA",
        "site_id": "SITE-BORDER-NORTH",
        "title": "Daily Shift 0800 SITREP",
        "summary": "Boundary patrol active. Zero incursions. 2 commercial vehicles scanned.",
        "priority": "URGENT",
        "detected_persons_count": 5,
        "vehicles_scanned_count": 2,
        "alerts_count": 0,
        "evidence_ids": []
    }
    disp_res = client.post(
        "/api/v1/dispatches",
        json=sitrep_payload,
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert disp_res.status_code == 201
    disp = disp_res.json()
    disp_id = disp["dispatch_id"]
    assert disp["status"] == "SENT_TO_HQ"

    # 2. Central Admin lists dispatches
    hq_res = client.get("/api/v1/dispatches", headers={"Authorization": f"Bearer {admin_token}"})
    assert hq_res.status_code == 200
    all_dispatches = hq_res.json()
    found = next((d for d in all_dispatches if d["dispatch_id"] == disp_id), None)
    assert found is not None

    # 3. Central Admin acknowledges with directive
    ack_res = client.post(
        f"/api/v1/dispatches/{disp_id}/acknowledge",
        json={"status": "ACKNOWLEDGED_BY_HQ", "hq_notes": "SITREP logged in Central HQ. Continue scheduled patrol."},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert ack_res.status_code == 200
    ack_data = ack_res.json()
    assert ack_data["status"] == "ACKNOWLEDGED_BY_HQ"
    assert "Continue scheduled patrol" in ack_data["hq_notes"]

    # Cleanup test camera
    client.delete("/api/v1/cameras/CAM-REGTEST-01", headers={"Authorization": f"Bearer {officer_token}"})
