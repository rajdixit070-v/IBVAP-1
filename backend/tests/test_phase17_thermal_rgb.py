import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.thermal_fusion_models import CameraPair, ThermalFusionResult
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

def test_camera_pair_crud(client, auth_headers):
    db = SessionLocal()
    db.query(ThermalFusionResult).filter(ThermalFusionResult.pair_id == "PAIR-TEST-01").delete()
    db.query(CameraPair).filter(CameraPair.pair_id == "PAIR-TEST-01").delete()
    db.commit()
    db.close()

    payload = {
        "pair_id": "PAIR-TEST-01",
        "rgb_camera_id": "CAM-001",
        "thermal_camera_id": "CAM-002",
        "site_id": "SITE-BORDER-NORTH",
        "overlap_ratio": 0.85,
        "fusion_mode": "FUSED",
        "status": "ACTIVE"
    }
    res = client.post("/api/v1/thermal/pairs", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["pair_id"] == "PAIR-TEST-01"

    # Update mode to THERMAL_ONLY
    up_res = client.put("/api/v1/thermal/pairs/PAIR-TEST-01", json={"fusion_mode": "THERMAL_ONLY"}, headers=auth_headers)
    assert up_res.status_code == 200
    assert up_res.json()["fusion_mode"] == "THERMAL_ONLY"

def test_thermal_rgb_homography_and_heat_anomaly_fusion(client, auth_headers):
    req = {
        "pair_id": "PAIR-TEST-01",
        "lighting_condition": "NIGHT",
        "rgb_detections": [
            {"class": "person", "confidence": 0.40, "bbox": [0.20, 0.25, 0.15, 0.30]}
        ],
        "thermal_detections": [
            {"class": "person", "confidence": 0.95, "bbox": [0.21, 0.26, 0.14, 0.29], "temp_c": 37.2},
            {"class": "heat_anomaly", "confidence": 0.88, "bbox": [0.22, 0.30, 0.05, 0.05], "temp_c": 44.5}
        ]
    }
    res = client.post("/api/v1/thermal/fusion/execute", json=req, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["has_heat_anomaly"] is True
    assert data["fused_confidence"] > 0.80
    assert data["lighting_condition"] == "NIGHT"

