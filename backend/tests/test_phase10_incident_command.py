import pytest
import uuid
import json
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.incident import Incident
from app.models.playbook import IncidentPlaybook
from app.models.incident_relationship import IncidentRelationship
from app.models.incident_review import IncidentReview
from app.models.alert import Alert
from app.services.incident.incident_service import incident_service
from app.services.incident.correlation_engine import correlation_engine
from app.services.incident.escalation_engine import escalation_engine
from app.services.incident.playbook_service import playbook_service
from app.services.incident.export_service import export_service
from app.schemas.incident import IncidentCreate, IncidentReviewCreate

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    yield db
    db.close()

def test_incident_creation_with_playbook_and_type(db_session):
    """Test incident creation with automatic playbook checklist instantiation."""
    playbook_service.ensure_default_playbooks()
    
    inc_data = IncidentCreate(
        title="Test Perimeter Breach Infiltration",
        description="Suspicious track near boundary fence.",
        priority="HIGH",
        incident_type="SECURITY",
        camera_id="CAM-001",
        bop_site="BOP Alpha",
        zone_name="Zero-Line Restricted Wire",
        track_id=101,
        risk_score=75
    )
    inc = incident_service.create_incident(inc_data, operator_username="test_op")
    
    assert inc.incident_id.startswith("INC-")
    assert inc.status == "NEW"
    assert inc.escalation_level == 1
    assert inc.incident_type == "SECURITY"
    assert inc.playbook_id == "PB-VIRTUAL-FENCE"
    
    checklist = json.loads(inc.checklist_json or "[]")
    assert len(checklist) >= 4
    assert checklist[0]["is_completed"] is False

def test_incident_full_lifecycle_transitions(db_session):
    """Test controlled state machine transitions from NEW to CLOSED."""
    inc_data = IncidentCreate(
        title="Lifecycle State Machine Test",
        camera_id="CAM-002",
        bop_site="BOP Alpha",
        priority="CRITICAL",
        risk_score=85
    )
    inc = incident_service.create_incident(inc_data)
    i_id = inc.incident_id

    # 1. Triage
    inc = incident_service.triage_incident(i_id, priority="CRITICAL", notes="Verified by operator")
    assert inc.status == "TRIAGED"

    # 2. Assign
    inc = incident_service.assign_incident(i_id, assigned_to="Capt. Sharma", assigned_team="QRT-Alpha")
    assert inc.status == "ASSIGNED"
    assert inc.assigned_to == "Capt. Sharma"

    # 3. Respond
    inc = incident_service.respond_incident(i_id, notes="QRT Alpha deployed")
    assert inc.status == "RESPONDING"

    # 4. Contain
    inc = incident_service.contain_incident(i_id, notes="Sector secured")
    assert inc.status == "CONTAINED"

    # 5. Resolve
    inc = incident_service.resolve_incident(
        i_id,
        resolution_category="Resolved",
        resolution_notes="Target intercepted and sector perimeter intact."
    )
    assert inc.status == "RESOLVED"
    assert inc.resolved_at is not None

    # 6. Close
    inc = incident_service.close_incident(i_id, actor="supervisor")
    assert inc.status == "CLOSED"
    assert inc.closed_at is not None

def test_incident_correlation_and_deduplication(db_session):
    """Test multi-camera correlation deduplication by globalTrackId."""
    gt_id = f"GT-TEST-{uuid.uuid4().hex[:6].upper()}"
    
    # 1. First alert creates incident
    alert1 = Alert(
        alert_id=f"ALT-CORR-1-{uuid.uuid4().hex[:4]}",
        event_id="EVT-001",
        camera_id="CAM-001",
        bop_site="BOP Alpha",
        priority="HIGH",
        status="ACTIVE",
        title="Intrusion on CAM-001"
    )
    inc1, is_new1 = correlation_engine.correlate_or_create(alert1, risk_score=70, global_track_id=gt_id)
    assert is_new1 is True

    # 2. Second alert from CAM-002 with same global track attaches to same incident
    alert2 = Alert(
        alert_id=f"ALT-CORR-2-{uuid.uuid4().hex[:4]}",
        event_id="EVT-002",
        camera_id="CAM-002",
        bop_site="BOP Alpha",
        priority="HIGH",
        status="ACTIVE",
        title="Same entity loitering on CAM-002"
    )
    inc2, is_new2 = correlation_engine.correlate_or_create(alert2, risk_score=85, global_track_id=gt_id)
    assert is_new2 is False
    assert inc2.incident_id == inc1.incident_id
    
    related = json.loads(inc2.related_cameras_json or "[]")
    assert "CAM-001" in related
    assert "CAM-002" in related
    assert inc2.risk_score == 85

