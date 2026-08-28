import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.camera import Camera
from app.models.federation_models import Site, BOP, SiteUserScope
from app.models.enterprise_security_models import (
    SecurityThreatEvent,
    EdgeNodeCredential,
    BlockedIPEntry,
    SessionTokenBlacklist
)
from app.services.security.password_policy import PasswordPolicyService
from app.services.security.auth_rate_limiter import AuthRateLimiter
from app.services.security.ssrf_validator import SSRFValidator
from app.services.security.input_sanitizer import InputSanitizerService
from app.services.security.edge_auth_service import EdgeAuthService
from app.services.security.security_correlation_engine import SecurityCorrelationEngine
from app.core.security import create_access_token, get_password_hash, mask_rtsp_url

client = TestClient(app)

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture(autouse=True)
def clean_security_state():
    """Resets in-memory state before each test."""
    AuthRateLimiter._ip_request_history.clear()
    AuthRateLimiter._failed_login_history.clear()
    yield

def test_password_complexity_and_policy():
    """Section 4 & 5: Test enterprise password policy rules and score calculation."""
    # Weak password
    valid, errors, score = PasswordPolicyService.validate_password("simple", "operator1")
    assert valid is False
    assert len(errors) > 0
    assert score < 50

    # Password containing username
    valid, errors, score = PasswordPolicyService.validate_password("Operator1#Strong", "operator1")
    assert valid is False
    assert any("username" in e for e in errors)

    # Strong compliant password
    valid, errors, score = PasswordPolicyService.validate_password("BorderSecure@2026!", "admin")
    assert valid is True
    assert len(errors) == 0
    assert score >= 80

def test_login_rate_limiting_and_account_lockout(db):
    """Section 6 & 7: Test brute-force protection and temporary account lockout."""
    username = "target_test_user"
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            email="target@ibvap.mil",
            hashed_password=get_password_hash("CorrectPassword@123"),
            role="operator",
            is_active=True
        )
        db.add(user)
        db.commit()

    # Simulate 5 consecutive failed logins
    for i in range(1, 6):
        is_locked, attempts, locked_until = AuthRateLimiter.record_failed_login(
            username=username,
            ip_address="198.51.100.25",
            user_agent="AttackBot/1.0",
            db=db
        )
        if i < 5:
            assert is_locked is False
            assert attempts == i
        else:
            assert is_locked is True
            assert attempts == 5
            assert locked_until is not None

    # Check threat event generated in database (latest on lockout)
    threat = db.query(SecurityThreatEvent).filter(
        SecurityThreatEvent.username == username,
        SecurityThreatEvent.event_type == "BRUTE_FORCE_ATTEMPT"
    ).order_by(SecurityThreatEvent.id.desc()).first()
    assert threat is not None
    assert threat.severity == "CRITICAL"

