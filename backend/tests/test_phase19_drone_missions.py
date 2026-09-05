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

from app.models.drone_models import Drone, DroneMission, DroneHandoffEvent

@pytest.fixture(scope="module")
def auth_headers():
    token = create_access_token("admin", role="admin")
    return {"Authorization": f"Bearer {token}"}

def test_drone_registry_and_telemetry(client, auth_headers):
    db = SessionLocal()
    db.query(Drone).filter(Drone.drone_id == "UAV-TEST-02").delete()
    db.commit()
    db.close()

    # 1. Register drone
    drone_payload = {
        "drone_id": "UAV-TEST-02",
        "name": "Eagle Test Sentinel",
        "model": "BorderGuardian-X8",
        "site_id": "SITE-BORDER-NORTH",
        "status": "AVAILABLE",
        "battery_pct": 98.0,
        "latitude": 31.6250,
        "longitude": 74.8730,
        "altitude_m": 40.0,
        "heading_deg": 90.0,
        "speed_mps": 0.0,
        "flight_state": "HOVER"
    }
    res = client.post("/api/v1/drones", json=drone_payload, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["drone_id"] == "UAV-TEST-02"

    # 2. Update telemetry
    tel_payload = {
        "latitude": 31.6255,
        "longitude": 74.8735,
        "altitude_m": 45.0,
        "heading_deg": 105.0,
        "speed_mps": 8.5,
        "battery_pct": 95.0,
        "flight_state": "CRUISE",
        "gps_satellites": 18,
        "link_quality_pct": 98.0
    }
    tel_res = client.post("/api/v1/drones/UAV-TEST-02/telemetry", json=tel_payload, headers=auth_headers)
    assert tel_res.status_code == 200
    assert tel_res.json()["battery_pct"] == 95.0
    assert tel_res.json()["flight_state"] == "CRUISE"

def test_drone_mission_lifecycle_and_handoff(client, auth_headers):
    # 1. Create mission
    mission_payload = {
        "drone_id": "UAV-TEST-02",
        "site_id": "SITE-BORDER-NORTH",
        "mission_type": "PATROL",
        "priority": "HIGH",
        "objective": "Autonomous zero-line thermal sweep"
    }
    m_res = client.post("/api/v1/drones/missions", json=mission_payload, headers=auth_headers)
    assert m_res.status_code == 201
    m_data = m_res.json()
    mission_id = m_data["mission_id"]
    assert m_data["status"] == "PLANNED"

    # 2. Dispatch mission
    disp_res = client.post(f"/api/v1/drones/missions/{mission_id}/dispatch", headers=auth_headers)
    assert disp_res.status_code == 200
    assert disp_res.json()["status"] == "ACTIVE"

    # 3. Target Handoff (Camera -> Drone)
    handoff_req = {
        "source_type": "CAMERA",
        "source_id": "CAM-001",
        "destination_type": "DRONE",
        "destination_id": "UAV-TEST-02",
        "global_track_id": "GTRK-TEST-999",
        "target_class": "PERSON",
        "location_lat": 31.6240,
        "location_lng": 74.8720,
        "reason": "Target moving into unmonitored brush corridor"
    }
    h_res = client.post("/api/v1/drones/handoff", json=handoff_req, headers=auth_headers)
    assert h_res.status_code == 200
    h_data = h_res.json()
    assert h_data["global_track_id"] == "GTRK-TEST-999"
    assert h_data["confidence"] > 0.80

    # 4. Complete mission
    comp_res = client.post(f"/api/v1/drones/missions/{mission_id}/complete", headers=auth_headers)
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "COMPLETED"

