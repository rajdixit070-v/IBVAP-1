import pytest
import os
import sys

# Ensure backend path is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app, init_db_defaults
from app.config import settings
from fastapi.testclient import TestClient

@pytest.fixture(scope="session", autouse=True)
def initialize_database():
    """Initializes SQLite database tables and default admin credentials before running tests."""
    init_db_defaults()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def admin_token_headers(client):
    response = client.post(
        f"{settings.API_V1_STR}/auth/login-json",
        json={"username": settings.DEFAULT_ADMIN_USERNAME, "password": settings.DEFAULT_ADMIN_PASSWORD}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
