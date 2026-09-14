from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

# --- Organization & Region ---
class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=20)
    description: Optional[str] = None
    status: str = "ACTIVE"

class OrganizationCreate(OrganizationBase):
    org_id: str = Field(..., min_length=2, max_length=50)

class OrganizationResponse(OrganizationBase):
    id: int
    org_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class RegionBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=20)
    description: Optional[str] = None
    status: str = "ACTIVE"

class RegionCreate(RegionBase):
    region_id: str = Field(..., min_length=2, max_length=50)
    org_id: str = Field(..., min_length=2, max_length=50)

class RegionResponse(RegionBase):
    id: int
    region_id: str
    org_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Site Schemas ---
class SiteBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=20)
    description: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = "Asia/Kolkata"
    status: Optional[str] = "ACTIVE" # ACTIVE, INACTIVE, MAINTENANCE, DEGRADED

class SiteCreate(SiteBase):
    site_id: Optional[str] = None
    region_id: Optional[str] = "REG-INDIA-BORDER"

class SiteUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None
    status: Optional[str] = None

class SiteResponse(SiteBase):
    id: int
    site_id: str
    region_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SiteOverviewResponse(BaseModel):
    site_id: str
    name: str
    code: str
    status: str
    total_bops: int
    total_cameras: int
    online_cameras: int
    offline_cameras: int
    degraded_cameras: int
    active_incidents: int
    critical_alerts: int
    current_risk: int
    forecast_risk: str
    system_health: float
    system_health_status: str
    edge_nodes_count: int
    recent_events_count: int
    bops: List[Dict[str, Any]] = []

# --- BOP Schemas ---
class BOPBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=20)
    description: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: Optional[str] = "ACTIVE" # ACTIVE, INACTIVE, MAINTENANCE, DEGRADED
    operational_priority: Optional[str] = "NORMAL" # CRITICAL, HIGH, NORMAL, LOW

class BOPCreate(BOPBase):
    bop_id: Optional[str] = None
    site_id: str = Field(..., min_length=2, max_length=50)

class BOPUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: Optional[str] = None
    operational_priority: Optional[str] = None

class BOPResponse(BOPBase):
    id: int
    bop_id: str
    site_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BOPOverviewResponse(BaseModel):
    bop_id: str
    site_id: str
    name: str
    code: str
    status: str
    operational_priority: str
    total_cameras: int
    online_cameras: int
    offline_cameras: int
    edge_nodes_count: int
    zones_count: int
    active_incidents: int
    critical_alerts: int
    current_risk: int
    forecast: str
    system_health: float
    system_health_status: str
    recent_events_count: int

# --- Health & Risk Matrices ---
class SiteHealthMatrixRow(BaseModel):
    site_id: str
    site_name: str
    status: str
    bops_count: int
    total_cameras: int
    online_cameras: int
    offline_cameras: int
    degraded_cameras: int
    active_incidents: int
    current_risk: int
    health_score: float
    health_status: str

class BOPHealthMatrixRow(BaseModel):
    bop_id: str
    bop_name: str
    site_id: str
    status: str
    priority: str
    total_cameras: int
    online_cameras: int
    offline_cameras: int
    active_incidents: int
    current_risk: int
    health_score: float
    health_status: str

# --- Global Central Command Overview ---
class GlobalOverviewResponse(BaseModel):
    total_sites: int
    active_sites: int
    total_bops: int
    total_cameras: int
    online_cameras: int
    offline_cameras: int
    degraded_cameras: int
    active_incidents: int
    critical_alerts: int
    overall_health_score: float
    overall_health_status: str
    forecast_warnings_count: int
    high_risk_bops_count: int
    timestamp: str

# --- Scoped RBAC User Assignment ---
class UserScopeCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    scope_type: str = Field(..., description="GLOBAL, REGION, SITE, BOP")
    scope_id: str = Field(..., description="'*' for GLOBAL, or specific ID")
    role: str = Field(default="SITE_ADMIN", description="SUPER_ADMIN, REGIONAL_ADMIN, SITE_ADMIN, BOP_OPERATOR, ANALYST")

class UserScopeResponse(BaseModel):
    id: int
    username: str
    scope_type: str
    scope_id: str
    role: str
    assigned_by: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Configuration Inheritance & Overrides ---
class ConfigOverrideCreate(BaseModel):
    scope_level: str = Field(..., description="GLOBAL, SITE, BOP, ZONE, CAMERA")
    scope_id: str = Field(..., description="'*' or specific ID")
    config_key: str = Field(..., description="e.g. fps_threshold, tamper_sensitivity")
    config_value_json: str = Field(..., description="JSON serialized value")
    reason: Optional[str] = None

class EffectiveConfigResponse(BaseModel):
    config_key: str
    effective_value: Any
    resolved_from_level: str
    resolved_scope_id: str
    inheritance_chain: List[Dict[str, Any]] = []

# --- Global Search ---
class GlobalSearchResultItem(BaseModel):
    entity_type: str # SITE, BOP, CAMERA, INCIDENT, EVENT, TRACK
    entity_id: str
    name_or_title: str
    site_id: str
    bop_name: Optional[str] = None
    status: Optional[str] = None
    risk_or_severity: Optional[str] = None
    timestamp: Optional[str] = None
    details: Dict[str, Any] = {}

class GlobalSearchResponse(BaseModel):
    query: str
    total_matches: int
    results: List[GlobalSearchResultItem]

# --- Multi-Site Reports ---
class MultiSiteReportResponse(BaseModel):
    report_scope: str
    scope_id: str
    generated_at: str
    summary: Dict[str, Any]
    site_breakdown: List[Dict[str, Any]]
    bop_breakdown: List[Dict[str, Any]]
    incident_statistics: Dict[str, Any]
    health_metrics: Dict[str, Any]
