import json
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.early_warning import EarlyWarning
from app.models.baseline_shift import BaselineShift
from app.models.model_health import ModelHealth
from app.models.prediction_feedback import PredictionFeedback
from app.schemas.predictive import (
    ActivityTimeSeriesResponse,
    ForecastResponse,
    EarlyWarningResponse,
    EarlyWarningUpdate,
    HotspotZoneResponse,
    RecommendedAttentionResponse,
    BaselineShiftResponse,
    BaselineShiftApprove,
    ModelHealthResponse,
    PredictionFeedbackCreate,
    PredictionFeedbackResponse
)
from app.services.predictive.time_series_engine import time_series_engine
from app.services.predictive.predictive_service import predictive_service
from app.services.predictive.early_warning_service import early_warning_service
from app.services.predictive.hotspot_analyzer import hotspot_analyzer

router = APIRouter()

# --- Time-Series Activity ---

@router.get("/activity", response_model=ActivityTimeSeriesResponse)
def get_activity_time_series(
    target_type: str = Query("camera", description="camera, zone, site"),
    target_id: str = Query("CAM-001"),
    window_minutes: int = Query(15, ge=5, le=1440),
    history_points: int = Query(12, ge=4, le=48),
    current_user: User = Depends(get_current_user)
):
    """
    Returns aggregated activity time-series data with expected baseline and confidence bands.
    """
    points, trend, slope = time_series_engine.aggregate_activity(
        target_type=target_type,
        target_id=target_id,
        window_minutes=window_minutes,
        history_points=history_points
    )
    return ActivityTimeSeriesResponse(
        target_type=target_type,
        target_id=target_id,
        window_minutes=window_minutes,
        points=points,
        trend=trend,
        trend_slope=slope
    )

# --- Short-Term Anomaly Forecast ---

@router.get("/forecast", response_model=ForecastResponse)
def get_activity_forecast(
    target_type: str = Query("camera", description="camera, zone, site"),
    target_id: str = Query("CAM-001"),
    horizon_minutes: int = Query(60, ge=15, le=360),
    current_user: User = Depends(get_current_user)
):
    """
    Generates short-term predictive forecast with confidence, range uncertainty, and explainable drivers.
    """
    forecast_data = predictive_service.get_forecast(
        target_type=target_type,
        target_id=target_id,
        forecast_horizon_minutes=horizon_minutes
    )
    return ForecastResponse(**forecast_data)

# --- Early Warnings Feed ---

