import pytest
import uuid
import json
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.evidence import Evidence
from app.models.security_event import SecurityEvent
from app.models.audit_log import SecurityAuditLog
from app.services.alert.alert_engine import alert_engine
from app.services.incident.incident_service import incident_service
from app.services.evidence.evidence_manager import evidence_manager

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    yield db
    db.close()

def test_alert_generation_and_deduplication(db_session):
    """Test generating alerts from security events and verifying track-based deduplication."""
    track_id = 999
    cam_id = "CAM-001"
    evt_type = "ZONE_INTRUSION"

    evt1 = SecurityEvent(
        event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
        camera_id=cam_id,
        track_id=track_id,
        object_type="person",
        event_type=evt_type,
        severity="CRITICAL",
        risk_score=85,
        risk_level="CRITICAL",
        status="ACTIVE"
    )

    alert1 = alert_engine.process_security_event(evt1)
    assert alert1 is not None
    assert alert1.priority == "CRITICAL"
    assert alert1.status == "NEW"

    # Second event for same track: should update existing alert rather than duplicating
    evt2 = SecurityEvent(
        event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
        camera_id=cam_id,
        track_id=track_id,
        object_type="person",
        event_type=evt_type,
        severity="CRITICAL",
        risk_score=92,
        risk_level="CRITICAL",
        status="ACTIVE"
    )

    alert2 = alert_engine.process_security_event(evt2)
    assert alert2.alert_id == alert1.alert_id
    assert alert2.risk_score == 92

def test_alert_acknowledgement_api(db_session):
    """Test operator acknowledgement of an alert via REST endpoint."""
    evt = SecurityEvent(
        event_id=f"EVT-ACK-{uuid.uuid4().hex[:6].upper()}",
        camera_id="CAM-002",
        track_id=888,
        object_type="vehicle",
        event_type="WATCHLIST_MATCH",
        severity="HIGH",
        risk_score=75,
        risk_level="HIGH",
        status="ACTIVE"
    )
    alert = alert_engine.process_security_event(evt)
    assert alert is not None

    res = client.post(f"/api/v1/alerts/{alert.alert_id}/acknowledge", json={"acknowledged_by": "duty_officer"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ACKNOWLEDGED"
    assert data["acknowledged_by"] == "duty_officer"

def test_incident_creation_and_list(db_session):
    """Test creating a managed incident and querying it with pagination."""
    payload = {
        "title": "Unauthorized Perimeter Breach",
        "description": "Target climbed outer fence sector 3",
        "priority": "CRITICAL",
        "camera_id": "CAM-001",
        "bop_site": "BOP Alpha",
        "zone_name": "Zero-Line Wire",
        "track_id": 142,
        "risk_score": 95,
        "assigned_to": "Capt. Rajesh Kumar",
        "assigned_unit": "QRT-1"
    }

    res = client.post("/api/v1/incidents/", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["incident_id"].startswith("INC-")
    assert data["priority"] == "CRITICAL"
    assert data["status"] == "NEW"

    # List
    list_res = client.get("/api/v1/incidents/?priority=CRITICAL")
    assert list_res.status_code == 200
    incidents = list_res.json()
    assert any(i["incident_id"] == data["incident_id"] for i in incidents)

def test_incident_state_machine_valid_transitions(db_session):
    """Test controlled incident state machine through full lifecycle."""
    inc = incident_service.create_incident(
        Incident(
            title="State Machine Test Incident",
            camera_id="CAM-003",
            priority="HIGH",
            bop_site="BOP Bravo"
        ),
        operator_username="operator"
    )
    inc_id = inc.incident_id

    # 1. Assign
    res1 = client.post(f"/api/v1/incidents/{inc_id}/assign", json={"assigned_to": "Officer Sharma", "assigned_unit": "Patrol Unit 2"})
    assert res1.status_code == 200
    assert res1.json()["status"] == "ASSIGNED"

    # 2. Escalate
    res2 = client.post(f"/api/v1/incidents/{inc_id}/escalate", json={"reason": "Suspect armed with breaching tools"})
    assert res2.status_code == 200
    assert res2.json()["status"] == "ESCALATED"

    # 3. Resolve
    res3 = client.post(f"/api/v1/incidents/{inc_id}/resolve", json={"resolution_notes": "QRT-2 intercepted subject and secured perimeter."})
    assert res3.status_code == 200
    assert res3.json()["status"] == "RESOLVED"

    # 4. Close
    res4 = client.post(f"/api/v1/incidents/{inc_id}/close")
    assert res4.status_code == 200
    assert res4.json()["status"] == "CLOSED"

def test_incident_state_machine_invalid_transition_rejected(db_session):
    """Test that invalid state transitions are rejected with HTTP 400."""
    inc = incident_service.create_incident(
        Incident(
            title="Invalid Transition Test Incident",
            camera_id="CAM-004",
            priority="LOW"
        ),
        operator_username="operator"
    )
    inc_id = inc.incident_id

    # Try to jump from NEW directly to CLOSED (invalid!)
    res = client.post(f"/api/v1/incidents/{inc_id}/close")
    assert res.status_code == 400

def test_incident_false_alarm_workflow(db_session):
    """Test marking an incident as a FALSE_ALARM with category reason."""
    inc = incident_service.create_incident(
        Incident(
            title="Potential Shadow False Alarm",
            camera_id="CAM-002",
            priority="MEDIUM"
        ),
        operator_username="operator"
    )
    inc_id = inc.incident_id

    res = client.post(f"/api/v1/incidents/{inc_id}/false-alarm", json={
        "false_alarm_reason": "shadow",
        "false_alarm_notes": "Tree shadow sway triggered loitering anomaly"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FALSE_ALARM"
    assert data["false_alarm_reason"] == "shadow"

def test_evidence_integrity_sha256_and_audit(db_session):
    """Test evidence registration, SHA-256 integrity calculation, and access audit."""
    sample_bytes = b"TACTICAL_EVIDENCE_IMAGE_PAYLOAD_2026"
    evd = evidence_manager.register_evidence(
        camera_id="CAM-001",
        evidence_type="SNAPSHOT",
        file_path="/evidence/cam-001-snapshot.jpg",
        data_bytes=sample_bytes
    )

    assert evd.checksum_sha256 is not None
    assert len(evd.checksum_sha256) == 64

    # Query via API
    res = client.get(f"/api/v1/evidence/{evd.evidence_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["checksum_sha256"] == evd.checksum_sha256

    # Verify audit log was created
    audit = db_session.query(SecurityAuditLog).filter(
        SecurityAuditLog.resource_id == evd.evidence_id,
        SecurityAuditLog.action == "EVIDENCE_VIEWED"
    ).first()
    assert audit is not None

def test_incident_analytics_summary_endpoint(db_session):
    """Test operational response analytics endpoint."""
    res = client.get("/api/v1/incidents/analytics/summary")
    assert res.status_code == 200
    data = res.json()
    assert "total_incidents" in data
    assert "false_alarm_rate_percent" in data
    assert "avg_mtta_seconds" in data
    assert "avg_mttr_seconds" in data

def test_notification_inbox_and_mark_read(db_session):
    """Test notification drawer endpoints."""
    res = client.get("/api/v1/notifications/")
    assert res.status_code == 200
    notifications = res.json()
    assert len(notifications) >= 1

    # Mark all read
    read_res = client.put("/api/v1/notifications/read-all")
    assert read_res.status_code == 200
    assert read_res.json()["status"] == "SUCCESS"
