import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.sensor_models import Sensor, SensorTelemetry, SensorFusionEvent
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

def test_sensor_registration_and_telemetry(client, auth_headers):
    db = SessionLocal()
    db.query(SensorTelemetry).filter(SensorTelemetry.sensor_id == "TEST-SEIS-01").delete()
    db.query(Sensor).filter(Sensor.sensor_id == "TEST-SEIS-01").delete()
    db.commit()
    db.close()

    # 1. Register new Seismic Sensor
    sensor_payload = {
        "sensor_id": "TEST-SEIS-01",
        "name": "Perimeter Seismic Array Test",
        "sensor_type": "SEISMIC",
        "site_id": "SITE-BORDER-NORTH",
        "sector": "Sector-North",
        "status": "ONLINE",
        "health_score": 100.0,
        "reliability_weight": 0.85
    }
    res = client.post("/api/v1/sensors", json=sensor_payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["sensor_id"] == "TEST-SEIS-01"
    assert data["sensor_type"] == "SEISMIC"

    # 2. Record telemetry
    tel_payload = {
        "sensor_id": "TEST-SEIS-01",
        "battery_pct": 92.5,
        "temperature_c": 21.0,
        "status": "ONLINE",
        "reading_value": 4.8,
        "reading_unit": "Hz"
    }
    tel_res = client.post("/api/v1/sensors/TEST-SEIS-01/telemetry", json=tel_payload, headers=auth_headers)
    assert tel_res.status_code == 200
    tel_data = tel_res.json()
    assert tel_data["reading_value"] == 4.8

    # 3. Verify health & status update
    get_res = client.get("/api/v1/sensors/TEST-SEIS-01", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.json()["battery_pct"] == 92.5

def test_bayesian_multi_sensor_fusion_consensus(client, auth_headers):
    # Fuse Radar, Optical and Seismic observations agreeing on PERSON_INTRUSION
    fusion_request = {
        "site_id": "SITE-BORDER-NORTH",
        "sector": "Sector-North",
        "observations": [
            {
                "sensor_id": "RAD-01",
                "sensor_type": "RADAR",
                "detection": "PERSON_INTRUSION",
                "confidence": 0.90,
                "timestamp": datetime.utcnow().isoformat(),
                "location": {"lat": 31.6240, "lng": 74.8720}
            },
            {
                "sensor_id": "CAM-001",
                "sensor_type": "CAMERA",
                "detection": "PERSON_INTRUSION",
                "confidence": 0.85,
                "timestamp": datetime.utcnow().isoformat(),
                "location": {"lat": 31.6242, "lng": 74.8722}
            }
        ]
    }
    res = client.post("/api/v1/sensors/fusion/correlate", json=fusion_request, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["fused_event_type"] == "PERSON_INTRUSION"
    assert data["confidence"] > 0.85
    assert data["conflict_status"] == "NONE"
    assert "bayesian_math" in data["confidence_explanation_json"]

def test_bayesian_sensor_conflict_detection(client, auth_headers):
    # Test contradictory observations: Camera reports PERSON, but Radar/Thermal report CLEAR / NO_TARGET
    conflict_request = {
        "site_id": "SITE-BORDER-NORTH",
        "sector": "Sector-North",
        "observations": [
            {
                "sensor_id": "CAM-001",
                "sensor_type": "CAMERA",
                "detection": "PERSON_INTRUSION",
                "confidence": 0.78,
                "timestamp": datetime.utcnow().isoformat()
            },
            {
                "sensor_id": "RAD-01",
                "sensor_type": "RADAR",
                "detection": "NO_TARGET",
                "confidence": 0.10,
                "timestamp": datetime.utcnow().isoformat()
            }
        ]
    }
    res = client.post("/api/v1/sensors/fusion/correlate", json=conflict_request, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["conflict_status"] == "CONFLICTING_SENSORS"

