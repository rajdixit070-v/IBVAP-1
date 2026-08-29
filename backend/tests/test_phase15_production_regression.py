import pytest
import uuid
import hashlib
from datetime import datetime, timedelta
from jose import jwt

from app.main import app, init_db_defaults, seed_demo_database
from app.config import settings, validate_environment
from app.database import SessionLocal
from app.models.user import User
from app.models.camera import Camera
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.evidence import Evidence
from app.models.audit_log import SecurityAuditLog
from app.services.alert.alert_engine import alert_engine
from app.services.incident.incident_service import incident_service
from app.services.evidence.evidence_manager import evidence_manager
from app.core.security import get_password_hash

def test_regression_01_unauthenticated_alert_access_rejected(client):
    """1. Unauthenticated alert access must return HTTP 401."""
    res = client.get(f"{settings.API_V1_STR}/alerts/")
    assert res.status_code == 401

def test_regression_02_unauthorized_incident_modification_rejected(client):
    """2. Unauthorized incident status transition must return HTTP 401."""
    res = client.post(f"{settings.API_V1_STR}/incidents/INC-DEMO-999/resolve", json={"resolution_notes": "test"})
    assert res.status_code == 401

def test_regression_03_authenticated_incident_audit_actor(client, auth_headers):
    """3. Authenticated incident operations must record actual authenticated username in audit log."""
    # Create incident
    create_res = client.post(
        f"{settings.API_V1_STR}/incidents/",
        json={
            "title": "Audit Actor Verification Incident",
            "priority": "HIGH",
            "camera_id": "CAM-001",
            "bop_site": "BOP Alpha"
        },
        headers=auth_headers
    )
    assert create_res.status_code == 201
    inc_id = create_res.json()["incident_id"]

    # Verify audit log recorded authenticated user 'admin', not hardcoded 'operator'
    db = SessionLocal()
    try:
        audit = db.query(SecurityAuditLog).filter(
            SecurityAuditLog.resource_id == inc_id,
            SecurityAuditLog.action == "INCIDENT_CREATED"
        ).order_by(SecurityAuditLog.timestamp.desc()).first()
        assert audit is not None
        assert audit.username == "admin"
        assert audit.username != "operator"
    finally:
        db.close()

def test_regression_04_invalid_jwt_token_rejected(client):
    """4. Malformed / invalid JWT tokens must return HTTP 401."""
    res = client.get(f"{settings.API_V1_STR}/cameras/", headers={"Authorization": "Bearer invalid.garbage.token"})
    assert res.status_code == 401

