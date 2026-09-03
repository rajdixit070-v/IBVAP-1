import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.core.security import create_access_token
from app.models.camera import Camera
from app.models.edge_node import EdgeNode
from app.models.person_watchlist import PersonWatchlist
from app.models.vehicle_watchlist import VehicleWatchlist
from app.models.incident import Incident
from app.models.sensor_models import Sensor
from app.models.drone_models import Drone
from app.models.zone import SecurityZone

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_headers():
    token = create_access_token("admin", role="admin")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def test_camera_registration_lifecycle(auth_headers):
    db = SessionLocal()
    db.query(Camera).filter(Camera.camera_id == "CAM-REG-TEST-01").delete()
    db.commit()
    db.close()

    payload = {
        "camera_id": "CAM-REG-TEST-01",
        "camera_name": "Perimeter Radar Cam 01",
        "bop_site": "BOP Alpha",
        "sector": "Sector North",
        "site_id": "SITE-BORDER-NORTH",
        "bop_id": "BOP-001",
        "edge_node_id": "CENTRAL",
        "rtsp_url": "rtsp://192.168.1.100:554/stream1",
        "stream_type": "main",
        "enabled": True
    }
    res = client.post("/api/v1/cameras", json=payload, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["camera_id"] == "CAM-REG-TEST-01"

def test_edge_node_registration_lifecycle(auth_headers):
    db = SessionLocal()
    db.query(EdgeNode).filter(EdgeNode.node_id == "EDGE-REG-TEST-01").delete()
    db.commit()
    db.close()

    payload = {
        "node_id": "EDGE-REG-TEST-01",
        "name": "Edge Appliance Outpost 01",
        "bop_site": "BOP Alpha",
        "location": "North Observation Tower",
        "software_version": "1.0.0",
        "hardware_info": "NVIDIA Jetson Orin NX",
        "low_bandwidth_mode": False
    }
    res = client.post("/api/v1/edge/nodes", json=payload, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["node_id"] == "EDGE-REG-TEST-01"

def test_watchlist_person_registration_lifecycle(auth_headers):
    db = SessionLocal()
    db.query(PersonWatchlist).filter(PersonWatchlist.person_id == "PID-REG-TEST-01").delete()
    db.commit()
    db.close()

    payload = {
        "person_id": "PID-REG-TEST-01",
        "display_name": "Subject of Interest 01",
        "category": "WATCHLIST",
        "status": "ACTIVE",
        "notes": "Testing identity creation",
        "embedding": [0.01] * 128
    }
    res = client.post("/api/v1/watchlist/persons/", json=payload, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["person_id"] == "PID-REG-TEST-01"

def test_vehicle_registration_lifecycle(auth_headers):
    db = SessionLocal()
    db.query(VehicleWatchlist).filter(VehicleWatchlist.plate_number == "PB02REG9999").delete()
    db.commit()
    db.close()

    payload = {
        "plate_number": "PB02REG9999",
        "vehicle_type": "truck",
        "watchlist_category": "RESTRICTED_THREAT",
        "notes": "Border logistics truck flagged"
    }
    res = client.post("/api/v1/vehicles/", json=payload, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["plate_number"] == "PB02REG9999"

def test_incident_registration_lifecycle(auth_headers):
    payload = {
        "title": "Suspected Fence Breach Sector 4",
        "description": "Optical tripwire crossing confirmed by thermal signature.",
        "severity": "HIGH",
        "camera_id": "CAM-REG-TEST-01",
        "incident_type": "INTRUSION"
    }
    res = client.post("/api/v1/incidents/", json=payload, headers=auth_headers)
    assert res.status_code == 201
    assert "incident_id" in res.json()

def test_sensor_registration_lifecycle(auth_headers):
    db = SessionLocal()
    db.query(Sensor).filter(Sensor.sensor_id == "SEN-REG-TEST-01").delete()
    db.commit()
    db.close()

    payload = {
        "sensor_id": "SEN-REG-TEST-01",
        "name": "Seismic Geophone Array 01",
        "sensor_type": "SEISMIC",
        "site_id": "SITE-BORDER-NORTH",
        "sector": "Sector North",
        "latitude": 31.624,
        "longitude": 74.872
    }
    res = client.post("/api/v1/sensors", json=payload, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["sensor_id"] == "SEN-REG-TEST-01"

def test_drone_registration_lifecycle(auth_headers):
    db = SessionLocal()
    db.query(Drone).filter(Drone.drone_id == "UAV-REG-TEST-01").delete()
    db.commit()
    db.close()

    payload = {
        "drone_id": "UAV-REG-TEST-01",
        "name": "EagleEye Patrol UAV 01",
        "model": "BorderGuardian-X8",
        "site_id": "SITE-BORDER-NORTH",
        "status": "AVAILABLE",
        "battery_pct": 98.0,
        "latitude": 31.6240,
        "longitude": 74.8720,
        "altitude_m": 50.0,
        "heading_deg": 90.0,
        "speed_mps": 0.0,
        "flight_state": "LANDED",
        "gps_satellites": 16,
        "link_quality_pct": 95.0
    }
    res = client.post("/api/v1/drones", json=payload, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["drone_id"] == "UAV-REG-TEST-01"

def test_security_zone_registration_lifecycle(auth_headers):
    payload = {
        "name": "Sector 4 Restricted Buffer",
        "zone_type": "RESTRICTED",
        "polygon": [
            {"x": 0.1, "y": 0.1},
            {"x": 0.5, "y": 0.1},
            {"x": 0.5, "y": 0.5},
            {"x": 0.1, "y": 0.5}
        ],
        "monitored_classes": ["person", "vehicle"],
        "direction_rule": "NONE",
        "severity": "HIGH",
        "enabled": True,
        "camera_id": "CAM-REG-TEST-01"
    }
    res = client.post("/api/v1/zones/", json=payload, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["name"] == "Sector 4 Restricted Buffer"
