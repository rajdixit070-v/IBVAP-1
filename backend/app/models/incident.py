from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from datetime import datetime
from app.database import Base

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. INC-2026-000101
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    # Incident Type: SECURITY vs INFRASTRUCTURE
    incident_type = Column(String(30), default="SECURITY", index=True, nullable=False)
    
    # Priority: CRITICAL, HIGH, MEDIUM, LOW
    priority = Column(String(20), default="HIGH", index=True, nullable=False)
    
    # Lifecycle Status: NEW, TRIAGED, ASSIGNED, INVESTIGATING, RESPONDING, CONTAINED, RESOLVED, CLOSED, FALSE_ALARM, DISMISSED
    status = Column(String(30), default="NEW", index=True, nullable=False)
    
    # Escalation: Level 1, 2, 3
    escalation_level = Column(Integer, default=1, index=True)
    escalation_due_at = Column(DateTime, nullable=True)
    
    false_alarm_reason = Column(String(100), nullable=True)
    false_alarm_notes = Column(Text, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    resolution_category = Column(String(50), nullable=True) # Resolved, False Alarm, Authorized Activity, Infrastructure Issue, Duplicate, Unable to Verify
    
    source_event_id = Column(String(50), index=True, nullable=True)
    camera_id = Column(String(50), index=True, nullable=False)
    bop_site = Column(String(100), default="BOP Alpha", index=True)
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True) # Phase 12 Multi-Site
    bop_id = Column(String(50), nullable=True, index=True)               # Phase 12 BOP reference
    zone_name = Column(String(100), nullable=True)
    track_id = Column(Integer, default=0)
    global_track_id = Column(String(50), index=True, nullable=True)
    risk_score = Column(Integer, default=50, index=True)
    
    # Multi-Camera Correlation
    related_cameras_json = Column(Text, default="[]") # e.g. ["CAM-001", "CAM-002"]
    parent_incident_id = Column(String(50), index=True, nullable=True)
    
    # Response Playbook & Checklists
    playbook_id = Column(String(50), nullable=True)
    checklist_json = Column(Text, default="[]")
    review_json = Column(Text, default="{}")
    
    assigned_to = Column(String(100), nullable=True, index=True)
    assigned_team = Column(String(100), nullable=True) # e.g. "Quick Reaction Team (QRT-1)"
    assigned_unit = Column(String(100), nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    assigned_by = Column(String(100), nullable=True)
    
    evidence_ids_json = Column(Text, default="[]")
    timeline_json = Column(Text, default="[]")
    
    # Optimistic Locking Version
    version = Column(Integer, default=1)
    
    created_by = Column(String(100), default="operator")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(100), nullable=True)
    closed_at = Column(DateTime, nullable=True)
    closed_by = Column(String(100), nullable=True)

Index("idx_incident_status_bop", Incident.status, Incident.bop_site, Incident.priority)
Index("idx_incident_type_esc", Incident.incident_type, Incident.escalation_level)
Index("idx_incident_cam_gt", Incident.camera_id, Incident.global_track_id)
