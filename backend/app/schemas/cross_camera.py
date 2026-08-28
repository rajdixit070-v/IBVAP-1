from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class CameraTransitionBase(BaseModel):
    from_camera_id: str
    to_camera_id: str
    min_travel_time_sec: float = 10.0
    expected_travel_time_sec: float = 45.0
    max_travel_time_sec: float = 300.0
    direction: str = "ANY"
    transition_confidence: float = 0.90
    is_enabled: bool = True

class CameraTransitionCreate(CameraTransitionBase):
    pass

class CameraTransitionUpdate(BaseModel):
    min_travel_time_sec: Optional[float] = None
    expected_travel_time_sec: Optional[float] = None
    max_travel_time_sec: Optional[float] = None
    direction: Optional[str] = None
    transition_confidence: Optional[float] = None
    is_enabled: Optional[bool] = None

class CameraTransitionResponse(CameraTransitionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TrackObservationResponse(BaseModel):
    id: int
    observation_id: str
    global_track_id: str
    camera_id: str
    local_track_id: int
    object_type: str
    timestamp: datetime
    bbox_json: str
    direction: str
    plate_number: Optional[str] = None
    plate_confidence: Optional[float] = None
    confidence: float

    class Config:
        from_attributes = True

class TrackAssociationResponse(BaseModel):
    id: int
    association_id: str
    global_track_id: str
    from_observation_id: str
    to_observation_id: str
    from_camera_id: str
    to_camera_id: str
    association_score: float
    match_category: str
    status: str
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TrackAssociationReviewRequest(BaseModel):
    action: str = Field(..., description="'CONFIRM' or 'REJECT'")
    notes: Optional[str] = None
    operator_username: Optional[str] = "operator"

class MovementAnomalyResponse(BaseModel):
    id: int
    anomaly_id: str
    global_track_id: Optional[str] = None
    anomaly_type: str
    from_camera_id: Optional[str] = None
    to_camera_id: Optional[str] = None
    time_delta_sec: Optional[float] = None
    expected_time_sec: Optional[float] = None
    severity: str
    details: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True

class GlobalTrackResponse(BaseModel):
    id: int
    global_track_id: str
    object_type: str
    primary_identifier: Optional[str] = None
    status: str
    current_camera_id: str
    previous_camera_id: Optional[str] = None
    last_observation_time: datetime
    total_observations: int
    overall_confidence: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class GlobalTrackDetailResponse(GlobalTrackResponse):
    observations: List[TrackObservationResponse] = []
    associations: List[TrackAssociationResponse] = []
    anomalies: List[MovementAnomalyResponse] = []

class CrossCameraAnalyticsSummary(BaseModel):
    total_global_tracks: int = 0
    active_global_tracks: int = 0
    vehicle_journeys: int = 0
    movement_anomalies: int = 0
    pending_association_reviews: int = 0
    active_transitions_count: int = 0
