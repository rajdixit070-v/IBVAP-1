from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class TimelineEvent(BaseModel):
    timestamp: str
    action: str
    actor: str
    notes: Optional[str] = None

class PlaybookStepItem(BaseModel):
    step_id: int
    title: str
    required: bool = True
    action: Optional[str] = None
    is_completed: bool = False
    completed_by: Optional[str] = None
    completed_at: Optional[str] = None
    notes: Optional[str] = None

class IncidentBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "HIGH" # CRITICAL, HIGH, MEDIUM, LOW
    incident_type: str = "SECURITY" # SECURITY, INFRASTRUCTURE
    camera_id: str
    bop_site: Optional[str] = "BOP Alpha"
    zone_name: Optional[str] = None
    track_id: Optional[int] = 0
    global_track_id: Optional[str] = None
    risk_score: Optional[int] = 50
    source_event_id: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_team: Optional[str] = None
    assigned_unit: Optional[str] = None
    playbook_id: Optional[str] = None

class IncidentCreate(IncidentBase):
    pass

class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_team: Optional[str] = None
    assigned_unit: Optional[str] = None
    risk_score: Optional[int] = None
    notes: Optional[str] = None
    actor_username: Optional[str] = "operator"
    version: Optional[int] = None

class IncidentTriageRequest(BaseModel):
    priority: Optional[str] = None
    playbook_id: Optional[str] = None
    notes: Optional[str] = None
    actor_username: Optional[str] = "operator"
    version: Optional[int] = None

class IncidentAssignRequest(BaseModel):
    assigned_to: str
    assigned_team: Optional[str] = "Quick Reaction Team (QRT-1)"
    assigned_unit: Optional[str] = "Patrol Unit Alpha"
    notes: Optional[str] = None
    actor_username: Optional[str] = "operator"
    version: Optional[int] = None

class IncidentEscalateRequest(BaseModel):
    reason: str
    target_level: Optional[int] = None
    notes: Optional[str] = None
    actor_username: Optional[str] = "operator"
    version: Optional[int] = None

class IncidentActionRequest(BaseModel):
    notes: Optional[str] = None
    actor_username: Optional[str] = "operator"
    version: Optional[int] = None

class IncidentResolveRequest(BaseModel):
    resolution_category: Optional[str] = "Resolved"
    resolution_notes: Optional[str] = None
    notes: Optional[str] = None
    actor_username: Optional[str] = "operator"
    version: Optional[int] = None

class IncidentFalseAlarmRequest(BaseModel):
    false_alarm_reason: str = "other"
    false_alarm_notes: Optional[str] = None
    actor_username: Optional[str] = "operator"
    version: Optional[int] = None

class IncidentChecklistStepUpdate(BaseModel):
    step_id: int
    is_completed: bool
    notes: Optional[str] = None
    actor_username: Optional[str] = "operator"

class IncidentReviewCreate(BaseModel):
    outcome_category: str = Field(..., description="TRUE_EVENT, FALSE_ALARM, ENVIRONMENTAL, INFRASTRUCTURE, AUTHORIZED_ACTIVITY, UNKNOWN")
    root_cause: Optional[str] = None
    preventative_actions: Optional[str] = None
    calibration_recommended: bool = False
    operator_username: Optional[str] = "operator"

class IncidentReviewResponse(BaseModel):
    id: int
    review_id: str
    incident_id: str
    outcome_category: str
    root_cause: Optional[str] = None
    preventative_actions: Optional[str] = None
    calibration_recommended: bool
    operator_username: str
    reviewed_at: datetime

    class Config:
        from_attributes = True

class IncidentPlaybookCreate(BaseModel):
    playbook_id: str
    name: str
    event_type: str
    description: Optional[str] = None
    steps: List[PlaybookStepItem] = []
    is_enabled: bool = True

class IncidentPlaybookResponse(BaseModel):
    id: int
    playbook_id: str
    name: str
    event_type: str
    description: Optional[str] = None
    steps: List[PlaybookStepItem] = []
    is_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True

class IncidentRelationshipCreate(BaseModel):
    parent_id: str
    child_id: str
    relationship_type: str = "RELATED" # PARENT_CHILD, RELATED, CLUSTER

class IncidentRelationshipResponse(BaseModel):
    id: int
    relationship_id: str
    parent_id: str
    child_id: str
    relationship_type: str
    created_at: datetime

    class Config:
        from_attributes = True

class IncidentResponse(BaseModel):
    id: int
    incident_id: str
    title: str
    description: Optional[str] = None
    incident_type: str
    priority: str
    status: str
    escalation_level: int
    escalation_due_at: Optional[datetime] = None
    false_alarm_reason: Optional[str] = None
    false_alarm_notes: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolution_category: Optional[str] = None
    source_event_id: Optional[str] = None
    camera_id: str
    bop_site: str
    zone_name: Optional[str] = None
    track_id: int
    global_track_id: Optional[str] = None
    risk_score: int
    related_cameras: List[str] = []
    parent_incident_id: Optional[str] = None
    playbook_id: Optional[str] = None
    checklist: List[PlaybookStepItem] = []
    review: Dict[str, Any] = {}
    assigned_to: Optional[str] = None
    assigned_team: Optional[str] = None
    assigned_unit: Optional[str] = None
    assigned_at: Optional[datetime] = None
    assigned_by: Optional[str] = None
    evidence_ids: List[str] = []
    timeline: List[TimelineEvent] = []
    version: int
    created_by: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    closed_at: Optional[datetime] = None
    closed_by: Optional[str] = None
    time_to_acknowledge_sec: Optional[float] = None
    time_to_resolve_sec: Optional[float] = None

    class Config:
        from_attributes = True

class IncidentAnalyticsSummary(BaseModel):
    total_incidents: int
    active_incidents: int
    critical_incidents: int
    resolved_incidents: int
    false_alarm_count: int
    false_alarm_rate_percent: float
    avg_mtta_seconds: float
    avg_mttr_seconds: float
    incidents_by_severity: Dict[str, int] = {}
    incidents_by_bop: Dict[str, int] = {}
    incidents_by_type: Dict[str, int] = {}

class IncidentReportExport(BaseModel):
    incident: IncidentResponse
    evidence_chain: List[Dict[str, Any]] = []
    audit_trail: List[Dict[str, Any]] = []
    export_generated_at: datetime
    exported_by: str
