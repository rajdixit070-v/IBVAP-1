from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

# --- AI Observation Schemas ---
class AIObservationBase(BaseModel):
    camera_id: str
    site_id: str = "SITE-BORDER-NORTH"
    bop_id: Optional[str] = "BOP-ALPHA"
    zone_id: Optional[str] = None
    track_id: Optional[int] = None
    global_track_id: Optional[str] = None
    observation_type: str # PERSON, VEHICLE, PLATE, FACE, BEHAVIOUR, AUDIO, ZONE_TRANSITION, SPEED, ROUTE
    confidence: float = Field(0.85, ge=0.0, le=1.0)
    confidence_level: str = "HIGH" # HIGH, MEDIUM, LOW
    model_name: str = "yolov8n"
    model_version: str = "v1.0.0"
    bbox_json: Optional[str] = None
    trajectory_json: Optional[str] = None
    vehicle_class: Optional[str] = None
    plate_text: Optional[str] = None
    plate_ocr_confidence: Optional[float] = None
    face_match_status: Optional[str] = None
    face_person_name: Optional[str] = None
    face_match_confidence: Optional[float] = None
    lighting_condition: str = "DAY"
    image_quality_score: float = 1.0
    environmental_data_json: Optional[str] = "{}"
    metadata_json: Optional[str] = "{}"

class AIObservationCreate(AIObservationBase):
    pass

class AIObservationResponse(AIObservationBase):
    id: int
    observation_id: str
    timestamp: datetime

    class Config:
        from_attributes = True


# --- Multimodal Security Event Schemas ---
class MultimodalEventBase(BaseModel):
    title: str
    event_type: str
    site_id: str = "SITE-BORDER-NORTH"
    bop_id: Optional[str] = "BOP-ALPHA"
    bop_name: str = "BOP Alpha"
    primary_camera_id: str
    camera_ids_json: str = "[]"
    zone_ids_json: str = "[]"
    track_ids_json: str = "[]"
    global_track_id: Optional[str] = None
    vehicle_ids_json: str = "[]"
    plate_references_json: str = "[]"
    face_references_json: str = "[]"
    audio_references_json: str = "[]"
    signals_json: str = "[]"
    confidence: float = 0.85
    confidence_level: str = "HIGH"
    risk_score: int = 75
    risk_level: str = "HIGH"
    explanation_json: str = "{}"
    timeline_json: str = "[]"
    graph_json: str = "{}"
    evidence_bundle_json: str = "{}"
    status: str = "DETECTED"
    model_versions_json: str = "{}"

class MultimodalEventCreate(MultimodalEventBase):
    event_group_id: Optional[str] = None

class MultimodalEventResponse(MultimodalEventBase):
    id: int
    event_id: str
    event_group_id: str
    is_cooldown_suppressed: bool
    feedback_label: Optional[str] = None
    feedback_reason: Optional[str] = None
    feedback_by: Optional[str] = None
    feedback_at: Optional[datetime] = None
    event_occurred_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Explainable Timeline & Graph Schemas ---
class EventTimelineItem(BaseModel):
    stage: str # DETECTION, TRACKING, CONTEXT, CORRELATION, RISK, ALERT, INCIDENT
    timestamp: str
    title: str
    description: str
    confidence: Optional[float] = None
    source_component: str
    evidence_ref: Optional[str] = None

class EventGraphNode(BaseModel):
    id: str
    label: str
    node_type: str # CAMERA, TRACK, ZONE, CONTEXT, SIGNAL, ANOMALY, RISK
    status: Optional[str] = None
    confidence: Optional[float] = None
    details: Dict[str, Any] = {}

class EventGraphEdge(BaseModel):
    source: str
    target: str
    relationship: str # OBSERVED_AT, ENTERED, DETECTED_IN, CONTRIBUTES_TO, ESCALATES_TO
    weight: float = 1.0

class EventGraphResponse(BaseModel):
    event_id: str
    title: str
    nodes: List[EventGraphNode]
    edges: List[EventGraphEdge]
    explanation_summary: str


# --- Operator Feedback ---
class OperatorFeedbackCreate(BaseModel):
    label: str # VALID, FALSE_POSITIVE, UNCERTAIN
    reason: Optional[str] = None

class FeedbackAnalyticsResponse(BaseModel):
    total_feedbacks: int
    valid_count: int
    false_positive_count: int
    uncertain_count: int
    false_positive_rate: float
    validation_rate: float
    per_model_stats: Dict[str, Any]
    per_event_type_stats: Dict[str, Any]


