import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.federation_models import Organization, Region, Site, BOP, SiteUserScope, ConfigurationScope
from app.models.camera import Camera
from app.models.incident import Incident
from app.core.security import get_password_hash
from app.services.federation.federation_service import FederationService
from app.services.federation.scope_service import ScopeService

client = TestClient(app)

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

def test_tenant_hierarchy_and_seed_data(db):
    """Verifies default Organization, Region, Site, and BOPs are seeded."""
    org = db.query(Organization).filter(Organization.org_id == "ORG-IBVAP").first()
    assert org is not None
    assert org.name == "IBVAP Command Central"

    reg = db.query(Region).filter(Region.region_id == "REG-NORTH").first()
    assert reg is not None
    assert reg.org_id == org.org_id

    site = db.query(Site).filter(Site.site_id == "SITE-BORDER-NORTH").first()
    assert site is not None
    assert site.region_id == reg.region_id

    bops = db.query(BOP).filter(BOP.site_id == site.site_id).all()
    assert len(bops) >= 3
    bop_names = [b.name for b in bops]
    assert "BOP Alpha" in bop_names
    assert "BOP Bravo" in bop_names

def test_site_crud_and_status(db):
    """Tests creating, retrieving, updating, and deactivating a Site."""
    site_id = "SITE-TEST-WEST"
    # Clean if exists
    db.query(Site).filter(Site.site_id == site_id).delete()
    db.commit()

    # Create Site
    create_res = client.post("/api/v1/sites", json={
        "site_id": site_id,
        "region_id": "REG-NORTH",
        "name": "Western Desert Border Command",
        "code": "S-WEST",
        "description": "Arid border zone with high vehicular traffic",
        "location": "Western Outpost Zone 1",
        "latitude": 28.5000,
        "longitude": 70.2000,
        "timezone": "UTC+05:30",
        "status": "ACTIVE"
    })
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["site_id"] == site_id
    assert data["code"] == "S-WEST"

    # Get Site
    get_res = client.get(f"/api/v1/sites/{site_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Western Desert Border Command"

    # Update Site
    upd_res = client.put(f"/api/v1/sites/{site_id}", json={
        "name": "Western Tactical Border Hub",
        "status": "DEGRADED"
    })
    assert upd_res.status_code == 200
    assert upd_res.json()["name"] == "Western Tactical Border Hub"
    assert upd_res.json()["status"] == "DEGRADED"

    # Deactivate Site
    del_res = client.delete(f"/api/v1/sites/{site_id}")
    assert del_res.status_code == 200
    
    # Verify status is INACTIVE
    s = db.query(Site).filter(Site.site_id == site_id).first()
    assert s.status == "INACTIVE"

def test_bop_crud_under_site(db):
    """Tests creating, retrieving, and updating a BOP."""
    bop_id = "BOP-DELTA"
    db.query(BOP).filter(BOP.bop_id == bop_id).delete()
    db.commit()

    # Create BOP
    res = client.post("/api/v1/bops", json={
        "bop_id": bop_id,
        "site_id": "SITE-BORDER-NORTH",
        "name": "BOP Delta",
        "code": "BOP-D",
        "description": "High-altitude observation post",
        "location": "Ridge Top Point 4",
        "latitude": 32.7450,
        "longitude": 74.8720,
        "status": "ACTIVE",
        "operational_priority": "HIGH"
    })
    assert res.status_code == 201
    assert res.json()["name"] == "BOP Delta"

    # Get BOP
    get_res = client.get(f"/api/v1/bops/{bop_id}")
    assert get_res.status_code == 200
    assert get_res.json()["operational_priority"] == "HIGH"

    # Update BOP
    upd_res = client.put(f"/api/v1/bops/{bop_id}", json={
        "operational_priority": "CRITICAL"
    })
    assert upd_res.status_code == 200
    assert upd_res.json()["operational_priority"] == "CRITICAL"

def test_site_and_bop_overview_telemetry(db):
    """Tests /api/v1/sites/{id}/overview and /api/v1/bops/{id}/overview."""
    # Site overview
    res = client.get("/api/v1/sites/SITE-BORDER-NORTH/overview")
    assert res.status_code == 200
    so = res.json()
    assert so["site_id"] == "SITE-BORDER-NORTH"
    assert so["total_bops"] >= 3
    assert so["total_cameras"] >= 1
    assert "system_health" in so
    assert "current_risk" in so
    assert len(so["bops"]) >= 3

    # BOP overview
    bop_res = client.get("/api/v1/bops/BOP-ALPHA/overview")
    assert bop_res.status_code == 200
    bo = bop_res.json()
    assert bo["bop_id"] == "BOP-ALPHA"
    assert bo["site_id"] == "SITE-BORDER-NORTH"
    assert bo["total_cameras"] >= 1

    # Camera wall
    wall_res = client.get("/api/v1/bops/BOP-ALPHA/cameras")
    assert wall_res.status_code == 200
    wall = wall_res.json()
    assert isinstance(wall, list)
    assert len(wall) >= 1
    assert "camera_id" in wall[0]
    assert "status" in wall[0]
    assert "current_event" in wall[0]

def test_rbac_scope_assignment_and_site_isolation(db):
    """
    Tests assigning user to SITE-BORDER-NORTH only.
    Verifies user can access SITE-BORDER-NORTH but gets 403 on SITE-BORDER-SOUTH.
    """
    # Create test users
    u_site_north = "operator_north"
    user = db.query(User).filter(User.username == u_site_north).first()
    if not user:
        user = User(
            username=u_site_north,
            email="north@ibvap.mil",
            hashed_password=get_password_hash("pass123"),
            role="operator",
            is_active=True
        )
        db.add(user)
        db.commit()

    # Create target unauthorized site
    s_south = "SITE-BORDER-SOUTH"
    site_s = db.query(Site).filter(Site.site_id == s_south).first()
    if not site_s:
        site_s = Site(
            site_id=s_south,
            region_id="REG-NORTH",
            name="Southern Sector Command",
            code="S-SOUTH",
            status="ACTIVE"
        )
        db.add(site_s)
        db.commit()

    # Assign user scope: SITE:SITE-BORDER-NORTH
    client.post("/api/v1/federation/user-scopes", json={
        "username": u_site_north,
        "scope_type": "SITE",
        "scope_id": "SITE-BORDER-NORTH",
        "role": "SITE_ADMIN"
    })

    # Verify ScopeService enforcement
    assert ScopeService.can_access_site(user, "SITE-BORDER-NORTH", db) is True
    assert ScopeService.can_access_site(user, "SITE-BORDER-SOUTH", db) is False

    # Calling require_site_access should raise 403
    with pytest.raises(Exception) as exc_info:
        ScopeService.require_site_access(user, "SITE-BORDER-SOUTH", db)
    assert "403" in str(exc_info.value)

def test_bop_operator_isolation(db):
    """
    Tests assigning operator to BOP Alpha only.
    Verifies access to BOP Alpha is allowed and BOP Bravo is denied (403).
    """
    u_bop_alpha = "op_alpha_only"
    user = db.query(User).filter(User.username == u_bop_alpha).first()
    if not user:
        user = User(
            username=u_bop_alpha,
            email="alpha_op@ibvap.mil",
            hashed_password=get_password_hash("pass123"),
            role="operator",
            is_active=True
        )
        db.add(user)
        db.commit()

    # Assign BOP scope
    client.post("/api/v1/federation/user-scopes", json={
        "username": u_bop_alpha,
        "scope_type": "BOP",
        "scope_id": "BOP-ALPHA",
        "role": "BOP_OPERATOR"
    })

    assert ScopeService.can_access_bop(user, "BOP-ALPHA", db) is True
    assert ScopeService.can_access_bop(user, "BOP Alpha", db) is True
    assert ScopeService.can_access_bop(user, "BOP Bravo", db) is False

    # Check 403 on BOP Bravo
    with pytest.raises(Exception) as exc_info:
        ScopeService.require_bop_access(user, "BOP Bravo", db)
    assert "403" in str(exc_info.value)

def test_hierarchical_health_aggregation(db):
    """Tests health calculation across BOP -> Site -> Global without double counting."""
    bop_h = FederationService.get_bop_health("BOP-ALPHA", db)
    assert "health_score" in bop_h
    assert 0.0 <= bop_h["health_score"] <= 100.0
    assert bop_h["health_status"] in ["HEALTHY", "DEGRADED", "WARNING", "CRITICAL"]

    site_h = FederationService.get_site_health("SITE-BORDER-NORTH", db)
    assert "health_score" in site_h
    assert site_h["bops_count"] >= 3
    assert site_h["total_cameras"] >= bop_h["total_cameras"]

def test_federation_overview_and_matrices(db):
    """Tests Global Overview, Site Health Matrix, and BOP Health Matrix."""
    # Global Overview
    res = client.get("/api/v1/federation/global/overview")
    assert res.status_code == 200
    data = res.json()
    assert data["total_sites"] >= 1
    assert data["total_bops"] >= 3
    assert data["total_cameras"] >= 1
    assert "overall_health_score" in data

    # Sites Matrix
    sm_res = client.get("/api/v1/federation/sites/matrix")
    assert sm_res.status_code == 200
    s_matrix = sm_res.json()
    assert len(s_matrix) >= 1
    assert "site_id" in s_matrix[0]
    assert "health_score" in s_matrix[0]

    # BOPs Matrix
    bm_res = client.get("/api/v1/federation/bops/matrix")
    assert bm_res.status_code == 200
    b_matrix = bm_res.json()
    assert len(b_matrix) >= 3
    assert "bop_id" in b_matrix[0]
    assert "health_score" in b_matrix[0]

def test_configuration_inheritance_resolution(db):
    """
    Section 42 & 43: Configuration Inheritance
    Resolves Camera -> Zone -> BOP -> Site -> Global.
    """
    key = "fps_threshold"

    # Set Site-level override
    client.post("/api/v1/federation/config/override", json={
        "scope_level": "SITE",
        "scope_id": "SITE-BORDER-NORTH",
        "config_key": key,
        "config_value_json": "18.0",
        "reason": "Bandwidth conservation for northern border microwave link"
    })

    # Resolve at BOP level (should inherit from Site)
    res_bop = client.get(f"/api/v1/federation/config/effective?key={key}&site_id=SITE-BORDER-NORTH&bop_id=BOP-ALPHA")
    assert res_bop.status_code == 200
    d_bop = res_bop.json()
    assert d_bop["effective_value"] == 18.0
    assert d_bop["resolved_from_level"] == "SITE"

    # Set Camera-level override (should override Site)
    client.post("/api/v1/federation/config/override", json={
        "scope_level": "CAMERA",
        "scope_id": "CAM-001",
        "config_key": key,
        "config_value_json": "25.0",
        "reason": "Perimeter Gate North requires full 25fps surveillance"
    })

    # Resolve at Camera level
    res_cam = client.get(f"/api/v1/federation/config/effective?key={key}&site_id=SITE-BORDER-NORTH&bop_id=BOP-ALPHA&camera_id=CAM-001")
    assert res_cam.status_code == 200
    d_cam = res_cam.json()
    assert d_cam["effective_value"] == 25.0
    assert d_cam["resolved_from_level"] == "CAMERA"

def test_cross_site_global_search(db):
    """Section 37: Cross-site global search across cameras, BOPs, and sites."""
    res = client.get("/api/v1/federation/search?q=Alpha")
    assert res.status_code == 200
    data = res.json()
    assert data["total_matches"] >= 1
    types = [r["entity_type"] for r in data["results"]]
    assert "BOP" in types or "CAMERA" in types

def test_federated_map_data_and_clustering(db):
    """Section 9 & 10: Unified map query with sites, BOPs, cameras, and cluster counts."""
    res = client.get("/api/v1/federation/map")
    assert res.status_code == 200
    m = res.json()
    assert "sites" in m
    assert "bops" in m
    assert "cameras" in m
    assert len(m["sites"]) >= 1
    assert len(m["bops"]) >= 3
    assert m["clusters_summary"]["total_cameras"] >= 1

def test_multi_site_aggregated_reports(db):
    """Section 66: Generates multi-site aggregated summary report."""
    res = client.get("/api/v1/federation/reports?scope=ALL")
    assert res.status_code == 200
    data = res.json()
    assert data["report_scope"] == "ALL"
    assert "summary" in data
    assert len(data["site_breakdown"]) >= 1
    assert len(data["bop_breakdown"]) >= 3