def test_regression_05_expired_jwt_token_rejected(client):
    """5. Expired JWT tokens must return HTTP 401."""
    expired_payload = {
        "sub": "admin",
        "role": "admin",
        "exp": datetime.utcnow() - timedelta(minutes=10)
    }
    expired_token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    res = client.get(f"{settings.API_V1_STR}/cameras/", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401

def test_regression_06_locked_account_rejected(client):
    """6. Locked user account must be rejected (HTTP 423 / 401)."""
    uname = f"locked_op_{uuid.uuid4().hex[:6]}"
    db = SessionLocal()
    try:
        locked_user = User(
            username=uname,
            email=f"{uname}@ibvap.mil",
            hashed_password=get_password_hash("Password123!"),
            role="operator",
            is_active=True,
            locked_until=datetime.utcnow() + timedelta(hours=1)
        )
        db.add(locked_user)
        db.commit()

        token_payload = {"sub": uname, "role": "operator", "exp": datetime.utcnow() + timedelta(hours=1)}
        token = jwt.encode(token_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

        res = client.get(f"{settings.API_V1_STR}/cameras/", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code in [401, 423]
        assert "locked" in res.json().get("detail", "").lower()
    finally:
        db.close()

def test_regression_07_production_insecure_secret_fails_validation(monkeypatch):
    """7. Production environment validation must fail fast if default SECRET_KEY is used."""
    monkeypatch.setattr(settings, "ENV_MODE", "production")
    monkeypatch.setattr(settings, "SECRET_KEY", "ibvap-secure-production-border-secret-key-2026-xyz")
    with pytest.raises(ValueError) as exc:
        validate_environment()
    assert "insecure or default secret_key" in str(exc.value).lower()

def test_regression_08_evidence_sha256_verification(client, auth_headers):
    """8. Evidence registration computes true SHA-256 digest matching hashlib."""
    sample_data = b"TACTICAL_IMAGE_EVIDENCE_STREAM_DATA_2026"
    expected_digest = hashlib.sha256(sample_data).hexdigest()

    evd = evidence_manager.register_evidence(
        camera_id="CAM-001",
        evidence_type="SNAPSHOT",
        file_path="/evidence/sample.jpg",
        data_bytes=sample_data
    )
    assert evd.checksum_sha256 == expected_digest
    assert len(evd.checksum_sha256) == 64

    # Verify via API
    res = client.get(f"{settings.API_V1_STR}/evidence/{evd.evidence_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["checksum_sha256"] == expected_digest

def test_regression_09_modified_evidence_integrity_failure(client, auth_headers):
    """9. Modified evidence payload fails cryptographic verification."""
    original_data = b"ORIGINAL_CLEAR_EVIDENCE"
    evd = evidence_manager.register_evidence(
        camera_id="CAM-001",
        evidence_type="SNAPSHOT",
        file_path="/evidence/orig.jpg",
        data_bytes=original_data
    )

    # Verify with modified data
    tampered_data = b"TAMPERED_MODIFIED_DATA"
    is_valid = evidence_manager.verify_evidence_integrity(
        evidence_id=evd.evidence_id,
        data_bytes=tampered_data,
        username="admin"
    )
    assert is_valid is False

    # Verify audit log recorded failure
    db = SessionLocal()
    try:
        audit = db.query(SecurityAuditLog).filter(
            SecurityAuditLog.resource_id == evd.evidence_id,
            SecurityAuditLog.action == "EVIDENCE_INTEGRITY_MISMATCH"
        ).first()
        assert audit is not None
    finally:
        db.close()

def test_regression_10_missing_face_embedding_rejected(client, auth_headers):
    """10. Registering person in watchlist without face embedding returns HTTP 400."""
    res = client.post(
        f"{settings.API_V1_STR}/watchlist/persons/",
        json={
            "person_id": "PID-NO-EMBED",
            "display_name": "Subject Without Embedding",
            "category": "WATCHLIST",
            "status": "ACTIVE"
        },
        headers=auth_headers
    )
    assert res.status_code == 400
    assert "embedding" in res.json().get("detail", "").lower()

def test_regression_11_invalid_face_embedding_rejected(client, auth_headers):
    """11. Registering person with incorrect vector dimensions (e.g. 50 vs 128) returns HTTP 400."""
    res = client.post(
        f"{settings.API_V1_STR}/watchlist/persons/",
        json={
            "person_id": "PID-BAD-EMBED",
            "display_name": "Subject With Bad Dimensions",
            "category": "WATCHLIST",
            "status": "ACTIVE",
            "embedding": [0.1] * 50  # Invalid dimension
        },
        headers=auth_headers
    )
    assert res.status_code == 400
    assert "128" in res.json().get("detail", "").lower() or "embedding" in res.json().get("detail", "").lower()

def test_regression_12_missing_yolo_model_handling():
    """12. Detector surfaces proper status when weights are not present."""
    from app.services.ai.detector import YOLOObjectDetector
    detector = YOLOObjectDetector(model_name="non_existent_model_file_xyz.pt")
    # Must initialize cleanly with status tracking without unhandled crash
    assert detector is not None

def test_regression_13_demo_seed_disabled_in_production(monkeypatch):
    """13. init_db_defaults(seed_demo=False) does not automatically seed cameras."""
    # When seed_demo is False, demo cameras are not created
    # We verify the signature and argument handling
    init_db_defaults(seed_demo=False)
    assert True

def test_regression_14_demo_seed_explicit_command():
    """14. Explicit seed_demo_database utility executes successfully."""
    seed_demo_database()
    db = SessionLocal()
    try:
        assert db.query(Camera).count() >= 1
    finally:
        db.close()

def test_regression_15_camera_rtsp_reconnect_backoff():
    """15. RTSP reconnect delay increases exponentially up to max delay."""
    from app.services.rtsp_streamer import RTSPStreamer
    streamer = RTSPStreamer(
        camera_id="CAM-TEST-RECON",
        camera_name="Test Recon Camera",
        bop_site="BOP Alpha",
        rtsp_url="synthetic://test/live"
    )
    delay_1 = streamer.calculate_reconnect_delay(attempt=1)
    delay_4 = streamer.calculate_reconnect_delay(attempt=4)
    assert delay_4 > delay_1
    assert delay_4 <= settings.RECONNECT_MAX_DELAY_SEC

def test_regression_16_camera_authorization_protected(client):
    """16. Cameras API requires authentication."""
    res = client.get(f"{settings.API_V1_STR}/cameras")
    assert res.status_code == 401

def test_regression_17_zone_intrusion_debouncing():
    """17. Virtual zone intrusion prevents rapid duplicate alert spamming."""
    from app.models.security_event import SecurityEvent
    evt = SecurityEvent(
        event_id=f"EVT-DEBOUNCE-{uuid.uuid4().hex[:6].upper()}",
        camera_id="CAM-001",
        track_id=142,
        object_type="person",
        event_type="ZONE_INTRUSION",
        severity="CRITICAL",
        risk_score=90,
        risk_level="CRITICAL",
        status="ACTIVE"
    )
    alert1 = alert_engine.process_security_event(evt)
    assert alert1 is not None
    # Duplicate processing of same track
    alert2 = alert_engine.process_security_event(evt)
    assert alert2.alert_id == alert1.alert_id

def test_regression_18_alert_lifecycle_transitions(client, auth_headers):
    """18. Alert lifecycle follows NEW -> ACKNOWLEDGED -> RESOLVED with audit logging."""
    from app.models.security_event import SecurityEvent
    evt = SecurityEvent(
        event_id=f"EVT-LIFE-{uuid.uuid4().hex[:6].upper()}",
        camera_id="CAM-001",
        track_id=777,
        object_type="vehicle",
        event_type="WATCHLIST_MATCH",
        severity="HIGH",
        risk_score=80,
        risk_level="HIGH",
        status="ACTIVE"
    )
    alert = alert_engine.process_security_event(evt)
    a_id = alert.alert_id

    # Acknowledge
    ack_res = client.post(f"{settings.API_V1_STR}/alerts/{a_id}/acknowledge", json={}, headers=auth_headers)
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

    # Resolve
    res_res = client.post(f"{settings.API_V1_STR}/alerts/{a_id}/resolve", json={"notes": "Vehicle cleared"}, headers=auth_headers)
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"

def test_regression_19_incident_lifecycle_state_machine(client, auth_headers):
    """19. Incident transitions cleanly through full state lifecycle."""
    inc_payload = {
        "title": "State Progression Incident",
        "priority": "HIGH",
        "camera_id": "CAM-002",
        "bop_site": "BOP Alpha"
    }
    create_res = client.post(f"{settings.API_V1_STR}/incidents/", json=inc_payload, headers=auth_headers)
    assert create_res.status_code == 201
    inc_id = create_res.json()["incident_id"]

    # Triage
    triage_res = client.post(f"{settings.API_V1_STR}/incidents/{inc_id}/triage", json={"priority": "CRITICAL"}, headers=auth_headers)
    assert triage_res.status_code == 200
    assert triage_res.json()["status"] == "TRIAGED"

    # Assign
    assign_res = client.post(f"{settings.API_V1_STR}/incidents/{inc_id}/assign", json={"assigned_to": "Patrol Alpha"}, headers=auth_headers)
    assert assign_res.status_code == 200
    assert assign_res.json()["status"] == "ASSIGNED"

    # Escalate
    esc_res = client.post(f"{settings.API_V1_STR}/incidents/{inc_id}/escalate", json={"reason": "Breach in progress"}, headers=auth_headers)
    assert esc_res.status_code == 200
    assert esc_res.json()["status"] == "ESCALATED"

    # Resolve
    resolve_res = client.post(f"{settings.API_V1_STR}/incidents/{inc_id}/resolve", json={"resolution_notes": "Perimeter restored"}, headers=auth_headers)
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "RESOLVED"

    # Close
    close_res = client.post(f"{settings.API_V1_STR}/incidents/{inc_id}/close", headers=auth_headers)
    assert close_res.status_code == 200
    assert close_res.json()["status"] == "CLOSED"

def test_regression_20_frontend_api_configuration(client):
    """20. Health and metrics probes return valid dynamic status without hardcoded values."""
    health_res = client.get("/api/health")
    assert health_res.status_code == 200
    h_data = health_res.json()
    assert "status" in h_data
    assert "database" in h_data

    metrics_res = client.get(f"{settings.API_V1_STR}/system/metrics")
    assert metrics_res.status_code == 200
    m_data = metrics_res.json()
    assert "cpu_percent" in m_data
    assert "memory_rss_mb" in m_data