def test_account_unlock_administrative_endpoint(db):
    """Section 7: Test administrative account unlock."""
    username = "locked_operator"
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            email="locked@ibvap.mil",
            hashed_password=get_password_hash("CorrectPass#2026"),
            role="operator",
            failed_login_attempts=5,
            locked_until=datetime.utcnow() + timedelta(minutes=15),
            is_active=True
        )
        db.add(user)
        db.commit()

    token = create_access_token("admin", role="admin")
    res = client.post(
        f"/api/v1/security/accounts/{username}/unlock",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200

    db.refresh(user)
    assert user.failed_login_attempts == 0
    assert user.locked_until is None

def test_session_token_logout_blacklist(db):
    """Section 9 & 10: Test token revocation on logout."""
    user = db.query(User).filter(User.username == "analyst_test").first()
    if not user:
        user = User(
            username="analyst_test",
            email="analyst@ibvap.mil",
            hashed_password=get_password_hash("Pass@1234"),
            role="analyst",
            is_active=True
        )
        db.add(user)
        db.commit()

    token = create_access_token("analyst_test", role="analyst")

    # Logout
    res = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200

    # Subsequent request using the revoked token must be rejected with 401
    res2 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res2.status_code == 401
    assert "revoked" in res2.json()["detail"].lower()

def test_idor_camera_access_rejection(db):
    """Section 12 & 13: Test IDOR guard rejects cross-site camera access."""
    # Camera in SITE-BORDER-SOUTH
    cam = db.query(Camera).filter(Camera.camera_id == "CAM-SOUTH-901").first()
    if not cam:
        cam = Camera(
            camera_id="CAM-SOUTH-901",
            camera_name="South Perimeter Sector 9",
            bop_site="BOP South 1",
            sector="South Sector",
            rtsp_url="rtsp://192.168.10.90:554/stream",
            site_id="SITE-BORDER-SOUTH",
            bop_id="BOP-SOUTH-1"
        )
        db.add(cam)
        db.commit()

    # User scoped ONLY to SITE-BORDER-NORTH
    scoped_user = db.query(User).filter(User.username == "operator_north_scope").first()
    if not scoped_user:
        scoped_user = User(
            username="operator_north_scope",
            email="north_scope@ibvap.mil",
            hashed_password=get_password_hash("Pass@1234"),
            role="operator",
            is_active=True
        )
        db.add(scoped_user)
        db.commit()

    scope = db.query(SiteUserScope).filter(
        SiteUserScope.username == "operator_north_scope",
        SiteUserScope.scope_id == "SITE-BORDER-NORTH"
    ).first()
    if not scope:
        scope = SiteUserScope(
            username="operator_north_scope",
            scope_type="SITE",
            scope_id="SITE-BORDER-NORTH",
            role="operator"
        )
        db.add(scope)
        db.commit()

    token = create_access_token("operator_north_scope", role="operator")

    # Attempt to access camera in SITE-BORDER-SOUTH -> Must return 403 Forbidden
    res = client.get(f"/api/v1/cameras/{cam.camera_id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
    assert "idor guard" in res.json()["detail"].lower()

def test_privilege_escalation_protection(db):
    """Section 14 & 15: Non-admin users cannot perform administrative actions."""
    user = db.query(User).filter(User.username == "regular_operator").first()
    if not user:
        user = User(
            username="regular_operator",
            email="reg_op@ibvap.mil",
            hashed_password=get_password_hash("Pass@1234"),
            role="operator",
            is_active=True
        )
        db.add(user)
        db.commit()

    operator_token = create_access_token("regular_operator", role="operator")

    # Attempt to access admin-only threat management endpoint
    res = client.post(
        "/api/v1/security/threats/correlate",
        headers={"Authorization": f"Bearer {operator_token}"}
    )
    assert res.status_code == 403
    assert "admin privileges required" in res.json()["detail"].lower()

def test_ssrf_destination_validation():
    """Section 31 & 32: Test SSRF protection blocks cloud metadata and forbidden ports."""
    # Cloud metadata IMDS (AWS / GCP)
    is_valid, err = SSRFValidator.validate_destination_url("http://169.254.169.254/latest/meta-data")
    assert is_valid is False
    assert "forbidden" in err.lower()

    # Disallowed protocol
    is_valid, err = SSRFValidator.validate_destination_url("file:///etc/passwd")
    assert is_valid is False

    # Blocked administrative port
    is_valid, err = SSRFValidator.validate_destination_url("rtsp://192.168.1.50:22/stream")
    assert is_valid is False
    assert "blocked" in err.lower()

    # Valid internal RTSP camera
    is_valid, err = SSRFValidator.validate_destination_url("rtsp://192.168.1.105:554/live/ch0")
    assert is_valid is True
    assert err is None

def test_input_path_traversal_and_directory_escape():
    """Section 49 & 50: Test directory traversal defense."""
    # Attempt traversal
    is_safe, path, err = InputSanitizerService.sanitize_file_path("../../windows/system32/cmd.exe")
    assert is_safe is False
    assert "traversal" in err.lower()

    # Null byte attack
    is_safe, path, err = InputSanitizerService.sanitize_file_path("evidence.jpg\0.exe")
    assert is_safe is False
    assert "null byte" in err.lower()

    # Safe filename
    is_safe, path, err = InputSanitizerService.sanitize_file_path("incident_snapshot_01.jpg", "storage/evidence")
    assert is_safe is True
    assert "incident_snapshot_01.jpg" in path

def test_file_upload_validation():
    """Section 49: Test upload MIME and size limits."""
    # Allowed JPG
    is_valid, err = InputSanitizerService.validate_file_upload("snap.jpg", "image/jpeg", 1024 * 500)
    assert is_valid is True

    # Disallowed EXE extension
    is_valid, err = InputSanitizerService.validate_file_upload("malware.exe", "application/octet-stream", 1024)
    assert is_valid is False

    # Oversized file (>25MB)
    is_valid, err = InputSanitizerService.validate_file_upload("huge_video.mp4", "video/mp4", 30 * 1024 * 1024)
    assert is_valid is False

def test_query_sanitizer_nosql_injection():
    """Section 47 & 48: Test query filter sanitizer strips injection operators."""
    malicious_query = {
        "status": "ACTIVE",
        "$where": "function() { return true; }",
        "nested": {
            "valid_field": 10,
            "$regex": ".*"
        }
    }
    sanitized = InputSanitizerService.sanitize_query_filter(malicious_query)
    assert "$where" not in sanitized
    assert "$regex" not in sanitized["nested"]
    assert sanitized["status"] == "ACTIVE"
    assert sanitized["nested"]["valid_field"] == 10

def test_edge_node_key_issuance_and_authentication(db):
    """Section 34 & 35: Test edge node API key generation and cryptographic verification."""
    node_id = "EDGE-SEC-TEST-01"
    plaintext_key, cred = EdgeAuthService.issue_edge_key(
        node_id=node_id,
        site_id="SITE-BORDER-NORTH",
        bop_id="BOP-ALPHA",
        actor="admin",
        db=db
    )
    assert plaintext_key.startswith("edg_live_")
    assert cred.status == "ACTIVE"

    # Verify with correct key
    is_valid, err, c = EdgeAuthService.verify_edge_key(node_id, plaintext_key, "192.168.1.200", db)
    assert is_valid is True
    assert err is None

    # Verify with tampered key
    is_valid, err, c = EdgeAuthService.verify_edge_key(node_id, "edg_live_fake_invalid_key", "192.168.1.200", db)
    assert is_valid is False
    assert "signature mismatch" in err.lower() or "invalid" in err.lower()

def test_edge_node_key_revocation_enforcement(db):
    """Section 36 & 37: Test revoked edge node credentials are immediately rejected."""
    node_id = "EDGE-REVOKE-TEST"
    plaintext_key, cred = EdgeAuthService.issue_edge_key(
        node_id=node_id,
        site_id="SITE-BORDER-NORTH",
        actor="admin",
        db=db
    )

    # Revoke
    revoked = EdgeAuthService.revoke_edge_key(node_id, "Compromised edge device", "admin", db)
    assert revoked is True

    # Attempt verification -> Must fail
    is_valid, err, c = EdgeAuthService.verify_edge_key(node_id, plaintext_key, "192.168.1.200", db)
    assert is_valid is False
    assert "revoked" in err.lower()

def test_rtsp_credential_masking():
    """Section 27 & 29: Test RTSP password masking in URLs."""
    raw_rtsp = "rtsp://admin:SecretP@ssw0rd!@192.168.1.100:554/ch1"
    masked = mask_rtsp_url(raw_rtsp)
    assert "SecretP@ssw0rd!" not in masked
    assert "admin:SecretP@ssw0rd!" not in masked
    assert "***:***@" in masked

def test_security_posture_score_and_findings(db):
    """Section 85 & 86: Test Zero-Trust posture score calculation and recommendations."""
    overview = SecurityCorrelationEngine.get_security_posture_overview(db)
    assert overview.posture_score >= 0 and overview.posture_score <= 100
    assert overview.overall_status in ["STRONG", "MODERATE", "CRITICAL"]
    assert len(overview.checks) >= 5
    assert len(overview.findings) > 0

def test_ip_blocklist_enforcement(db):
    """Section 6 & 7: Test blocked IP receives HTTP 403 on login."""
    blocked_ip = "203.0.113.88"
    entry = db.query(BlockedIPEntry).filter(BlockedIPEntry.ip_address == blocked_ip).first()
    if not entry:
        entry = BlockedIPEntry(
            ip_address=blocked_ip,
            reason="Automated Brute Force Attack",
            is_active=True,
            blocked_until=datetime.utcnow() + timedelta(hours=1)
        )
        db.add(entry)
    else:
        entry.is_active = True
        entry.blocked_until = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    is_blocked, reason = AuthRateLimiter.is_ip_blocked(blocked_ip, db)
    assert is_blocked is True
    assert "brute force" in reason.lower()
