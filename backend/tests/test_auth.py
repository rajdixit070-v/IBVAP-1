import pytest
from app.config import settings

def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["platform"] == "IBVAP"
    assert data["status"] == "OPERATIONAL"

def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"

def test_admin_login(client):
    response = client.post(
        "/api/v1/auth/login-json",
        json={
            "username": settings.DEFAULT_ADMIN_USERNAME,
            "password": settings.DEFAULT_ADMIN_PASSWORD
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "admin"
    assert data["token_type"] == "bearer"

def test_invalid_login(client):
    response = client.post(
        "/api/v1/auth/login-json",
        json={
            "username": "wrong_user",
            "password": "wrong_password"
        }
    )
    assert response.status_code == 401
