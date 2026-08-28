from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ActivityTimeSeriesPoint(BaseModel):
    timestamp: datetime
    actual_count: int
    expected_count: float
    lower_bound: float
    upper_bound: float
    is_spike: bool = False
    is_drop: bool = False

class ActivityTimeSeriesResponse(BaseModel):
    target_type: str # "camera", "zone", "site"
    target_id: str
    window_minutes: int
    points: List[ActivityTimeSeriesPoint] = []
    trend: str # "INCREASING", "STABLE", "DECREASING", "VOLATILE"
    trend_slope: float = 0.0

class ForecastDriverItem(BaseModel):
    driver: str
    description: str

class ForecastCounterSignalItem(BaseModel):
    signal: str
    description: str

class ForecastResponse(BaseModel):
    target_type: str # "camera", "zone", "site"
    target_id: str
    forecast_horizon_minutes: int = 60
    forecast_level: str # "LOW", "NORMAL", "ELEVATED", "HIGH"
    expected_activity_count: float
    expected_range_min: float
    expected_range_max: float
    forecast_risk_score: int
    current_risk_score: int
    confidence: float # 0.0 to 1.0
    data_quality_score: float # 0.0 to 1.0
    status: str = "COMPLETED" # "COMPLETED", "INSUFFICIENT_DATA", "INFRASTRUCTURE_DEGRADED"
    reasons: List[ForecastDriverItem] = []
    counter_signals: List[ForecastCounterSignalItem] = []
    model_version: str = "1.0.0"

class EarlyWarningResponse(BaseModel):
    id: int
    warning_id: str
    warning_level: str
    lifecycle_status: str
    camera_id: Optional[str] = None
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    site_id: Optional[str] = None
    forecast_risk_score: int
    current_risk_score: int
    confidence: float
    data_quality_score: float
    current_activity_count: int
    baseline_expected_count: float
    deviation_percent: float
    trend: str
    forecast_horizon_minutes: int
    reasons: List[ForecastDriverItem] = []
    counter_signals: List[ForecastCounterSignalItem] = []
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    notes: Optional[str] = None
    expires_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EarlyWarningUpdate(BaseModel):
    lifecycle_status: Optional[str] = None
    notes: Optional[str] = None
    actor_username: Optional[str] = "operator"

class HotspotZoneResponse(BaseModel):
    zone_id: str
    name: str
    camera_id: str
    bop_site: str
    latitude: float
    longitude: float
    hotspot_level: str # "NORMAL", "WATCH", "ELEVATED", "HIGH"
    activity_density: float # events per km² or relative index
    current_activity: int
    baseline_activity: float
    deviation_percent: float
    risk_score: int
    contributing_factors: List[str] = []

class RecommendedAttentionItem(BaseModel):
    camera_id: str
    camera_name: str
    bop_site: str
    priority: str # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    reason: str
    risk_score: int
    trend: str

class RecommendedAttentionResponse(BaseModel):
    generated_at: datetime
    recommendations: List[RecommendedAttentionItem] = []

class BaselineShiftResponse(BaseModel):
    id: int
    shift_id: str
    camera_id: str
    zone_id: Optional[str] = None
    hour_of_day: int
    old_baseline_value: float
    new_observed_value: float
    deviation_percent: float
    status: str
    detected_at: datetime
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class BaselineShiftApprove(BaseModel):
    approve: bool
    notes: Optional[str] = None
    reviewed_by: Optional[str] = "admin"

class ModelHealthResponse(BaseModel):
    id: int
    model_name: str
    model_version: str
    status: str
    last_trained_at: datetime
    training_data_points: int
    historical_days: int
    data_quality_score: float
    mae_score: float
    rmse_score: float
    confidence_avg: float
    updated_at: datetime

    class Config:
        from_attributes = True

class PredictionFeedbackCreate(BaseModel):
    warning_id: str
    feedback_type: str = Field(..., description="USEFUL_FORECAST, FALSE_PREDICTION, INCONCLUSIVE")
    notes: Optional[str] = None
    operator_username: Optional[str] = "operator"

class PredictionFeedbackResponse(BaseModel):
    id: int
    feedback_id: str
    warning_id: str
    feedback_type: str
    operator_username: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
