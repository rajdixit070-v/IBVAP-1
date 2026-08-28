from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class EdgeNodeBase(BaseModel):
    node_id: str = Field(..., min_length=3, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    bop_site: str = Field(..., min_length=2, max_length=100)
    location: Optional[str] = None
    software_version: str = Field("1.0.0")
    hardware_info: Optional[str] = "NVIDIA Jetson Orin NX"
    low_bandwidth_mode: bool = False

class EdgeNodeCreate(EdgeNodeBase):
    pass

class EdgeNodeUpdate(BaseModel):
    name: Optional[str] = None
    bop_site: Optional[str] = None
    location: Optional[str] = None
    software_version: Optional[str] = None
    hardware_info: Optional[str] = None
    low_bandwidth_mode: Optional[bool] = None
    status: Optional[str] = None

class EdgeNodeResponse(EdgeNodeBase):
    id: int
    status: str
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    gpu_percent: float
    active_cameras_count: int
    total_cameras_count: int
    queued_events_count: int
    sync_status: str
    config_version: int
    latency_ms: float
    last_heartbeat: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EdgeHeartbeatRequest(BaseModel):
    node_id: str
    status: str = "ONLINE"
    cpu_percent: float = 25.0
    memory_percent: float = 40.0
    disk_percent: float = 30.0
    gpu_percent: float = 35.0
    active_cameras_count: int = 0
    total_cameras_count: int = 0
    queued_events_count: int = 0
    config_version: int = 1
    latency_ms: float = 25.0
    low_bandwidth_mode: bool = False

class EdgeSyncEventItem(BaseModel):
    event_id: str
    camera_id: str
    track_id: Optional[int] = 0
    object_type: str = "target"
    event_type: str
    severity: str = "HIGH"
    risk_score: int = 50
    risk_level: str = "MEDIUM"
    priority: str = "MEDIUM" # CRITICAL, HIGH, MEDIUM, LOW
    factors_json: Optional[str] = "[]"
    timeline_json: Optional[str] = "[]"
    timestamp: datetime

class EdgeSyncBatchRequest(BaseModel):
    node_id: str
    events: List[EdgeSyncEventItem] = []
    batch_timestamp: Optional[datetime] = None

class EdgeSyncBatchResponse(BaseModel):
    received_count: int
    synced_ids: List[str]
    duplicate_ids: List[str]
    status: str

class EdgeRemoteConfig(BaseModel):
    low_bandwidth_mode: Optional[bool] = None
    inference_fps: Optional[float] = None
    sync_batch_size: Optional[int] = None
    disk_warning_threshold: Optional[int] = 85
    disk_critical_threshold: Optional[int] = 95

class EdgeSyncStatsResponse(BaseModel):
    total_synced: int = 0
    pending_sync: int = 0
    failed_sync: int = 0
    avg_latency_ms: float = 25.0
    nodes_online: int = 0
    nodes_offline: int = 0
    nodes_degraded: int = 0
