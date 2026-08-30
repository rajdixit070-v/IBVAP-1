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
    init_db_defaults(seed_demo=True)
    yield
    # TEARDOWN: Purge test artifacts so primary database remains clean
    try:
        from sqlalchemy import text
        from app.database import SessionLocal
        db = SessionLocal()
        test_tables = [
            "cameras", "security_zones", "alerts", "incidents", "ai_events",
            "security_events", "security_threat_events", "multimodal_security_events",
            "notifications", "ai_observations", "evidence_records", "global_tracks",
            "track_associations", "track_observations", "camera_transitions",
            "camera_ai_configs", "camera_ai_profiles", "early_warnings",
            "baseline_shifts", "edge_event_buffers", "edge_node_credentials",
            "edge_nodes", "incident_relationships", "incident_reviews",
            "maintenance_windows", "model_health", "health_config_records",
            "prediction_feedback", "behaviour_feedback", "ai_operator_feedbacks",
            "sites", "bops", "site_user_scopes", "vehicle_watchlist",
            "person_watchlist", "anpr_events", "face_events", "camera_health_logs"
        ]
        for tbl in test_tables:
            try:
                db.execute(text(f"DELETE FROM {tbl}"))
            except Exception:
                pass
        db.execute(text("DELETE FROM behaviour_rules WHERE rule_id LIKE 'RULE-TEST-%'"))
        db.execute(text("DELETE FROM users WHERE username != 'admin'"))
        db.commit()
        db.close()
    except Exception as e:
        print(f"Teardown cleanup error: {e}")

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

@pytest.fixture
def auth_header(admin_token_headers):
    return admin_token_headers

@pytest.fixture
def auth_headers(admin_token_headers):
    return admin_token_headers
