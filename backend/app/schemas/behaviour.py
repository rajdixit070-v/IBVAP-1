from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class RiskFactorItem(BaseModel):
    factor: str
    weight: int
    description: str

class CounterSignalItem(BaseModel):
    signal: str
    mitigation: int
    description: str

class ExplainableRiskResponse(BaseModel):
    risk_score: int
    decayed_risk_score: int
    risk_level: str
    confidence: float
    factors: List[RiskFactorItem] = []
    counter_factors: List[CounterSignalItem] = []
    decay_explanation: Optional[str] = None

class BehaviourEventResponse(BaseModel):
    id: int
    event_id: str
    global_track_id: Optional[str] = None
    camera_id: str
    local_track_id: Optional[int] = None
    object_type: str
    event_type: str
    risk_score: int
    decayed_risk_score: int
    risk_level: str
    confidence: float
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    factors: List[RiskFactorItem] = []
    counter_factors: List[CounterSignalItem] = []
    details: Dict[str, Any] = {}
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BehaviourEventUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class BehaviourRuleBase(BaseModel):
    rule_id: str
    name: str
    description: Optional[str] = None
    event_type: str
    is_enabled: bool = True
    dwell_threshold_sec: float = 30.0
    stop_count_threshold: int = 3
    speed_threshold_ms: float = 4.5
    direction_change_threshold: int = 3
    after_hours_start: str = "22:00"
    after_hours_end: str = "05:00"
    base_risk_weight: int = 25
    max_risk_cap: int = 40
    cooldown_sec: int = 60

class BehaviourRuleCreate(BehaviourRuleBase):
    pass

class BehaviourRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_enabled: Optional[bool] = None
    dwell_threshold_sec: Optional[float] = None
    stop_count_threshold: Optional[int] = None
    speed_threshold_ms: Optional[float] = None
    direction_change_threshold: Optional[int] = None
    after_hours_start: Optional[str] = None
    after_hours_end: Optional[str] = None
    base_risk_weight: Optional[int] = None
    max_risk_cap: Optional[int] = None
    cooldown_sec: Optional[int] = None
    changed_by: Optional[str] = "admin"

class BehaviourRuleResponse(BehaviourRuleBase):
    id: int
    rule_version: int
    changed_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ActivityBaselineResponse(BaseModel):
    id: int
    camera_id: str
    zone_id: Optional[str] = None
    hour_of_day: int
    expected_person_count: float
    expected_vehicle_count: float
    expected_dwell_sec: float
    expected_speed_ms: float
    density_std_dev: float
    samples_count: int
    version: int
    updated_at: datetime

    class Config:
        from_attributes = True

class ActivityBaselineUpdate(BaseModel):
    expected_person_count: Optional[float] = None
    expected_vehicle_count: Optional[float] = None
    expected_dwell_sec: Optional[float] = None
    expected_speed_ms: Optional[float] = None
    density_std_dev: Optional[float] = None

class BehaviourFeedbackCreate(BaseModel):
    event_id: str
    feedback_type: str = Field(..., description="CORRECT_DETECTION, FALSE_POSITIVE, NEEDS_REVIEW")
    notes: Optional[str] = None
    operator_username: Optional[str] = "operator"

class BehaviourFeedbackResponse(BaseModel):
    id: int
    event_id: str
    feedback_type: str
    operator_username: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BehaviourAnalyticsSummary(BaseModel):
    total_behaviour_events: int = 0
    elevated_risk_events: int = 0
    repeated_approaches_count: int = 0
    route_anomalies_count: int = 0
    active_rules_count: int = 0
    false_positive_rate_percent: float = 0.0
    confirmed_events_count: int = 0