# --- AI Model Registry Schemas ---
class AIModelRegistryBase(BaseModel):
    model_name: str
    version: str
    model_type: str # OBJECT_DETECTION, TRACKER, ANPR_OCR, FACE_REID, MULTIMODAL_FUSION, BEHAVIOUR
    status: str = "ACTIVE"
    is_active: bool = True
    deployment_profile: str = "BALANCED" # LOW, BALANCED, HIGH
    precision: float = 0.94
    recall: float = 0.91
    f1_score: float = 0.925
    false_positive_rate: float = 0.04
    false_negative_rate: float = 0.05
    latency_ms: float = 18.5
    error_rate: float = 0.005
    confidence_avg: float = 0.88
    parameters_json: str = "{}"
    notes: Optional[str] = None

class AIModelRegistryCreate(AIModelRegistryBase):
    pass

class AIModelRegistryResponse(AIModelRegistryBase):
    id: int
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Camera AI Profile & Feature Toggles ---
class CameraAIProfileBase(BaseModel):
    camera_id: str
    site_id: str = "SITE-BORDER-NORTH"
    bop_id: str = "BOP-ALPHA"
    profile: str = "BALANCED" # LOW, BALANCED, HIGH
    target_fps: float = 10.0
    human_detection: bool = True
    vehicle_detection: bool = True
    anpr_enabled: bool = True
    face_detection: bool = True
    tracking_enabled: bool = True
    virtual_fence_enabled: bool = True
    behaviour_analytics: bool = True
    anomaly_detection: bool = True
    audio_analytics: bool = False
    loitering_threshold_seconds: int = 180

class CameraAIProfileCreate(CameraAIProfileBase):
    pass

class CameraAIProfileUpdate(BaseModel):
    profile: Optional[str] = None
    target_fps: Optional[float] = None
    human_detection: Optional[bool] = None
    vehicle_detection: Optional[bool] = None
    anpr_enabled: Optional[bool] = None
    face_detection: Optional[bool] = None
    tracking_enabled: Optional[bool] = None
    virtual_fence_enabled: Optional[bool] = None
    behaviour_analytics: Optional[bool] = None
    anomaly_detection: Optional[bool] = None
    audio_analytics: Optional[bool] = None
    loitering_threshold_seconds: Optional[int] = None

class CameraAIProfileResponse(CameraAIProfileBase):
    id: int
    updated_by: str
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Overview & KPI Responses ---
class MultimodalOverviewResponse(BaseModel):
    active_ai_events: int
    high_risk_events: int
    anomalies_count: int
    tracked_unique_objects: int
    vehicle_observations_count: int
    anpr_reads_count: int
    face_events_count: int
    overall_multimodal_health: float
    overall_multimodal_status: str
    false_positive_rate: float
    events_by_type: Dict[str, int]
    events_by_severity: Dict[str, int]
    timestamp: str


# --- Search & Assistant ---
class AISearchRequest(BaseModel):
    q: Optional[str] = None
    event_type: Optional[str] = None
    camera_id: Optional[str] = None
    site_id: Optional[str] = None
    bop_id: Optional[str] = None
    zone_id: Optional[str] = None
    risk_level: Optional[str] = None
    min_confidence: Optional[float] = None
    time_window_hours: Optional[int] = 24
    limit: int = 50

class AIAssistantQueryRequest(BaseModel):
    query: str
    site_id: Optional[str] = None
    bop_id: Optional[str] = None

class AIAssistantResponse(BaseModel):
    query: str
    parsed_filters: Dict[str, Any]
    explanation: str
    cited_event_ids: List[str]
    cited_camera_ids: List[str]
    results: List[MultimodalEventResponse]
    safety_notice: str


# --- Flow Analytics & Heatmaps ---
class HeatmapPoint(BaseModel):
    x: float
    y: float
    intensity: float
    zone_id: Optional[str] = None
    label: Optional[str] = None

class HeatmapDataResponse(BaseModel):
    camera_id: Optional[str] = None
    site_id: str
    time_frame: str # hour, day, week, month
    total_data_points: int
    activity_points: List[HeatmapPoint]
    anomaly_points: List[HeatmapPoint]
    baseline_deviation_percentage: float

class FlowAnalyticsResponse(BaseModel):
    camera_id: Optional[str] = None
    bop_id: Optional[str] = None
    time_range_hours: int
    total_persons_detected: int
    estimated_unique_persons: int
    person_entries: int
    person_exits: int
    vehicles_per_hour: float
    total_vehicles: int
    vehicle_classes_breakdown: Dict[str, int]
    direction_flow_breakdown: Dict[str, int]
