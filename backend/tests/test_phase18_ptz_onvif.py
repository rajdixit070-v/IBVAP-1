import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, engine, SessionLocal
from app.models.user import User
from app.core.security import get_password_hash, create_access_token

@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def auth_headers():
    token = create_access_token("admin", role="admin")
    return {"Authorization": f"Bearer {token}"}

def test_onvif_discovery(client, auth_headers):
    res = client.get("/api/v1/ptz/discover", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert data[0]["supports_ptz"] is True

def test_ptz_move_and_stop(client, auth_headers):
    move_req = {
        "move_type": "CONTINUOUS",
        "pan_speed": 0.5,
        "tilt_speed": -0.3,
        "zoom_speed": 0.2
    }
    res = client.post("/api/v1/ptz/CAM-001/move", json=move_req, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "SUCCESS"

    stop_res = client.post("/api/v1/ptz/CAM-001/stop", headers=auth_headers)
    assert stop_res.status_code == 200
    assert stop_res.json()["status"] == "STOPPED"

def test_ptz_presets_and_auto_tracking(client, auth_headers):
    # 1. Create preset
    preset_data = {
        "preset_name": "Test Perimeter North",
        "pan": 35.0,
        "tilt": -12.0,
        "zoom": 3.0
    }
    res = client.post("/api/v1/ptz/CAM-001/presets", json=preset_data, headers=auth_headers)
    assert res.status_code == 201
    token = res.json()["preset_token"]

    # 2. Drive to preset
    goto_res = client.post(f"/api/v1/ptz/CAM-001/presets/{token}/goto", headers=auth_headers)
    assert goto_res.status_code == 200

    # 3. Test ByteTrack auto-tracking step
    track_req = {
        "enable": True,
        "target_id": "TRK-001",
        "bbox": [0.65, 0.40, 0.10, 0.20] # target off-center to right
    }
    track_res = client.post("/api/v1/ptz/CAM-001/auto-track", json=track_req, headers=auth_headers)
    assert track_res.status_code == 200
    t_data = track_res.json()
    assert t_data["status"] == "TRACKING_ACTIVE"
    assert t_data["steering"]["pan_vel"] > 0 # steered right toward target

