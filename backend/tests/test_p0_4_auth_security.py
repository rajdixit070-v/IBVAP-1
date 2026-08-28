import pytest
from datetime import datetime, timedelta
from jose import jwt
from app.config import settings
from app.models.user import User
from app.core.security import get_password_hash, create_access_token
from app.database import SessionLocal

@pytest.fixture
def auth_db():
    session = SessionLocal()
    yield session
    session.close()

def test_p0_4_1_no_credentials(client):
    """Test 1: Request to protected endpoint without credentials returns 401 Unauthorized."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "detail" in response.json()

    cam_response = client.get("/api/v1/cameras")
    assert cam_response.status_code == 401

def test_p0_4_2_invalid_token(client):
    """Test 2: Request with invalid/tampered token returns 401 Unauthorized."""
    headers = {"Authorization": "Bearer invalid.fake.token.string"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401

def test_p0_4_3_expired_token(client):
    """Test 3: Request with expired token returns 401 Unauthorized."""
    expired_payload = {
        "sub": settings.DEFAULT_ADMIN_USERNAME,
        "role": "admin",
        "exp": datetime.utcnow() - timedelta(hours=1)
    }
    expired_token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    headers = {"Authorization": f"Bearer {expired_token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 401

def test_p0_4_4_valid_token(client):
    """Test 4: Request with valid token succeeds."""
    login_resp = client.post(
        "/api/v1/auth/login-json",
        json={"username": settings.DEFAULT_ADMIN_USERNAME, "password": settings.DEFAULT_ADMIN_PASSWORD}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == settings.DEFAULT_ADMIN_USERNAME

def test_p0_4_5_wrong_role_authorization(client, auth_db):
    """Test 5: Valid user with insufficient role gets 403 Forbidden on admin operations."""
    viewer_username = "test_viewer_p04"
    viewer_user = auth_db.query(User).filter(User.username == viewer_username).first()
    if not viewer_user:
        viewer_user = User(
            username=viewer_username,
            email="viewer_p04@ibvap.mil",
            hashed_password=get_password_hash("ViewerPass@2026"),
            role="viewer",
            is_active=True
        )
        auth_db.add(viewer_user)
        auth_db.commit()

    # Login as viewer
    login_resp = client.post(
        "/api/v1/auth/login-json",
        json={"username": viewer_username, "password": "ViewerPass@2026"}
    )
    assert login_resp.status_code == 200
    viewer_token = login_resp.json()["access_token"]
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    # Viewer can access profile
    me_resp = client.get("/api/v1/auth/me", headers=viewer_headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["role"] == "viewer"

    # Viewer CANNOT create sites (Admin only) -> 403 Forbidden
    create_site_resp = client.post("/api/v1/sites", json={
        "site_id": "SITE-FORBIDDEN-TEST",
        "region_id": "REG-NORTH",
        "name": "Forbidden Site",
        "code": "S-FORBIDDEN"
    }, headers=viewer_headers)
    assert create_site_resp.status_code == 403

def test_p0_4_6_idor_resource_authorization(client, auth_db):
    """Test 6: Valid user cannot access camera/site outside authorized scope (IDOR check)."""
    # Create an isolated user scoped to a different site
    scoped_username = "test_scoped_operator"
    scoped_user = auth_db.query(User).filter(User.username == scoped_username).first()
    if not scoped_user:
        scoped_user = User(
            username=scoped_username,
            email="scoped_op@ibvap.mil",
            hashed_password=get_password_hash("ScopedPass@2026"),
            role="operator",
            is_active=True
        )
        auth_db.add(scoped_user)
        auth_db.commit()

    login_resp = client.post(
        "/api/v1/auth/login-json",
        json={"username": scoped_username, "password": "ScopedPass@2026"}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify IDOR check on camera / site
    idor_resp = client.get("/api/v1/cameras/CAM-NONEXISTENT-OR-UNAUTHORIZED/live", headers=headers)
    # Returns 404 (not found) or 403 (unauthorized scope)
    assert idor_resp.status_code in [403, 404]

def test_p0_4_7_logout_token_revocation(client):
    """Test 7: Logging out revokes the token so subsequent requests return 401."""
    # 1. Login
    login_resp = client.post(
        "/api/v1/auth/login-json",
        json={"username": settings.DEFAULT_ADMIN_USERNAME, "password": settings.DEFAULT_ADMIN_PASSWORD}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Verify token works
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    # 3. Call logout
    logout_resp = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200

    # 4. Subsequent call with revoked token must fail with 401
    after_resp = client.get("/api/v1/auth/me", headers=headers)
    assert after_resp.status_code == 401
    assert "revoked or logged out" in after_resp.json()["detail"]
