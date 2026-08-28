from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class SecurityThreatEventResponse(BaseModel):
    id: int
    event_id: str
    timestamp: datetime
    event_type: str
    severity: str
    source_ip: str
    user_agent: str
    username: Optional[str] = None
    target_resource: Optional[str] = None
    endpoint: Optional[str] = None
    details_json: str
    mitigation_action: str
    status: str
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SecurityThreatEventCreate(BaseModel):
    event_type: str
    severity: str = "MEDIUM"
    source_ip: str = "127.0.0.1"
    user_agent: str = "Unknown"
    username: Optional[str] = None
    target_resource: Optional[str] = None
    endpoint: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    mitigation_action: str = "LOGGED"

class SecurityThreatResolveRequest(BaseModel):
    status: str = "RESOLVED"
    resolution_notes: str

class EdgeNodeKeyIssueRequest(BaseModel):
    node_id: str
    site_id: str = "SITE-BORDER-NORTH"
    bop_id: Optional[str] = None
    expires_in_days: int = 90

class EdgeNodeKeyResponse(BaseModel):
    id: int
    node_id: str
    key_prefix: str
    status: str
    site_id: str
    bop_id: Optional[str] = None
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True

class EdgeNodeKeyIssuedSecretResponse(BaseModel):
    node_id: str
    api_key: str  # Plaintext key returned ONCE upon generation
    key_prefix: str
    expires_at: Optional[datetime] = None
    message: str

class EdgeNodeRevokeRequest(BaseModel):
    reason: str

class BlockedIPResponse(BaseModel):
    id: int
    ip_address: str
    reason: str
    attack_count: int
    is_active: boolean if False else bool
    blocked_until: Optional[datetime] = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True

class BlockIPRequest(BaseModel):
    ip_address: str
    reason: str
    duration_hours: Optional[int] = 24

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class PasswordValidationResult(BaseModel):
    is_valid: bool
    errors: List[str] = []
    score: int = 0  # 0 to 100

class SecurityFinding(BaseModel):
    id: str
    category: str
    severity: str
    title: str
    description: str
    recommendation: str
    status: str = "OPEN"

class SecurityPostureOverview(BaseModel):
    posture_score: int  # 0 - 100
    overall_status: str  # STRONG, MODERATE, CRITICAL
    active_threats_count: int
    critical_threats_count: int
    locked_accounts_count: int
    revoked_edge_nodes_count: int
    blocked_ips_count: int
    threats_by_type: Dict[str, int]
    threats_by_severity: Dict[str, int]
    findings: List[SecurityFinding]
    checks: Dict[str, Dict[str, Any]]
    timestamp: datetime

class SecurityAuditLogResponse(BaseModel):
    id: int
    audit_id: str
    actor_username: str
    action_type: str
    resource_type: str
    resource_id: Optional[str] = None
    old_value_json: Optional[str] = None
    new_value_json: Optional[str] = None
    ip_address: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
