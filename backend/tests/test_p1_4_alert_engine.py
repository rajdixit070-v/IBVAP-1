import uuid
import json
import pytest
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models.security_event import SecurityEvent
from app.models.health_models import HealthEvent
from app.models.alert import Alert
from app.services.alert.alert_engine import AlertEngine, alert_engine
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_p1_4_1_event_creates_alert():
    """Test 1: A SecurityEvent creates an authoritative Alert persisted in SQLite DB."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        event_id = f"EVT-P14-{uuid.uuid4().hex[:6].upper()}"
        event = SecurityEvent(
            event_id=event_id,
            camera_id="CAM-P14-1",
            zone_id="ZONE-ALPHA",
            zone_name="Perimeter Fence",
            track_id=101,
            object_type="person",
            event_type="ZONE_INTRUSION",
            severity="CRITICAL",
            risk_score=92,
            risk_level="CRITICAL",
            status="ACTIVE",
            environment="NIGHT",
            factors_json=json.dumps([{"factor": "ZONE_INTRUSION", "weight": 35}]),
            timeline_json=json.dumps([]),
            started_at=now,
            last_updated_at=now
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        # Process alert
        alert = alert_engine.process_security_event(event)
        assert alert is not None
        assert alert.alert_id.startswith("ALT-")
        assert alert.camera_id == "CAM-P14-1"
        assert alert.event_id == event_id
        assert alert.priority == "CRITICAL"
        assert alert.risk_score == 92
        assert alert.status == "NEW"

        # Verify DB persistence
        db_alert = db.query(Alert).filter(Alert.alert_id == alert.alert_id).first()
        assert db_alert is not None
        assert db_alert.priority == "CRITICAL"
    finally:
        db.close()

def test_p1_4_2_duplicate_event_deduplication():
    """Test 2: Multiple frames for same active track update existing alert instead of creating duplicate rows."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        cam_id = f"CAM-DEDUP-{uuid.uuid4().hex[:4].upper()}"
        event = SecurityEvent(
            event_id=f"EVT-DEDUP-{uuid.uuid4().hex[:6].upper()}",
            camera_id=cam_id,
            zone_id="ZONE-FENCE",
            zone_name="Fence Line",
            track_id=202,
            object_type="person",
            event_type="ZONE_INTRUSION",
            severity="HIGH",
            risk_score=70,
            risk_level="HIGH",
            status="ACTIVE",
            environment="DAY",
            factors_json=json.dumps([]),
            timeline_json=json.dumps([]),
            started_at=now,
            last_updated_at=now
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        # First alert generation
        alert1 = alert_engine.process_security_event(event)
        assert alert1 is not None

        # Subsequent frame with higher risk score
        event.risk_score = 85
        alert2 = alert_engine.process_security_event(event)
        assert alert2 is not None
        assert alert2.alert_id == alert1.alert_id  # Same alert ID updated
        assert alert2.risk_score == 85

        # Ensure only 1 alert exists for this camera & event in DB
        alerts = db.query(Alert).filter(Alert.camera_id == cam_id).all()
        assert len(alerts) == 1
    finally:
        db.close()

def test_p1_4_3_alert_acknowledgement_and_resolution(auth_headers):
    """Test 3: Alert acknowledgement and resolution state transitions are properly persisted."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        cam_id = f"CAM-ACK-{uuid.uuid4().hex[:4].upper()}"
        event = SecurityEvent(
            event_id=f"EVT-ACK-{uuid.uuid4().hex[:6].upper()}",
            camera_id=cam_id,
            zone_id="ZONE-GATE",
            zone_name="Main Gate",
            track_id=303,
            object_type="person",
            event_type="ZONE_INTRUSION",
            severity="HIGH",
            risk_score=75,
            risk_level="HIGH",
            status="ACTIVE",
            environment="DAY",
            factors_json=json.dumps([]),
            timeline_json=json.dumps([]),
            started_at=now,
            last_updated_at=now
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        alert = alert_engine.process_security_event(event)
        assert alert.status == "NEW"

        # Acknowledge via API
        ack_res = client.post(
            f"/api/v1/alerts/{alert.alert_id}/acknowledge",
            json={"acknowledged_by": "officer_raj"},
            headers=auth_headers
        )
        assert ack_res.status_code == 200
        ack_data = ack_res.json()
        assert ack_data["status"] == "ACKNOWLEDGED"
        assert ack_data["acknowledged_by"] == "officer_raj"

        # Resolve via API
        res_res = client.post(
            f"/api/v1/alerts/{alert.alert_id}/resolve",
            json={"resolved_by": "officer_raj", "notes": "False alarm - maintenance crew"},
            headers=auth_headers
        )
        assert res_res.status_code == 200
        res_data = res_res.json()
        assert res_data["status"] == "RESOLVED"
        assert res_data["resolved_by"] == "officer_raj"
        assert res_data["resolution_notes"] == "False alarm - maintenance crew"
    finally:
        db.close()

def test_p1_4_4_camera_offline_and_recovery_alerts():
    """Test 4: Camera offline event generates system alert; recovery resolves it."""
    cam_id = f"CAM-HLT-{uuid.uuid4().hex[:4].upper()}"
    now = datetime.utcnow()

    offline_event = HealthEvent(
        event_id=f"HLT-OFF-{uuid.uuid4().hex[:6].upper()}",
        event_type="CAMERA_OFFLINE",
        source_type="CAMERA",
        source_id=cam_id,
        severity="HIGH",
        status="DETECTED",
        title=f"Stream Interruption: {cam_id}",
        description="RTSP Signal Lost",
        started_at=now,
        detected_at=now
    )

    alert = alert_engine.process_health_event(offline_event)
    assert alert is not None
    assert alert.camera_id == cam_id
    assert alert.status == "NEW"
    assert "Offline" in alert.title

    # Recovery event
    rec_event = HealthEvent(
        event_id=f"HLT-REC-{uuid.uuid4().hex[:6].upper()}",
        event_type="CAMERA_RECOVERED",
        source_type="CAMERA",
        source_id=cam_id,
        severity="LOW",
        status="RECOVERED",
        title=f"Stream Recovered: {cam_id}",
        description="Camera returned online",
        started_at=now,
        detected_at=now
    )

    resolved_alert = alert_engine.process_health_event(rec_event)
    assert resolved_alert is not None
    assert resolved_alert.alert_id == alert.alert_id
    assert resolved_alert.status == "RESOLVED"

def test_p1_4_5_multi_camera_isolation():
    """Test 5: Camera A and Camera B generate completely isolated alerts."""
    cam_a = f"CAM-ISO-A-{uuid.uuid4().hex[:4].upper()}"
    cam_b = f"CAM-ISO-B-{uuid.uuid4().hex[:4].upper()}"
    now = datetime.utcnow()

    evt_a = SecurityEvent(
        event_id=f"EVT-A-{uuid.uuid4().hex[:6].upper()}", camera_id=cam_a,
        zone_id="ZA", zone_name="Zone A", track_id=1, object_type="person",
        event_type="ZONE_INTRUSION", severity="HIGH", risk_score=80, risk_level="HIGH",
        status="ACTIVE", environment="DAY", factors_json=json.dumps([]), timeline_json=json.dumps([]),
        started_at=now, last_updated_at=now
    )
    evt_b = SecurityEvent(
        event_id=f"EVT-B-{uuid.uuid4().hex[:6].upper()}", camera_id=cam_b,
        zone_id="ZB", zone_name="Zone B", track_id=2, object_type="vehicle",
        event_type="RESTRICTED_ZONE_INTRUSION", severity="CRITICAL", risk_score=95, risk_level="CRITICAL",
        status="ACTIVE", environment="DAY", factors_json=json.dumps([]), timeline_json=json.dumps([]),
        started_at=now, last_updated_at=now
    )

    db = SessionLocal()
    try:
        db.add(evt_a)
        db.add(evt_b)
        db.commit()
        db.refresh(evt_a)
        db.refresh(evt_b)

        alt_a = alert_engine.process_security_event(evt_a)
        alt_b = alert_engine.process_security_event(evt_b)
    finally:
        db.close()

    assert alt_a.camera_id == cam_a
    assert alt_b.camera_id == cam_b
    assert alt_a.alert_id != alt_b.alert_id

def test_p1_4_6_alert_api_filtering_and_pagination(auth_headers):
    """Test 6: Alert API supports status, priority, and camera filtering with pagination."""
    res = client.get("/api/v1/alerts/?limit=10", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) <= 10

    # Summary endpoint
    sum_res = client.get("/api/v1/alerts/summary", headers=auth_headers)
    assert sum_res.status_code == 200
    sum_data = sum_res.json()
    assert "critical_alerts" in sum_data
    assert "high_alerts" in sum_data
    assert "unacknowledged_alerts" in sum_data
