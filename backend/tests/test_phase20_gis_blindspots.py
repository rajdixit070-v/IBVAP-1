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

def test_gis_layers_and_camera_fov(client, auth_headers):
    # 1. Fetch layers
    res = client.get("/api/v1/gis/layers", headers=auth_headers)
    assert res.status_code == 200
    layers = res.json()
    assert len(layers) >= 5

    # 2. Toggle layer visibility
    first_layer_id = layers[0]["layer_id"]
    up_res = client.put(f"/api/v1/gis/layers/{first_layer_id}", json={"is_visible": False, "opacity": 0.5}, headers=auth_headers)
    assert up_res.status_code == 200
    assert up_res.json()["is_visible"] is False

    # 3. Geometric FOV Ground Projection
    fov_res = client.get("/api/v1/gis/fov/CAM-001", headers=auth_headers)
    assert fov_res.status_code == 200
    fov_data = fov_res.json()
    assert fov_data["camera_id"] == "CAM-001"
    assert "coordinates" in fov_data["polygon_geojson"]

def test_sector_coverage_and_blind_spots(client, auth_headers):
    # 1. Calculate sector coverage
    cov_res = client.get("/api/v1/gis/coverage/calculate", headers=auth_headers)
    assert cov_res.status_code == 200
    cov_data = cov_res.json()
    assert cov_data["coverage_percentage"] > 0
    assert cov_data["total_area_sqm"] > 0

    # 2. Get detected blind spots
    b_res = client.get("/api/v1/gis/blind-spots", headers=auth_headers)
    assert b_res.status_code == 200
    blind_spots = b_res.json()
    assert len(blind_spots) >= 1
    first_bs = blind_spots[0]
    assert first_bs["risk_score"] > 0
    assert "USE_PTZ" in first_bs["recommendations_json"] or "USE_DRONE" in first_bs["recommendations_json"]

    # 3. Acknowledge blind spot
    ack_res = client.post(f"/api/v1/gis/blind-spots/{first_bs['blind_spot_id']}/acknowledge", headers=auth_headers)
    assert ack_res.status_code == 200
    assert ack_res.json()["is_acknowledged"] is True

def test_terrain_elevation_and_slope_query(client, auth_headers):
    terrain_req = {
        "latitude": 31.6240,
        "longitude": 74.8720
    }
    res = client.post("/api/v1/gis/terrain/query", json=terrain_req, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "AVAILABLE"
    assert data["elevation_m"] is not None
    assert data["terrain_class"] in ["FLAT", "RAVINE", "RIVERBED", "STEEP_SLOPE"]

