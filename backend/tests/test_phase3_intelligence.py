import pytest
from datetime import datetime, timedelta
from app.services.intelligence.spatial import is_point_in_polygon, get_ground_plane_point_normalized
from app.services.intelligence.behaviour_analyzer import (
    is_direction_forbidden,
    check_loitering,
    check_stationary_vehicle,
    check_rapid_movement,
    check_group_movement
)
from app.services.intelligence.risk_engine import ThreatRiskEngine
from app.services.intelligence.event_manager import SecurityEventManager
from app.services.ai.tracker import STrack

def test_point_in_polygon():
    polygon = [
        {"x": 0.2, "y": 0.2},
        {"x": 0.8, "y": 0.2},
        {"x": 0.8, "y": 0.8},
        {"x": 0.2, "y": 0.8}
    ]
    # Center inside
    assert is_point_in_polygon(0.5, 0.5, polygon) is True
    # Outside left
    assert is_point_in_polygon(0.1, 0.5, polygon) is False
    # Outside top
    assert is_point_in_polygon(0.5, 0.1, polygon) is False

def test_ground_plane_bottom_center():
    bbox = {"x": 100, "y": 200, "width": 50, "height": 100}
    gp = get_ground_plane_point_normalized(bbox, frame_width=1000, frame_height=1000)
    # Bottom center: x = 125/1000 = 0.125, y = 300/1000 = 0.3
    assert gp["x"] == 0.125
    assert gp["y"] == 0.3

def test_direction_rule_matching():
    assert is_direction_forbidden("SOUTH", "SOUTH") is True
    assert is_direction_forbidden("SOUTH_WEST", "SOUTH") is True
    assert is_direction_forbidden("NORTH", "SOUTH") is False
    assert is_direction_forbidden("EAST", "NONE") is False

def test_risk_scoring_explainability():
    engine = ThreatRiskEngine()
    
    # 1. Medium/High breach (Restricted Zone + Night Movement + Forbidden Direction) = 25 + 15 + 15 = 55
    score, level, factors = engine.calculate_risk(
        event_type="ZONE_INTRUSION",
        zone_type="RESTRICTED",
        is_night=True,
        is_forbidden_direction=True,
        confidence=0.95
    )
    assert score == 55
    assert level == "MEDIUM"
    assert len(factors) == 3
    factor_names = [f["factor"] for f in factors]
    assert "RESTRICTED_ZONE_INTRUSION" in factor_names
    assert "NIGHT_MOVEMENT" in factor_names
    assert "FORBIDDEN_DIRECTION" in factor_names

    # 2. Critical breach (High Security + Night + Forbidden + Rapid + Group) = 35 + 15 + 15 + 10 + 10 = 85
    crit_score, crit_level, crit_factors = engine.calculate_risk(
        event_type="ZONE_INTRUSION",
        zone_type="HIGH_SECURITY",
        is_night=True,
        is_forbidden_direction=True,
        is_rapid_movement=True,
        is_group=True,
        confidence=0.95
    )
    assert crit_score == 85
    assert crit_level == "CRITICAL"
    assert len(crit_factors) == 5

def test_loitering_behaviour():
    det = {
        "class_name": "person",
        "category": "person",
        "confidence": 0.92,
        "bbox": {"x": 100, "y": 100, "width": 50, "height": 100},
        "timestamp": datetime.utcnow()
    }
    track = STrack("CAM-001", det)
    entry_time = datetime.utcnow() - timedelta(seconds=15)
    
    # Prolonged presence (15s) with stationary center
    assert check_loitering(track, entry_time, min_duration_sec=10.0) is True

def test_stationary_vehicle_behaviour():
    det = {
        "class_name": "car",
        "category": "vehicle",
        "confidence": 0.90,
        "bbox": {"x": 200, "y": 200, "width": 100, "height": 60},
        "timestamp": datetime.utcnow()
    }
    track = STrack("CAM-001", det)
    track.speed = 1.0 # Stopped
    entry_time = datetime.utcnow() - timedelta(seconds=20)
    
    assert check_stationary_vehicle(track, entry_time, min_duration_sec=15.0) is True

