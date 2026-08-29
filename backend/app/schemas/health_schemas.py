from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class HealthContributorItem(BaseModel):
    name: str
    score: float # 0 to 100
    weight: float # percentage e.g. 0.25
    status: str # HEALTHY, DEGRADED, WARNING, CRITICAL
    description: str

class SystemHealthSummaryResponse(BaseModel):
    overall_score: float # 0 to 100
    status: str # HEALTHY, DEGRADED, WARNING, CRITICAL
    status_label: str
    contributors: List[HealthContributorItem]
    active_critical_issues: int
    active_warnings: int
    calculated_at: datetime

class CameraHealthItem(BaseModel):
    camera_id: str
    camera_name: str
    bop_site: str
    sector: str
    status: str # ONLINE, DEGRADED, OFFLINE, UNKNOWN, MAINTENANCE
    priority: str # CRITICAL, HIGH, NORMAL, LOW
    actual_fps: float
    expected_fps: float
    fps_degraded: bool
    frame_drops: int
    stream_latency_ms: float
    latency_classification: str # NORMAL, ELEVATED, HIGH
    resolution: Optional[str] = None
    bitrate_kbps: float
    uptime_seconds: float
    reconnect_count: int
    health_score: float
    
    # Image Quality
    image_quality_score: float
    blur_score: float
    brightness_score: float
    contrast_score: float
    low_light_confidence: float
    quality_classification: str # GOOD, ACCEPTABLE, POOR
    
    # Tampering & Obstruction
    tampering_detected: bool
    tampering_reason: Optional[str] = None
    
    # Maintenance
    is_maintenance: bool
    maintenance_reason: Optional[str] = None
    
    last_seen_at: Optional[datetime] = None

class EdgeNodeHealthItem(BaseModel):
    node_id: str
    name: str
    bop_site: str
    status: str # ONLINE, DEGRADED, OFFLINE, MAINTENANCE
    cpu_percent: float
    memory_percent: float
    gpu_percent: float
    disk_percent: float
    temperature_celsius: Optional[float] = None
    active_cameras_count: int
    total_cameras_count: int
    affected_cameras: List[str] = []
    queued_events_count: int
    sync_status: str
    latency_ms: float
    heartbeat_age_seconds: float
    is_unresponsive: bool
    low_bandwidth_mode: bool
    last_heartbeat: Optional[datetime] = None

class ServiceDependencyItem(BaseModel):
    service_name: str
    component_type: str # API, AI_ENGINE, DATABASE, STORAGE, WEBSOCKET, QUEUE
    status: str # HEALTHY, DEGRADED, OFFLINE
    latency_ms: float
    last_successful_operation: datetime
    error_rate_percent: float
    details: Optional[str] = None

class NetworkHealthSummary(BaseModel):
    status: str # GOOD, DEGRADED, POOR, OFFLINE
    average_latency_ms: float
    packet_loss_percent: float
    bandwidth_utilization_mbps: float
    low_bandwidth_mode_active: bool
    affected_nodes: List[str] = []
    active_degradations: int

class StorageHealthSummary(BaseModel):
    total_gb: float
    used_gb: float
    available_gb: float
    used_percent: float
    status: str # NORMAL, WARNING, CRITICAL
    evidence_storage_gb: float
    database_size_mb: float
    temp_files_mb: float
    retention_days: int
    estimated_days_remaining: int
    growth_rate_gb_per_day: float
    oldest_evidence_date: Optional[datetime] = None

class QueueHealthItem(BaseModel):
    queue_name: str # event_processing, ai_processing, alert_processing, synchronization, evidence_processing
    queue_depth: int
    processing_rate_per_sec: float
    oldest_item_age_seconds: float
    failure_count: int
    status: str # HEALTHY, DEGRADED, BACKLOG
    estimated_delay_seconds: float

class ModelHealthItem(BaseModel):
    model_name: str
    model_version: str
    status: str # HEALTHY, DEGRADED, FAILED
    inference_fps: float
    avg_latency_ms: float
    error_rate_percent: float
    data_quality_score: float
    confidence_avg: float
    last_execution: datetime
    affected_cameras: List[str] = []

class DiagnosticRecommendation(BaseModel):
    action_type: str # CHECK_CONNECTIVITY, CHECK_CREDENTIALS, INSPECT_NETWORK, REBOOT_RECOMMENDED, REVIEW_CAPACITY
    recommendation: str
    priority: str # CRITICAL, HIGH, MEDIUM, LOW

class DiagnosticResultItem(BaseModel):
    diagnostic_id: str
    event_type: str # e.g. EDGE_NODE_UNRESPONSIVE, NETWORK_DEGRADATION, CAMERA_STREAM_DEGRADATION
    severity: str # CRITICAL, HIGH, MEDIUM, LOW
    what_happened: str
    affected_components: List[str]
    possible_root_cause: str # "POSSIBLE ROOT CAUSE"
    confidence_percent: float # 0 to 100
    evidence_signals: List[str]
    recommendations: List[DiagnosticRecommendation]
    detected_at: datetime
    incident_id: Optional[str] = None

class HealthEventItem(BaseModel):
    id: int
    event_id: str
    event_type: str
    source_type: str
    source_id: str
    severity: str
    status: str # DETECTED, ACKNOWLEDGED, INVESTIGATING, RECOVERED, RESOLVED
    title: str
    description: Optional[str] = None
    started_at: datetime
    detected_at: datetime
    recovered_at: Optional[datetime] = None
    downtime_seconds: float
    incident_id: Optional[str] = None

class MaintenanceWindowCreate(BaseModel):
    target_type: str = Field(..., description="CAMERA, EDGE_NODE, SERVICE")
    target_id: str
    reason: str
    authorized_by: Optional[str] = "admin"
    duration_minutes: int = 60

class MaintenanceWindowResponse(BaseModel):
    id: int
    maintenance_id: str
    target_type: str
    target_id: str
    reason: str
    authorized_by: str
    status: str
    started_at: datetime
    expected_end_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class HealthConfigUpdate(BaseModel):
    heartbeat_timeout_seconds: Optional[int] = None
    fps_degradation_ratio: Optional[float] = None # e.g. actual < 0.6 * expected
    stream_latency_elevated_ms: Optional[float] = None
    stream_latency_high_ms: Optional[float] = None
    storage_warning_percent: Optional[float] = None
    storage_critical_percent: Optional[float] = None
    queue_backlog_threshold: Optional[int] = None
    cpu_high_threshold: Optional[float] = None
    memory_high_threshold: Optional[float] = None
    gpu_high_threshold: Optional[float] = None
    notes: Optional[str] = None
    changed_by: Optional[str] = "admin"

class CameraPriorityUpdate(BaseModel):
    priority: str = Field(..., description="CRITICAL, HIGH, NORMAL, LOW")
    reason: Optional[str] = None
    authorized_by: Optional[str] = "admin"
