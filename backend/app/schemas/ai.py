from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class BoundingBox(BaseModel):
    x: float = Field(..., description="Top-left x coordinate in pixels")
    y: float = Field(..., description="Top-left y coordinate in pixels")
    width: float = Field(..., description="Box width in pixels")
    height: float = Field(..., description="Box height in pixels")

class Point2D(BaseModel):
    x: float
    y: float

class DetectionResult(BaseModel):
    class_name: str
    category: str               # person, vehicle, animal, drone, other
    confidence: float
    bbox: BoundingBox
    timestamp: datetime
    camera_id: str

class TrackedObject(BaseModel):
    track_id: int
    camera_id: str
    object_type: str
    category: str               # person, vehicle, animal, drone, other
    confidence: float
    bbox: BoundingBox
    center: Point2D
    bottom_center: Point2D
    first_seen_at: datetime
    last_seen_at: datetime
    frame_count: int
    speed: float = 0.0          # Relative image-space movement speed (px/sec)
    direction: str = "UNKNOWN"  # NORTH, SOUTH, EAST, WEST, NORTH_EAST, NORTH_WEST, SOUTH_EAST, SOUTH_WEST, STATIONARY, UNKNOWN
    tracking_state: str = "TRACKING" # DETECTED, TRACKING, TEMPORARILY_LOST, REACQUIRED, EXPIRED
    trajectory: List[Point2D] = []

class CameraAICounters(BaseModel):
    people: int = 0
    vehicles: int = 0
    animals: int = 0
    other: int = 0
    total_tracks: int = 0

class CameraAIStatus(BaseModel):
    camera_id: str
    status: str                 # ACTIVE, STARTING, PAUSED, ERROR, NO_STREAM
    inference_fps: float = 0.0
    latency_ms: float = 0.0
    frames_processed: int = 0
    frames_skipped: int = 0
    active_tracks_count: int = 0
    counters: CameraAICounters
    device: str = "CPU"
    model_name: str = "yolov8n"
    error_message: Optional[str] = None

class CameraAIConfigSchema(BaseModel):
    camera_id: str
    enabled: bool
    model_name: str
    target_fps: float
    input_size: int
    device: str
    conf_person: float
    conf_vehicle: float
    conf_animal: float
    conf_drone: float
    conf_other: float
    track_thresh: float
    match_thresh: float
    max_lost_frames: int
    max_trajectory_length: int

    class Config:
        from_attributes = True

class CameraAIConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    model_name: Optional[str] = None
    target_fps: Optional[float] = None
    conf_person: Optional[float] = None
    conf_vehicle: Optional[float] = None
    conf_animal: Optional[float] = None
    conf_drone: Optional[float] = None
    conf_other: Optional[float] = None
    track_thresh: Optional[float] = None
    match_thresh: Optional[float] = None

class AIRealTimeTelemetryMessage(BaseModel):
    event: str = "AI_DETECTION_TELEMETRY"
    camera_id: str
    timestamp: str
    status: str
    inference_fps: float
    latency_ms: float
    counters: CameraAICounters
    tracks: List[TrackedObject]

class ModelStatusItem(BaseModel):
    model_name: str
    model_path: Optional[str] = None
    configured: bool
    file_exists: bool
    loaded: bool
    status: str  # NOT_CONFIGURED, FILE_MISSING, LOADING, LOADED, ERROR
    error: Optional[str] = None
    capabilities: List[str] = []

class AIModelsOverviewResponse(BaseModel):
    models: List[ModelStatusItem]
    system_ready: bool