def test_group_movement():
    det1 = {
        "class_name": "person", "category": "person", "confidence": 0.9,
        "bbox": {"x": 100, "y": 100, "width": 40, "height": 80}, "timestamp": datetime.utcnow()
    }
    det2 = {
        "class_name": "person", "category": "person", "confidence": 0.9,
        "bbox": {"x": 130, "y": 105, "width": 40, "height": 80}, "timestamp": datetime.utcnow()
    }
    t1 = STrack("CAM-001", det1)
    t2 = STrack("CAM-001", det2)
    t1.frame_count = 5
    t2.frame_count = 5
    t1.direction = "SOUTH"
    t2.direction = "SOUTH"

    groups = check_group_movement([t1, t2], max_distance_px=100.0)
    assert len(groups) == 1
    assert t1.track_id in groups[0]
    assert t2.track_id in groups[0]

def test_zones_api_crud(client, admin_token_headers):
    # 1. Create Zone
    zone_payload = {
        "camera_id": "CAM-001",
        "name": "North Fence Line Test",
        "zone_type": "RESTRICTED",
        "polygon": [
            {"x": 0.1, "y": 0.1},
            {"x": 0.9, "y": 0.1},
            {"x": 0.9, "y": 0.9},
            {"x": 0.1, "y": 0.9}
        ],
        "monitored_classes": ["person", "vehicle"],
        "direction_rule": "SOUTH",
        "severity": "CRITICAL",
        "enabled": True
    }
    res_c = client.post("/api/v1/zones/", json=zone_payload, headers=admin_token_headers)
    assert res_c.status_code == 201
    zone_data = res_c.json()
    zone_id = zone_data["zone_id"]
    assert zone_data["name"] == "North Fence Line Test"

    # 2. Get Zones
    res_g = client.get(f"/api/v1/zones/?camera_id=CAM-001", headers=admin_token_headers)
    assert res_g.status_code == 200
    assert any(z["zone_id"] == zone_id for z in res_g.json())

    # 3. Update Zone
    res_u = client.put(f"/api/v1/zones/{zone_id}", json={"name": "Updated North Perimeter"}, headers=admin_token_headers)
    assert res_u.status_code == 200
    assert res_u.json()["name"] == "Updated North Perimeter"

    # 4. Delete Zone
    res_d = client.delete(f"/api/v1/zones/{zone_id}", headers=admin_token_headers)
    assert res_d.status_code == 200

def test_events_api(client, admin_token_headers):
    # Dispatch a test event via EventManager
    mgr = SecurityEventManager()
    evt = mgr.dispatch_security_event(
        camera_id="CAM-001",
        track_id=142,
        object_type="person",
        event_type="ZONE_INTRUSION",
        zone_id="ZONE-ALPHA",
        zone_name="Restricted Area",
        is_night=True,
        confidence=0.94,
        timeline_message="Person #142 breached restricted wire"
    )
    assert evt is not None

    # Query events list
    res = client.get("/api/v1/events/", headers=admin_token_headers)
    assert res.status_code == 200
    assert len(res.json()) > 0

    # Query summary
    res_s = client.get("/api/v1/events/summary", headers=admin_token_headers)
    assert res_s.status_code == 200
    assert "total_active" in res_s.json()

    # Update event status
    res_st = client.put(
        f"/api/v1/events/{evt.event_id}/status",
        json={"status": "ACKNOWLEDGED", "comment": "Dispatched patrol unit"},
        headers=admin_token_headers
    )
    assert res_st.status_code == 200
    assert res_st.json()["status"] == "ACKNOWLEDGED"

def test_risk_config_api(client, admin_token_headers):
    res = client.get("/api/v1/risk-config/", headers=admin_token_headers)
    assert res.status_code == 200
    assert "weight_restricted_zone" in res.json()

    res_u = client.put(
        "/api/v1/risk-config/",
        json={"weight_restricted_zone": 30, "night_start_hour": 19},
        headers=admin_token_headers
    )
    assert res_u.status_code == 200
    assert res_u.json()["weight_restricted_zone"] == 30
    assert res_u.json()["night_start_hour"] == 19