@router.get("/warnings", response_model=List[EarlyWarningResponse])
def list_early_warnings(
    warning_level: Optional[str] = Query(None),
    lifecycle_status: Optional[str] = Query(None),
    camera_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List early warnings with status and severity filters.
    """
    query = db.query(EarlyWarning)
    if warning_level:
        query = query.filter(EarlyWarning.warning_level == warning_level)
    if lifecycle_status:
        query = query.filter(EarlyWarning.lifecycle_status == lifecycle_status)
    if camera_id:
        query = query.filter(EarlyWarning.camera_id == camera_id)

    records = query.order_by(EarlyWarning.created_at.desc()).limit(limit).all()
    results = []
    for r in records:
        reasons = json.loads(r.reasons_json or "[]")
        counters = json.loads(r.counter_signals_json or "[]")
        results.append(
            EarlyWarningResponse(
                id=r.id,
                warning_id=r.warning_id,
                warning_level=r.warning_level,
                lifecycle_status=r.lifecycle_status,
                camera_id=r.camera_id,
                zone_id=r.zone_id,
                zone_name=r.zone_name,
                site_id=r.site_id,
                forecast_risk_score=r.forecast_risk_score,
                current_risk_score=r.current_risk_score,
                confidence=r.confidence,
                data_quality_score=r.data_quality_score,
                current_activity_count=r.current_activity_count,
                baseline_expected_count=r.baseline_expected_count,
                deviation_percent=r.deviation_percent,
                trend=r.trend,
                forecast_horizon_minutes=r.forecast_horizon_minutes,
                reasons=reasons,
                counter_signals=counters,
                acknowledged_by=r.acknowledged_by,
                acknowledged_at=r.acknowledged_at,
                notes=r.notes,
                expires_at=r.expires_at,
                created_at=r.created_at,
                updated_at=r.updated_at
            )
        )
    return results

@router.post("/warnings/{warning_id}/acknowledge", response_model=EarlyWarningResponse)
def acknowledge_early_warning(
    warning_id: str,
    body: EarlyWarningUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Acknowledge an active early warning.
    """
    ew = early_warning_service.acknowledge_warning(warning_id, username=current_user.username)
    if not ew:
        raise HTTPException(status_code=404, detail="Early warning not found.")

    return EarlyWarningResponse(
        id=ew.id,
        warning_id=ew.warning_id,
        warning_level=ew.warning_level,
        lifecycle_status=ew.lifecycle_status,
        camera_id=ew.camera_id,
        zone_id=ew.zone_id,
        zone_name=ew.zone_name,
        site_id=ew.site_id,
        forecast_risk_score=ew.forecast_risk_score,
        current_risk_score=ew.current_risk_score,
        confidence=ew.confidence,
        data_quality_score=ew.data_quality_score,
        current_activity_count=ew.current_activity_count,
        baseline_expected_count=ew.baseline_expected_count,
        deviation_percent=ew.deviation_percent,
        trend=ew.trend,
        forecast_horizon_minutes=ew.forecast_horizon_minutes,
        reasons=json.loads(ew.reasons_json or "[]"),
        counter_signals=json.loads(ew.counter_signals_json or "[]"),
        acknowledged_by=ew.acknowledged_by,
        acknowledged_at=ew.acknowledged_at,
        notes=ew.notes,
        expires_at=ew.expires_at,
        created_at=ew.created_at,
        updated_at=ew.updated_at
    )

@router.post("/warnings/{warning_id}/dismiss", response_model=EarlyWarningResponse)
def dismiss_early_warning(
    warning_id: str,
    body: EarlyWarningUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Dismiss an early warning with operator notes.
    """
    ew = early_warning_service.dismiss_warning(
        warning_id,
        username=current_user.username,
        notes=body.notes or ""
    )
    if not ew:
        raise HTTPException(status_code=404, detail="Early warning not found.")

    return EarlyWarningResponse(
        id=ew.id,
        warning_id=ew.warning_id,
        warning_level=ew.warning_level,
        lifecycle_status=ew.lifecycle_status,
        camera_id=ew.camera_id,
        zone_id=ew.zone_id,
        zone_name=ew.zone_name,
        site_id=ew.site_id,
        forecast_risk_score=ew.forecast_risk_score,
        current_risk_score=ew.current_risk_score,
        confidence=ew.confidence,
        data_quality_score=ew.data_quality_score,
        current_activity_count=ew.current_activity_count,
        baseline_expected_count=ew.baseline_expected_count,
        deviation_percent=ew.deviation_percent,
        trend=ew.trend,
        forecast_horizon_minutes=ew.forecast_horizon_minutes,
        reasons=json.loads(ew.reasons_json or "[]"),
        counter_signals=json.loads(ew.counter_signals_json or "[]"),
        acknowledged_by=ew.acknowledged_by,
        acknowledged_at=ew.acknowledged_at,
        notes=ew.notes,
        expires_at=ew.expires_at,
        created_at=ew.created_at,
        updated_at=ew.updated_at
    )

# --- Hotspot Analysis ---

@router.get("/hotspots", response_model=List[HotspotZoneResponse])
def get_security_hotspots(current_user: User = Depends(get_current_user)):
    """
    Returns spatial security and activity hotspots across registered sectors and zones.
    """
    return hotspot_analyzer.analyze_zone_hotspots()

# --- Predictive Camera Prioritization ---

@router.get("/recommended-attention", response_model=RecommendedAttentionResponse)
def get_recommended_camera_attention(current_user: User = Depends(get_current_user)):
    """
    Returns prioritized camera recommendations based on active incidents and anomaly trends.
    """
    items = predictive_service.get_recommended_attention()
    return RecommendedAttentionResponse(
        generated_at=datetime.utcnow(),
        recommendations=items
    )

# --- Baseline Shift Review ---

@router.get("/baseline-shifts", response_model=List[BaselineShiftResponse])
def list_baseline_shifts(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List detected baseline shifts requiring administrative review.
    """
    query = db.query(BaselineShift)
    if status:
        query = query.filter(BaselineShift.status == status)
    return query.order_by(BaselineShift.detected_at.desc()).all()

@router.post("/baseline-shifts/{shift_id}/approve", response_model=BaselineShiftResponse)
def approve_or_reject_baseline_shift(
    shift_id: str,
    body: BaselineShiftApprove,
    current_user: User = Depends(require_admin)
):
    """
    Admin approval or rejection of detected baseline shift (Admin only).
    """
    shift = early_warning_service.approve_baseline_shift(
        shift_id=shift_id,
        approve=body.approve,
        reviewed_by=current_user.username,
        notes=body.notes
    )
    if not shift:
        raise HTTPException(status_code=404, detail="Baseline shift not found.")
    return shift

# --- Model Health & Feedback ---

@router.get("/model-health", response_model=ModelHealthResponse)
def get_model_health(current_user: User = Depends(get_current_user)):
    """
    Returns predictive model status, error metrics (MAE/RMSE), and data quality telemetry.
    """
    return predictive_service.get_or_create_model_health()

@router.post("/feedback", response_model=PredictionFeedbackResponse, status_code=201)
def submit_prediction_feedback(
    body: PredictionFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit operator feedback on early warnings and forecasts.
    """
    fb = PredictionFeedback(
        feedback_id=f"PFB-{uuid.uuid4().hex[:6].upper()}",
        warning_id=body.warning_id,
        feedback_type=body.feedback_type,
        operator_username=current_user.username,
        notes=body.notes,
        created_at=datetime.utcnow()
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return fb