def test_escalation_engine_sla_and_level_advancement(db_session):
    """Test SLA evaluation and multi-tier escalation."""
    now = datetime.utcnow()
    # Create incident with past creation time exceeding Level 1 SLA (2 mins)
    inc = Incident(
        incident_id=f"INC-ESC-{uuid.uuid4().hex[:6].upper()}",
        title="Overdue Critical Incident",
        priority="CRITICAL",
        status="NEW",
        escalation_level=1,
        camera_id="CAM-001",
        bop_site="BOP Alpha",
        created_at=now - timedelta(minutes=5), # 5 mins old > 2 mins SLA
        updated_at=now - timedelta(minutes=5)
    )
    db_session.add(inc)
    db_session.commit()

    escalated = escalation_engine.evaluate_and_escalate_active_incidents()
    matching = [e for e in escalated if e["incident_id"] == inc.incident_id]
    assert len(matching) == 1
    assert matching[0]["new_level"] == 2

    # Test status helper
    status_info = escalation_engine.get_escalation_status(inc)
    assert status_info["escalation_level"] == 2

def test_playbook_checklist_step_execution(db_session):
    """Test interactive checklist step updates and state persistence."""
    inc_data = IncidentCreate(
        title="Playbook Checklist Test",
        camera_id="CAM-001",
        priority="HIGH",
        risk_score=70
    )
    inc = incident_service.create_incident(inc_data)
    
    # Complete step 1
    updated = incident_service.update_checklist_step(
        incident_id=inc.incident_id,
        step_id=1,
        is_completed=True,
        notes="Stream verified clear",
        actor="operator_1"
    )
    checklist = json.loads(updated.checklist_json or "[]")
    step1 = next(s for s in checklist if s["step_id"] == 1)
    assert step1["is_completed"] is True
    assert step1["completed_by"] == "operator_1"
    assert step1["notes"] == "Stream verified clear"

def test_post_incident_review_and_calibration_recommendation(db_session):
    """Test post-incident learning review and calibration feedback."""
    inc_data = IncidentCreate(
        title="Post-Incident Review Test",
        camera_id="CAM-004",
        priority="MEDIUM",
        risk_score=50
    )
    inc = incident_service.create_incident(inc_data)

    review_data = IncidentReviewCreate(
        outcome_category="ENVIRONMENTAL",
        root_cause="Heavy rain and tree branch shadow triggered motion detector.",
        preventative_actions="Adjust thermal sensitivity threshold for sector 4.",
        calibration_recommended=True,
        operator_username="commander_1"
    )
    review = incident_service.record_review(inc.incident_id, review_data)
    assert review.review_id.startswith("REV-")
    assert review.outcome_category == "ENVIRONMENTAL"
    assert review.calibration_recommended is True

def test_incident_relationship_and_clustering(db_session):
    """Test parent/child hierarchical incident linking."""
    rel = incident_service.link_incidents(
        parent_id="INC-2026-000101",
        child_id="INC-2026-000102",
        relationship_type="PARENT_CHILD",
        actor="commander"
    )
    assert rel.relationship_id.startswith("REL-")
    assert rel.parent_id == "INC-2026-000101"
    assert rel.relationship_type == "PARENT_CHILD"

def test_incident_dossier_report_export_with_sha256(db_session):
    """Test cryptographic incident report generation and SHA-256 integrity."""
    inc_data = IncidentCreate(
        title="Dossier Report Export Test",
        camera_id="CAM-001",
        priority="HIGH",
        risk_score=80
    )
    inc = incident_service.create_incident(inc_data)

    report = export_service.generate_incident_report(inc.incident_id, exported_by="admin")
    assert "dossier_id" in report
    assert "dossier_sha256" in report
    assert len(report["dossier_sha256"]) == 64
    assert report["incident"]["incident_id"] == inc.incident_id
    assert "timeline" in report
    assert "evidence_chain" in report

def test_optimistic_locking_conflict_protection(db_session):
    """Test version conflict handling to prevent silent concurrent overwrites."""
    inc_data = IncidentCreate(
        title="Optimistic Locking Test",
        camera_id="CAM-001",
        priority="HIGH"
    )
    inc = incident_service.create_incident(inc_data)
    assert inc.version == 1

    # Update 1 succeeds with version 1
    incident_service.triage_incident(inc.incident_id, notes="Operator 1 triage", version=1)

    # Update 2 with stale version 1 should fail
    with pytest.raises(ValueError, match="Concurrent modification detected"):
        incident_service.triage_incident(inc.incident_id, notes="Operator 2 conflicting edit", version=1)

def test_false_alarm_and_dismissed_outcomes(db_session):
    """Test marking incident as false alarm with feedback category."""
    inc_data = IncidentCreate(
        title="False Alarm Classification Test",
        camera_id="CAM-003",
        priority="LOW"
    )
    inc = incident_service.create_incident(inc_data)

    res = client.post(f"/api/v1/incidents/{inc.incident_id}/resolve", json={
        "resolution_category": "False Alarm",
        "resolution_notes": "Identified as domestic cattle grazing."
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FALSE_ALARM"
    assert data["resolution_category"] == "False Alarm"
