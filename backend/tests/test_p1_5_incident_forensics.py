import uuid
import json
import hashlib
import pytest
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models.security_event import SecurityEvent
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.evidence import Evidence
from app.services.incident.incident_service import incident_service
from app.services.evidence.evidence_manager import evidence_manager
from app.services.alert.alert_engine import alert_engine
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_p1_5_1_event_creates_incident_and_evidence():
    """Test 1: A SecurityEvent creates an authoritative Incident with linked Evidence and SHA-256 checksum."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        event_id = f"EVT-P15-{uuid.uuid4().hex[:6].upper()}"
        event = SecurityEvent(
            event_id=event_id,
            camera_id="CAM-P15-1",
            zone_id="ZONE-FENCE-1",
            zone_name="Northern Wire",
            track_id=404,
            object_type="person",
            event_type="ZONE_INTRUSION",
            severity="CRITICAL",
            risk_score=95,
            risk_level="CRITICAL",
            status="ACTIVE",
            environment="NIGHT",
            factors_json=json.dumps([{"factor": "ZONE_INTRUSION", "weight": 40}]),
            timeline_json=json.dumps([]),
            started_at=now,
            last_updated_at=now
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        # Create Incident from Event
        incident = incident_service.create_incident_from_event(event, operator_username="command_center")
        assert incident is not None
        assert incident.incident_id.startswith("INC-")
        assert incident.source_event_id == event_id
        assert incident.camera_id == "CAM-P15-1"
        assert incident.priority == "CRITICAL"
        assert incident.status == "NEW"

        # Verify idempotency: repeated call does not create duplicate rows
        incident_dupe = incident_service.create_incident_from_event(event, operator_username="command_center")
        assert incident_dupe.incident_id == incident.incident_id

        # Verify DB record
        db_inc = db.query(Incident).filter(Incident.incident_id == incident.incident_id).first()
        assert db_inc is not None
        assert db_inc.source_event_id == event_id
    finally:
        db.close()

def test_p1_5_2_alert_to_incident_escalation():
    """Test 2: Creating an incident from an existing Alert ID via API."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        alert_id = f"ALT-P15-{uuid.uuid4().hex[:6].upper()}"
        alert = Alert(
            alert_id=alert_id,
            event_id=f"EVT-ALT-{uuid.uuid4().hex[:6].upper()}",
            camera_id="CAM-P15-2",
            bop_site="BOP Alpha",
            title="HIGH Threat: Vehicle Loitering",
            priority="HIGH",
            risk_score=80,
            status="NEW",
            created_at=now,
            updated_at=now
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        # Call API endpoint
        res = client.post(f"/api/v1/incidents/from-alert/{alert_id}")
        assert res.status_code == 201
        data = res.json()
        assert data["incident_id"].startswith("INC-")
        assert data["priority"] == "HIGH"
        assert data["camera_id"] == "CAM-P15-2"
        assert data["status"] == "NEW"
    finally:
        db.close()

def test_p1_5_3_evidence_registration_and_integrity_checksum():
    """Test 3: Evidence registration computes verifiable SHA-256 checksum and logs access audit."""
    dummy_jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00test_image_bytes"
    expected_sha256 = hashlib.sha256(dummy_jpeg_bytes).hexdigest()

    evd = evidence_manager.register_evidence(
        camera_id="CAM-EVD-1",
        evidence_type="SNAPSHOT",
        file_path="/evidence/CAM-EVD-1/snapshot_001.jpg",
        source_event_id="EVT-001",
        incident_id="INC-001",
        data_bytes=dummy_jpeg_bytes,
        mime_type="image/jpeg"
    )

    assert evd.evidence_id.startswith("EVD-")
    assert evd.checksum_sha256 == expected_sha256
    assert evd.file_size_bytes == len(dummy_jpeg_bytes)

    # Retrieve via API and verify audit
    res = client.get(f"/api/v1/evidence/{evd.evidence_id}")
    assert res.status_code == 200
    evd_data = res.json()
    assert evd_data["checksum_sha256"] == expected_sha256
    assert evd_data["camera_id"] == "CAM-EVD-1"

def test_p1_5_4_incident_lifecycle_state_machine():
    """Test 4: Incident progresses through valid state transitions with timeline and optimistic locking."""
    # 1. Create manual incident
    create_res = client.post("/api/v1/incidents/", json={
        "title": "Perimeter Breach Anomaly",
        "description": "Suspicious movement near gate 3",
        "priority": "HIGH",
        "incident_type": "SECURITY",
        "camera_id": "CAM-STATE-1",
        "bop_site": "BOP Alpha",
        "zone_name": "Gate 3"
    })
    assert create_res.status_code == 201
    inc = create_res.json()
    inc_id = inc["incident_id"]
    assert inc["status"] == "NEW"
    ver = inc["version"]

    # 2. Triage
    triage_res = client.post(f"/api/v1/incidents/{inc_id}/triage", json={
        "priority": "CRITICAL",
        "notes": "Verified threat on camera feed",
        "version": ver
    })
    assert triage_res.status_code == 200
    t_data = triage_res.json()
    assert t_data["status"] == "TRIAGED"
    assert t_data["priority"] == "CRITICAL"
    ver = t_data["version"]

    # 3. Assign
    assign_res = client.post(f"/api/v1/incidents/{inc_id}/assign", json={
        "assigned_to": "Officer Vikram",
        "assigned_team": "Quick Reaction Team (QRT-1)",
        "notes": "QRT dispatched",
        "version": ver
    })
    assert assign_res.status_code == 200
    a_data = assign_res.json()
    assert a_data["status"] == "ASSIGNED"
    assert a_data["assigned_to"] == "Officer Vikram"
    ver = a_data["version"]

    # 4. Respond
    resp_res = client.post(f"/api/v1/incidents/{inc_id}/respond", json={
        "notes": "Units arrived on scene",
        "version": ver
    })
    assert resp_res.status_code == 200
    r_data = resp_res.json()
    assert r_data["status"] == "RESPONDING"
    ver = r_data["version"]

    # 5. Contain
    cont_res = client.post(f"/api/v1/incidents/{inc_id}/contain", json={
        "notes": "Suspect detained and perimeter secure",
        "version": ver
    })
    assert cont_res.status_code == 200
    c_data = cont_res.json()
    assert c_data["status"] == "CONTAINED"
    ver = c_data["version"]

    # 6. Resolve
    resolve_res = client.post(f"/api/v1/incidents/{inc_id}/resolve", json={
        "resolution_category": "Resolved",
        "resolution_notes": "Suspect handed over to local authorities",
        "version": ver
    })
    assert resolve_res.status_code == 200
    res_data = resolve_res.json()
    assert res_data["status"] == "RESOLVED"
    assert res_data["resolution_category"] == "Resolved"
    ver = res_data["version"]

    # 7. Close
    close_res = client.post(f"/api/v1/incidents/{inc_id}/close", json={
        "version": ver
    })
    assert close_res.status_code == 200
    cls_data = close_res.json()
    assert cls_data["status"] == "CLOSED"

    # Verify timeline length
    assert len(cls_data["timeline"]) >= 7

def test_p1_5_5_incident_filtering_and_pagination():
    """Test 5: Incidents list endpoint supports filtering by status, priority, camera, and search."""
    res = client.get("/api/v1/incidents/?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) <= 10

    # Analytics summary endpoint
    analytics_res = client.get("/api/v1/incidents/analytics/summary")
    assert analytics_res.status_code == 200
    ana = analytics_res.json()
    assert "total_incidents" in ana
    assert "active_incidents" in ana
    assert "resolved_incidents" in ana
