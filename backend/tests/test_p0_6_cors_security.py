import pytest
from app.config import settings

def test_p0_6_1_cors_allowed_origin(client):
    """Test 1: Requests from allowed origin receive appropriate CORS header."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET"
    }
    resp = client.options("/api/v1/cameras", headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "GET" in resp.headers.get("access-control-allow-methods", "")

def test_p0_6_2_cors_unauthorized_origin(client):
    """Test 2: Requests from unauthorized origin do NOT receive allow-origin header matching the attacker."""
    headers = {
        "Origin": "https://malicious-attacker-site.com",
        "Access-Control-Request-Method": "GET"
    }
    resp = client.options("/api/v1/cameras", headers=headers)
    allow_origin = resp.headers.get("access-control-allow-origin")
    assert allow_origin != "https://malicious-attacker-site.com"
    assert allow_origin != "*"

def test_p0_6_3_cors_preflight_headers(client):
    """Test 3: Preflight OPTIONS request returns allowed methods and headers."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization, Content-Type"
    }
    resp = client.options("/api/v1/auth/login-json", headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert resp.headers.get("access-control-allow-credentials") == "true"
    allowed_headers = resp.headers.get("access-control-allow-headers", "").lower()
    assert "authorization" in allowed_headers
    assert "content-type" in allowed_headers

def test_p0_6_4_security_headers_present(client):
    """Test 4: Enterprise zero-trust security headers are injected on all API responses."""
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert resp.headers.get("x-frame-options") == "DENY"
    assert resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

def test_p0_6_5_probes_healthy(client):
    """Test 5: Container liveness (/health) and readiness (/ready) probes respond cleanly."""
    live_resp = client.get("/health")
    assert live_resp.status_code == 200
    assert live_resp.json()["status"] == "ALIVE"

    ready_resp = client.get("/ready")
    assert ready_resp.status_code == 200
    assert ready_resp.json()["status"] == "READY"
