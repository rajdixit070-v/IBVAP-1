import pytest
from app.config import settings

@pytest.fixture
def auth_header(client):
    login_resp = client.post(
        "/api/v1/auth/login-json",
        json={
            "username": settings.DEFAULT_ADMIN_USERNAME,
            "password": settings.DEFAULT_ADMIN_PASSWORD
        }
    )
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_list_cameras(client, auth_header):
    response = client.get("/api/v1/cameras", headers=auth_header)
    assert response.status_code == 200
    cameras = response.json()
    assert isinstance(cameras, list)

def test_purge_fake_cameras_endpoint(client, auth_header):
    # Purge fake cameras endpoint works
    resp = client.delete("/api/v1/cameras/purge-fake", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "purged_count" in data

def test_create_and_delete_camera(client, auth_header):
    # Pre-clean
    client.delete("/api/v1/cameras/TEST-CAM-999", headers=auth_header)

    camera_payload = {
        "camera_id": "TEST-CAM-999",
        "camera_name": "Test Border Post 999",
        "description": "Integration test camera",
        "bop_site": "BOP Delta",
        "sector": "Sector 9",
        "location": "Post 99",
        "latitude": 32.7000,
        "longitude": 74.8000,
        "rtsp_url": "synthetic://test-999/live",
        "username": "testadmin",
        "password": "SuperSecretPassword123!",
        "stream_type": "main",
        "enabled": True
    }
    
    # 1. Create camera
    create_resp = client.post("/api/v1/cameras", json=camera_payload, headers=auth_header)
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    assert created_data["camera_id"] == "TEST-CAM-999"
    # Verify password is NOT in response
    assert "password" not in created_data
    assert created_data["has_password"] is True
    
    # 2. Test duplicate creation rejected
    dup_resp = client.post("/api/v1/cameras", json=camera_payload, headers=auth_header)
    assert dup_resp.status_code == 400
    
    # 3. Update camera
    update_resp = client.put(
        "/api/v1/cameras/TEST-CAM-999",
        json={"camera_name": "Updated Test Camera Name", "enabled": False},
        headers=auth_header
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["camera_name"] == "Updated Test Camera Name"
    assert update_resp.json()["enabled"] is False

    # 4. Test connection
    test_conn_resp = client.post("/api/v1/cameras/TEST-CAM-999/test-connection", headers=auth_header)
    assert test_conn_resp.status_code == 200
    assert test_conn_resp.json()["success"] is True

    # 5. Delete camera
    del_resp = client.delete("/api/v1/cameras/TEST-CAM-999", headers=auth_header)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # 6. Verify deleted
    get_resp = client.get("/api/v1/cameras/TEST-CAM-999", headers=auth_header)
    assert get_resp.status_code == 404

def test_raw_rtsp_test(client, auth_header):
    # Valid synthetic test URL
    resp = client.post(
        "/api/v1/cameras/test-raw",
        json={"rtsp_url": "synthetic://cam-test/main"},
        headers=auth_header
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["connected"] is True
    assert data["resolution"] == "1920x1080"
    assert data["fps"] == 25.0

    # Invalid URL
    bad_resp = client.post(
        "/api/v1/cameras/test-raw",
        json={"rtsp_url": "rtsp://192.0.2.1:554/live"},
        headers=auth_header
    )
    assert bad_resp.status_code == 200
    bad_data = bad_resp.json()
    assert bad_data["success"] is False
    assert bad_data["connected"] is False

def test_summary_endpoint(client, auth_header):
    resp = client.get("/api/v1/cameras/overview/summary", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_cameras" in data
    assert "healthy" in data
    assert "bop_summary" in data

def test_create_tunnel_and_ip_camera(client, auth_header):
    # Pre-clean
    client.delete("/api/v1/cameras/TUNNEL-CAM-01", headers=auth_header)
    client.delete("/api/v1/cameras/IP-CAM-01", headers=auth_header)

    # 1. Register Tunnel camera
    tunnel_payload = {
        "camera_id": "TUNNEL-CAM-01",
        "camera_name": "Cloudflare Tunnel Camera",
        "bop_site": "BOP Wagah",
        "sector": "Punjab Frontier",
        "location": "Main Gate",
        "latitude": 31.6048,
        "longitude": 74.5721,
        "rtsp_url": "https://example-tunnel.trycloudflare.com/api/stream.m3u8?src=mycamera",
        "stream_type": "tunnel",
        "enabled": True
    }
    resp1 = client.post("/api/v1/cameras", json=tunnel_payload, headers=auth_header)
    assert resp1.status_code == 201
    data1 = resp1.json()
    assert data1["camera_id"] == "TUNNEL-CAM-01"
    assert data1["stream_type"] == "tunnel"

    # 2. Register IP Camera
    ip_payload = {
        "camera_id": "IP-CAM-01",
        "camera_name": "Perimeter IP Camera",
        "bop_site": "BOP Wagah",
        "sector": "Punjab Frontier",
        "location": "Watchtower 2",
        "latitude": 31.6048,
        "longitude": 74.5721,
        "rtsp_url": "rtsp://192.168.1.150:554/live",
        "stream_type": "ip_camera",
        "enabled": True
    }
    resp2 = client.post("/api/v1/cameras", json=ip_payload, headers=auth_header)
    assert resp2.status_code == 201
    data2 = resp2.json()
    assert data2["camera_id"] == "IP-CAM-01"
    assert data2["stream_type"] == "ip_camera"

    # Clean up
    client.delete("/api/v1/cameras/TUNNEL-CAM-01", headers=auth_header)
    client.delete("/api/v1/cameras/IP-CAM-01", headers=auth_header)
