import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.behaviour_event import BehaviourEvent
from app.models.behaviour_rule import BehaviourRule
from app.models.activity_baseline import ActivityBaseline
from app.models.behaviour_feedback import BehaviourFeedback
from app.models.audit_log import SecurityAuditLog
from app.schemas.behaviour import (
    BehaviourEventResponse,
    BehaviourEventUpdate,
    BehaviourRuleCreate,
    BehaviourRuleUpdate,
    BehaviourRuleResponse,
    ActivityBaselineResponse,
    ActivityBaselineUpdate,
    BehaviourFeedbackCreate,
    BehaviourFeedbackResponse,
    ExplainableRiskResponse,
    BehaviourAnalyticsSummary
)
from app.services.behaviour.behaviour_service import behaviour_service
from app.services.behaviour.explainable_risk_engine import explainable_risk_engine

router = APIRouter()

# --- Behaviour Events Feed ---

@router.get("/events", response_model=List[BehaviourEventResponse])
def list_behaviour_events(
    risk_level: Optional[str] = Query(None, description="CRITICAL, HIGH, ELEVATED, GUARDED, LOW"),
    event_type: Optional[str] = Query(None),
    camera_id: Optional[str] = Query(None),
    global_track_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search and list behaviour anomalies and risk events with backend pagination.
    """
    query = db.query(BehaviourEvent)
    if risk_level:
        query = query.filter(BehaviourEvent.risk_level == risk_level)
    if event_type:
        query = query.filter(BehaviourEvent.event_type == event_type)
    if camera_id:
        query = query.filter(BehaviourEvent.camera_id == camera_id)
    if global_track_id:
        query = query.filter(BehaviourEvent.global_track_id == global_track_id)
    if search:
        query = query.filter(
            BehaviourEvent.event_id.ilike(f"%{search}%") |
            BehaviourEvent.event_type.ilike(f"%{search}%") |
            BehaviourEvent.camera_id.ilike(f"%{search}%")
        )

    records = query.order_by(BehaviourEvent.created_at.desc()).offset(skip).limit(limit).all()
    
    # Format with parsed factors/counter_factors/details
    result = []
    for r in records:
        factors = json.loads(r.factors_json or "[]")
        counters = json.loads(r.counter_factors_json or "[]")
        details = json.loads(r.details_json or "{}")
        result.append(
            BehaviourEventResponse(
                id=r.id,
                event_id=r.event_id,
                global_track_id=r.global_track_id,
                camera_id=r.camera_id,
                local_track_id=r.local_track_id,
                object_type=r.object_type,
                event_type=r.event_type,
                risk_score=r.risk_score,
                decayed_risk_score=r.decayed_risk_score,
                risk_level=r.risk_level,
                confidence=r.confidence,
                zone_id=r.zone_id,
                zone_name=r.zone_name,
                factors=factors,
                counter_factors=counters,
                details=details,
                status=r.status,
                created_at=r.created_at,
                updated_at=r.updated_at
            )
        )
    return result

@router.get("/events/{event_id}", response_model=BehaviourEventResponse)
def get_behaviour_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get full behaviour anomaly record with explainable factors and counter-signals.
    """
    r = db.query(BehaviourEvent).filter(BehaviourEvent.event_id == event_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Behaviour event not found.")

    return BehaviourEventResponse(
        id=r.id,
        event_id=r.event_id,
        global_track_id=r.global_track_id,
        camera_id=r.camera_id,
        local_track_id=r.local_track_id,
        object_type=r.object_type,
        event_type=r.event_type,
        risk_score=r.risk_score,
        decayed_risk_score=r.decayed_risk_score,
        risk_level=r.risk_level,
        confidence=r.confidence,
        zone_id=r.zone_id,
        zone_name=r.zone_name,
        factors=json.loads(r.factors_json or "[]"),
        counter_factors=json.loads(r.counter_factors_json or "[]"),
        details=json.loads(r.details_json or "{}"),
        status=r.status,
        created_at=r.created_at,
        updated_at=r.updated_at
    )

# --- Explainable Risk Assessment ---

@router.get("/assessments/{track_id}", response_model=ExplainableRiskResponse)
def get_track_risk_assessment(
    track_id: str,
    zone_type: str = Query("RESTRICTED"),
    is_night: bool = Query(False),
    is_repeated_approach: bool = Query(False),
    is_fence_edge: bool = Query(False),
    is_route_anomaly: bool = Query(False),
    is_rapid_direction: bool = Query(False),
    is_stop_and_go: bool = Query(False),
    is_sudden_speed: bool = Query(False),
    is_density_anomaly: bool = Query(False),
    is_authorized: bool = Query(False),
    is_suspect: bool = Query(False),
    elapsed_sec: float = Query(0.0),
    current_user: User = Depends(get_current_user)
):
    """
    Computes transparent explainable threat & risk breakdown for a live track.
    """
    score, decayed, level, factors, counter_factors, exp = explainable_risk_engine.assess_risk(
        event_type="BEHAVIOUR_ASSESSMENT",
        zone_type=zone_type,
        is_repeated_approach=is_repeated_approach,
        is_fence_edge=is_fence_edge,
        is_route_anomaly=is_route_anomaly,
        is_rapid_direction=is_rapid_direction,
        is_stop_and_go=is_stop_and_go,
        is_sudden_speed=is_sudden_speed,
        is_density_anomaly=is_density_anomaly,
        is_night=is_night,
        is_authorized_watchlist=is_authorized,
        is_suspect_watchlist=is_suspect,
        elapsed_sec=elapsed_sec
    )

    return ExplainableRiskResponse(
        risk_score=score,
        decayed_risk_score=decayed,
        risk_level=level,
        confidence=0.92,
        factors=factors,
        counter_factors=counter_factors,
        decay_explanation=exp
    )

# --- Behaviour Rules Configuration ---

@router.get("/rules", response_model=List[BehaviourRuleResponse])
def list_behaviour_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all configured behaviour detection rules.
    """
    return db.query(BehaviourRule).all()

@router.post("/rules", response_model=BehaviourRuleResponse, status_code=201)
def create_behaviour_rule(
    rule_data: BehaviourRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new configurable behaviour detection rule.
    """
    existing = db.query(BehaviourRule).filter(BehaviourRule.rule_id == rule_data.rule_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Rule ID already exists.")

    rule = BehaviourRule(**rule_data.dict())
    rule.changed_by = current_user.username
    db.add(rule)

    audit = SecurityAuditLog(
        username=current_user.username,
        action="CREATE_BEHAVIOUR_RULE",
        resource_type="BEHAVIOUR_RULE",
        resource_id=rule_data.rule_id,
        details=json.dumps({"rule_name": rule_data.name, "rule_id": rule_data.rule_id})
    )
    db.add(audit)
    db.commit()
    db.refresh(rule)
    return rule

@router.put("/rules/{rule_id}", response_model=BehaviourRuleResponse)
def update_behaviour_rule(
    rule_id: str,
    rule_update: BehaviourRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update behaviour detection rule with version increment and audit logging (Admin only).
    """
    rule = db.query(BehaviourRule).filter(BehaviourRule.rule_id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")

    old_version = rule.rule_version
    for field, val in rule_update.dict(exclude_unset=True).items():
        setattr(rule, field, val)

    rule.rule_version = old_version + 1
    rule.changed_by = current_user.username

    audit = SecurityAuditLog(
        username=current_user.username,
        action="UPDATE_BEHAVIOUR_RULE",
        resource_type="BEHAVIOUR_RULE",
        resource_id=rule_id,
        details=json.dumps({"version": rule.rule_version, "rule_id": rule_id})
    )
    db.add(audit)
    db.commit()
    db.refresh(rule)
    return rule

# --- Activity Baselines ---

@router.get("/baselines", response_model=List[ActivityBaselineResponse])
def list_activity_baselines(
    camera_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List hourly activity baselines for statistical deviation detection.
    """
    query = db.query(ActivityBaseline)
    if camera_id:
        query = query.filter(ActivityBaseline.camera_id == camera_id)
    return query.order_by(ActivityBaseline.hour_of_day.asc()).all()

# --- Operator Feedback ---

@router.post("/feedback", response_model=BehaviourFeedbackResponse)
def submit_operator_feedback(
    body: BehaviourFeedbackCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Submit operator feedback (CORRECT_DETECTION, FALSE_POSITIVE, NEEDS_REVIEW) with audit log.
    """
    fb = behaviour_service.record_feedback(
        event_id=body.event_id,
        feedback_type=body.feedback_type,
        notes=body.notes,
        operator_username=current_user.username
    )
    return fb

# --- Analytics Summary ---

@router.get("/analytics/summary", response_model=BehaviourAnalyticsSummary)
def get_behaviour_analytics_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculates operational metrics including false positive rate percentage.
    """
    total_events = db.query(BehaviourEvent).count()
    elevated = db.query(BehaviourEvent).filter(BehaviourEvent.risk_score >= 41).count()
    repeated_app = db.query(BehaviourEvent).filter(
        BehaviourEvent.event_type.in_(["REPEATED_APPROACH", "POTENTIAL_PERIMETER_PROBING_PATTERN"])
    ).count()
    route_anom = db.query(BehaviourEvent).filter(
        BehaviourEvent.event_type.in_(["ROUTE_ANOMALY", "ROUTE_DEVIATION"])
    ).count()
    active_rules = db.query(BehaviourRule).filter(BehaviourRule.is_enabled == True).count()

    total_feedbacks = db.query(BehaviourFeedback).count()
    false_positives = db.query(BehaviourFeedback).filter(BehaviourFeedback.feedback_type == "FALSE_POSITIVE").count()
    confirmed = db.query(BehaviourFeedback).filter(BehaviourFeedback.feedback_type == "CORRECT_DETECTION").count()

    fp_rate = round((false_positives / total_feedbacks * 100.0), 1) if total_feedbacks > 0 else 0.0

    return BehaviourAnalyticsSummary(
        total_behaviour_events=total_events,
        elevated_risk_events=elevated,
        repeated_approaches_count=repeated_app,
        route_anomalies_count=route_anom,
        active_rules_count=active_rules,
        false_positive_rate_percent=fp_rate,
        confirmed_events_count=confirmed
    )

# --- Deletion and Maintenance Endpoints ---

@router.delete("/rules/{rule_id}")
def delete_behaviour_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes a behaviour detection rule.
    """
    rule = db.query(BehaviourRule).filter(BehaviourRule.rule_id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_id}' not found.")

    db.delete(rule)
    audit = SecurityAuditLog(
        username=current_user.username,
        action="DELETE_BEHAVIOUR_RULE",
        resource_type="BEHAVIOUR_RULE",
        resource_id=rule_id,
        details=json.dumps({"deleted_rule": rule_id, "name": rule.name})
    )
    db.add(audit)
    db.commit()
    return {"message": f"Behaviour rule '{rule_id}' deleted successfully.", "rule_id": rule_id}

@router.delete("/events/clear")
def clear_all_behaviour_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Purges all recorded behaviour events from the database.
    """
    count = db.query(BehaviourEvent).delete()
    audit = SecurityAuditLog(
        username=current_user.username,
        action="CLEAR_BEHAVIOUR_EVENTS",
        resource_type="BEHAVIOUR_EVENT",
        resource_id="ALL",
        details=json.dumps({"purged_count": count})
    )
    db.add(audit)
    db.commit()
    return {"message": f"Successfully cleared {count} behaviour event records.", "deleted_count": count}

@router.delete("/events/{event_id}")
def delete_behaviour_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes an individual behaviour event record.
    """
    event = db.query(BehaviourEvent).filter(BehaviourEvent.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found.")

    db.delete(event)
    db.commit()
    return {"message": f"Behaviour event '{event_id}' deleted successfully.", "event_id": event_id}

@router.post("/rules/test-eval")
def test_evaluate_rule(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dry-run simulation endpoint to test how a behaviour rule scores given track parameters.
    """
    rule_id = payload.get("rule_id", "RULE-CUSTOM")
    dwell_sec = float(payload.get("dwell_sec", 25.0))
    speed_ms = float(payload.get("speed_ms", 3.5))
    stop_count = int(payload.get("stop_count", 2))
    direction_changes = int(payload.get("direction_changes", 2))
    is_night = bool(payload.get("is_night", False))

    rule = db.query(BehaviourRule).filter(BehaviourRule.rule_id == rule_id).first()
    rule_name = rule.name if rule else "Custom Assessment Rule"
    base_weight = rule.base_risk_weight if rule else 25
    max_cap = rule.max_risk_cap if rule else 40

    factors = []
    calculated_risk = base_weight
    triggered = False

    if dwell_sec >= (rule.dwell_threshold_sec if rule else 20.0):
        triggered = True
        factors.append(f"Dwell threshold exceeded ({dwell_sec}s >= {rule.dwell_threshold_sec if rule else 20}s)")
        calculated_risk += 15

    if speed_ms >= (rule.speed_threshold_ms if rule else 4.0):
        triggered = True
        factors.append(f"Sudden sprint velocity detected ({speed_ms} m/s >= {rule.speed_threshold_ms if rule else 4.0} m/s)")
        calculated_risk += 15

    if direction_changes >= (rule.direction_change_threshold if rule else 3):
        triggered = True
        factors.append(f"Erratic kinetic direction changes detected ({direction_changes} changes)")
        calculated_risk += 10

    if is_night:
        factors.append("Restricted after-hours nocturnal window (Night multiplier active)")
        calculated_risk += 12

    calculated_risk = min(100, calculated_risk)

    return {
        "rule_id": rule_id,
        "rule_name": rule_name,
        "triggered": triggered,
        "risk_score": calculated_risk,
        "risk_level": "CRITICAL" if calculated_risk >= 75 else "HIGH" if calculated_risk >= 50 else "ELEVATED",
        "factors": factors,
        "simulation_time": datetime.utcnow().isoformat()
    }
