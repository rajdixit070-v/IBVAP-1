from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class SystemRiskConfigSchema(BaseModel):
    weight_restricted_zone: int
    weight_fence_crossing: int
    weight_forbidden_direction: int
    weight_night_movement: int
    weight_loitering: int
    weight_stationary_vehicle: int
    weight_group_movement: int
    weight_rapid_movement: int
    penalty_low_confidence: int

    loitering_duration_sec: float
    stationary_vehicle_duration_sec: float
    group_max_distance_norm: float
    event_cooldown_sec: float

    night_start_hour: int
    night_end_hour: int

    class Config:
        from_attributes = True

class SystemRiskConfigUpdate(BaseModel):
    weight_restricted_zone: Optional[int] = None
    weight_fence_crossing: Optional[int] = None
    weight_forbidden_direction: Optional[int] = None
    weight_night_movement: Optional[int] = None
    weight_loitering: Optional[int] = None
    weight_stationary_vehicle: Optional[int] = None
    weight_group_movement: Optional[int] = None
    weight_rapid_movement: Optional[int] = None
    penalty_low_confidence: Optional[int] = None

    loitering_duration_sec: Optional[float] = None
    stationary_vehicle_duration_sec: Optional[float] = None
    group_max_distance_norm: Optional[float] = None
    event_cooldown_sec: Optional[float] = None

    night_start_hour: Optional[int] = None
    night_end_hour: Optional[int] = None
