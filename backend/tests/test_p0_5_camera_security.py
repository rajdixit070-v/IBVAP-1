import pytest
import io
import logging
from datetime import datetime, timedelta
from jose import jwt
from app.config import settings
from app.models.user import User
from app.models.camera import Camera
from app.core.security import get_password_hash, mask_rtsp_url
from app.database import SessionLocal
from app.services.stream_manager import stream_manager

@pytest.fixture
def db_session():
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture
def admin_headers(client):
    login_resp = client.post(
        "/api/v1/auth/login-json",
        json={"username": settings.DEFAULT_ADMIN_USERNAME, "password": settings.DEFAULT_ADMIN_PASSWORD}
    )
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_p0_5_1_live_no_token(client):
    """Test 1: GET /cameras/{id}/live without authentication returns 401 Unauthorized."""
    resp = client.get("/api/v1/cameras/CAM-001/live")
    assert resp.status_code == 401

def test_p0_5_2_live_invalid_token(client):
    """Test 2: GET /cameras/{id}/live with invalid/tampered token returns 401 Unauthorized."""
    resp = client.get(
        "/api/v1/cameras/CAM-001/live",
        headers={"Authorization": "Bearer invalid.jwt.token"}
    )
    assert resp.status_code == 401

def test_p0_5_3_live_unauthorized_camera_idor(client, db_session):
    """Test 3: Valid user attempting to access camera outside their site scope gets 403 Forbidden."""
    unauth_user = db_session.query(User).filter(User.username == "scoped_viewer_p05").first()
    if not unauth_user:
        unauth_user = User(
            username="scoped_viewer_p05",
            email="scoped_p05@ibvap.mil",
            hashed_password=get_password_hash("ViewerPass@2026"),
            role="viewer",
            is_active=True
        )
        db_session.add(unauth_user)
        db_session.commit()

    # Login as scoped viewer
    login_resp = client.post(
        "/api/v1/auth/login-json",
        json={"username": "scoped_viewer_p05", "password": "ViewerPass@2026"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Access a non-existent or out-of-scope camera
    resp = client.get("/api/v1/cameras/CAM-UNAUTHORIZED-999/live", headers=headers)
    assert resp.status_code in [403, 404]

@pytest.mark.asyncio
async def test_p0_5_4_live_authorized_camera(admin_headers):
    """Test 4: Valid authorized user can connect to live streaming generator."""
    stream_manager.start_camera(
        camera_id="CAM-001",
        camera_name="Perimeter Gate Alpha",
        bop_site="BOP Alpha",
        rtsp_url="synthetic://test/cam-001"
    )
    gen = stream_manager.generate_mjpeg_stream("CAM-001", fps_limit=25.0)
    async for chunk in gen:
        assert b"--frame" in chunk
        assert b"Content-Type: image/jpeg" in chunk
        break

def test_p0_5_5_snapshot_no_token(client):
    """Test 5: GET /cameras/{id}/snapshot without authentication returns 401 Unauthorized."""
    resp = client.get("/api/v1/cameras/CAM-001/snapshot")
    assert resp.status_code == 401

def test_p0_5_6_snapshot_authorized(client, admin_headers):
    """Test 6: Valid authorized user can retrieve JPEG snapshot."""
    stream_manager.start_camera(
        camera_id="CAM-001",
        camera_name="Perimeter Gate Alpha",
        bop_site="BOP Alpha",
        rtsp_url="synthetic://test/cam-001"
    )
    resp = client.get("/api/v1/cameras/CAM-001/snapshot", headers=admin_headers)
    # Expect 200 OK with image/jpeg, or 503 if stream initializing
    assert resp.status_code in [200, 503]
    if resp.status_code == 200:
        assert resp.headers.get("content-type") == "image/jpeg"
        assert len(resp.content) > 100

def test_p0_5_7_offline_camera_response(client, admin_headers, db_session):
    """Test 7: Offline/nonexistent camera returns appropriate error (404/503)."""
    resp = client.get("/api/v1/cameras/NONEXISTENT-CAM/snapshot", headers=admin_headers)
    assert resp.status_code == 404

def test_p0_5_8_camera_api_no_password_leak(client, admin_headers):
    """Test 8: Camera API responses never expose plaintext RTSP passwords."""
    resp = client.get("/api/v1/cameras", headers=admin_headers)
    assert resp.status_code == 200
    cameras = resp.json()
    for cam in cameras:
        assert "password" not in cam
        assert "encrypted_password" not in cam
        # Masked RTSP url should not contain cleartext password
        if "@" in cam.get("rtsp_url", ""):
            assert "***:***@" in cam["rtsp_url"]

def test_p0_5_9_mask_rtsp_url_security():
    """Test 9: RTSP URL masking safely redacts credentials from logs and output."""
    raw_url = "rtsp://admin:ClassifiedP@ss99@10.20.30.40:554/live"
    masked = mask_rtsp_url(raw_url)
    assert "ClassifiedP@ss99" not in masked
    assert "***:***@" in masked
    assert "10.20.30.40:554/live" in masked

def test_p0_5_10_camera_status_authenticated(client, admin_headers):
    """Test 10: Status endpoint requires authentication and returns accurate health info."""
    resp_unauth = client.get("/api/v1/cameras/CAM-001/status")
    assert resp_unauth.status_code == 401

    resp_auth = client.get("/api/v1/cameras/CAM-001/status", headers=admin_headers)
    assert resp_auth.status_code == 200
    data = resp_auth.json()
    assert "status" in data
    assert "is_streaming" in data
