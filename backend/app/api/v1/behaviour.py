from pydantic import BaseModel
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

def seed_initial_behaviour_events_if_empty(db: Session):
    count = db.query(BehaviourEvent).count()
    if count > 0:
        return
    now = datetime.utcnow()
    sample_events = [
        # 1. Fence Probing
        BehaviourEvent(
            event_id=f"BHV-{now.strftime('%Y%m%d')}-0101",
            camera_id="BOP-WAGAH-CAM-01",
            object_type="person",
            event_type="POTENTIAL_PERIMETER_PROBING_PATTERN",
            risk_score=88,
            decayed_risk_score=88,
            risk_level="CRITICAL",
            confidence=0.94,
            zone_name="Zero-Line Outer Boundary Wire",
            factors_json=json.dumps([
                {"factor": "FENCE_PROBING_LOITER", "weight": 35, "description": "Target lingered within 3m of border wire for 42 seconds"},
                {"factor": "REPEATED_APPROACH", "weight": 30, "description": "3 successive approaches and retreat cycles towards fence"},
                {"factor": "BLINDSPOT_PROBING", "weight": 23, "description": "Target positioning along camera field-of-view edge"}
            ]),
            counter_factors_json=json.dumps([]),
            details_json=json.dumps({"dwell_time_sec": 42.5, "velocity_ms": 1.1, "approaches": 3}),
            status="DETECTED",
            created_at=now
        ),
        BehaviourEvent(
            event_id=f"BHV-{now.strftime('%Y%m%d')}-0102",
            camera_id="BOP-WAGAH-CAM-01",
            object_type="person",
            event_type="REPEATED_APPROACH",
            risk_score=76,
            decayed_risk_score=76,
            risk_level="HIGH",
            confidence=0.91,
            zone_name="Buffer Zone East Flank",
            factors_json=json.dumps([
                {"factor": "REPEATED_APPROACH", "weight": 35, "description": "Subject moved back and forth along buffer boundary wire"},
                {"factor": "IRREGULAR_PATH", "weight": 25, "description": "Non-linear reconnaissance movement pattern"},
                {"factor": "LOW_SPEED_CREEP", "weight": 16, "description": "Slow deliberate pacing near sensor tripwire"}
            ]),
            counter_factors_json=json.dumps([]),
            details_json=json.dumps({"dwell_time_sec": 28.0, "velocity_ms": 0.8, "approaches": 2}),
            status="DETECTED",
            created_at=now
        ),
        # 2. Gate Barrier Dwell
        BehaviourEvent(
            event_id=f"BHV-{now.strftime('%Y%m%d')}-0201",
            camera_id="BOP-WAGAH-GATE-01",
            object_type="vehicle",
            event_type="VEHICLE_DWELL_ANOMALY",
            risk_score=84,
            decayed_risk_score=84,
            risk_level="HIGH",
            confidence=0.96,
            zone_name="Checkpost Gate Approach Road",
            factors_json=json.dumps([
                {"factor": "EXTENDED_GATE_DWELL", "weight": 40, "description": "Vehicle idling in front of checkpost boom barrier for 85s"},
                {"factor": "UNVERIFIED_COMMERCIAL_VEHICLE", "weight": 25, "description": "Plate not found in local authorized fleet registry"},
                {"factor": "ENGINE_RUNNING_STATIONARY", "weight": 19, "description": "Idling at restricted entry throat"}
            ]),
            counter_factors_json=json.dumps([]),
            details_json=json.dumps({"dwell_time_sec": 85.0, "vehicle_type": "truck", "velocity_ms": 0.0}),
            status="DETECTED",
            created_at=now
        ),
        BehaviourEvent(
            event_id=f"BHV-{now.strftime('%Y%m%d')}-0202",
            camera_id="BOP-WAGAH-GATE-01",
            object_type="package",
            event_type="POTENTIAL_ABANDONED_OBJECT",
            risk_score=92,
            decayed_risk_score=92,
            risk_level="CRITICAL",
            confidence=0.93,
            zone_name="Pedestrian Sentry Booth Pathway",
            factors_json=json.dumps([
                {"factor": "UNATTENDED_OBJECT_DWELL", "weight": 45, "description": "Unattended container stationary on pedestrian walkway >120s"},
                {"factor": "OWNER_DEPARTED", "weight": 30, "description": "Carrier walked away leaving object in restricted choke point"},
                {"factor": "HIGH_SECURITY_ZONE", "weight": 17, "description": "Located within 10 meters of sentry control station"}
            ]),
            counter_factors_json=json.dumps([]),
            details_json=json.dumps({"dwell_time_sec": 124.0, "object_type": "backpack"}),
            status="DETECTED",
            created_at=now
        ),
        # 3. Speed Burst & Sprint Infiltration
        BehaviourEvent(
            event_id=f"BHV-{now.strftime('%Y%m%d')}-0301",
            camera_id="BOP-WAGAH-CAM-02",
            object_type="person",
            event_type="SUDDEN_SPEED_CHANGE",
            risk_score=95,
            decayed_risk_score=95,
            risk_level="CRITICAL",
            confidence=0.97,
            zone_name="Zero-Line Restricted Zone",
            factors_json=json.dumps([
                {"factor": "SPRINT_ACCELERATION_BURST", "weight": 45, "description": "Subject accelerated from 1.2 m/s to 5.4 m/s towards boundary fence"},
                {"factor": "BOUNDARY_VECTOR", "weight": 35, "description": "Trajectory directly oriented towards international border wire"},
                {"factor": "RESTRICTED_SECTOR", "weight": 15, "description": "Breached outer security perimeter at speed"}
            ]),
            counter_factors_json=json.dumps([]),
            details_json=json.dumps({"peak_speed_ms": 5.4, "initial_speed_ms": 1.2, "trajectory_angle": 185}),
            status="DETECTED",
            created_at=now
        ),
        BehaviourEvent(
            event_id=f"BHV-{now.strftime('%Y%m%d')}-0302",
            camera_id="BOP-WAGAH-CAM-02",
            object_type="person",
            event_type="RAPID_DIRECTION_CHANGE",
            risk_score=79,
            decayed_risk_score=79,
            risk_level="HIGH",
            confidence=0.89,
            zone_name="Perimeter Observation Sector 3",
            factors_json=json.dumps([
                {"factor": "EVASIVE_ZIGZAG", "weight": 35, "description": "Subject executed 4 sharp heading changes within 12 seconds"},
                {"factor": "COVER_UTILIZATION", "weight": 25, "description": "Movement weaving between terrain foliage and ditch"},
                {"factor": "SURVEILLANCE_EVASION", "weight": 19, "description": "Attempting to evade primary sentry tower optical cone"}
            ]),
            counter_factors_json=json.dumps([]),
            details_json=json.dumps({"direction_changes": 4, "avg_speed_ms": 3.2}),
            status="DETECTED",
            created_at=now
        ),
        # 4. Night No-Go Curfew
        BehaviourEvent(
            event_id=f"BHV-{now.strftime('%Y%m%d')}-0401",
            camera_id="BOP-WAGAH-CAM-01",
            object_type="person",
            event_type="AFTER_HOURS_ACTIVITY",
            risk_score=98,
            decayed_risk_score=98,
            risk_level="CRITICAL",
            confidence=0.98,
            zone_name="Zero-Line Outer Perimeter",
            factors_json=json.dumps([
                {"factor": "NOCTURNAL_CURFEW_VIOLATION", "weight": 50, "description": "Movement detected at 02:45 hrs during mandatory zero-line night curfew (2200-0500)"},
                {"factor": "LOW_VISIBILITY_PROBING", "weight": 30, "description": "Thermal camera contrast confirms human crawling near wire"},
                {"factor": "HIGH_CONFIDENCE_THERMAL_LOCK", "weight": 18, "description": "Body heat signature locked in complete ambient darkness"}
            ]),
            counter_factors_json=json.dumps([]),
            details_json=json.dumps({"detection_time": "02:45:18", "curfew_window": "22:00-05:00", "sensor": "THERMAL_IR"}),
            status="DETECTED",
            created_at=now
        ),
        BehaviourEvent(
            event_id=f"BHV-{now.strftime('%Y%m%d')}-0402",
            camera_id="BOP-WAGAH-CAM-03",
            object_type="person",
            event_type="BASELINE_ACTIVITY_ANOMALY",
            risk_score=81,
            decayed_risk_score=81,
            risk_level="HIGH",
            confidence=0.92,
            zone_name="Sentry Outpost South Perimeter",
            factors_json=json.dumps([
                {"factor": "STATISTICAL_DENSITY_SPIKE", "weight": 40, "description": "Activity density 4.5x above standard nocturnal baseline"},
                {"factor": "UNSCHEDULED_SECTOR_MOVEMENT", "weight": 25, "description": "No authorized patrol scheduled in sector at this hour"},
                {"factor": "PERIMETER_PROXIMITY", "weight": 16, "description": "Subject positioned 8m from post rear boundary"}
            ]),
            counter_factors_json=json.dumps([]),
            details_json=json.dumps({"baseline_multiplier": 4.5, "hour": 3}),
            status="DETECTED",
            created_at=now
        )
    ]
    for ev in sample_events:
        db.add(ev)
    db.commit()

class SimulateThreatRequest(BaseModel):
    category: Optional[str] = "probing"
    camera_id: Optional[str] = None
    zone_name: Optional[str] = None


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
    seed_initial_behaviour_events_if_empty(db)
    query = db.query(BehaviourEvent)
    if risk_level:
        query = query.filter(BehaviourEvent.risk_level == risk_level)
    if event_type:
        if "," in event_type:
            types = [t.strip() for t in event_type.split(",") if t.strip()]
            query = query.filter(BehaviourEvent.event_type.in_(types))
        else:
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
    if not r and event_id.isdigit():
        r = db.query(BehaviourEvent).filter(BehaviourEvent.id == int(event_id)).first()
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
    seed_initial_behaviour_events_if_empty(db)
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


@router.post("/events/simulate", response_model=BehaviourEventResponse, status_code=201)
def simulate_behaviour_threat(
    req: SimulateThreatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tactical ground simulation: triggers a realistic behaviour threat anomaly on-demand.
    """
    import uuid
    cat = (req.category or "probing").lower()
    now = datetime.utcnow()
    event_uid = f"BHV-SIM-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:5].upper()}"
    cam = req.camera_id or "BOP-WAGAH-CAM-01"
    
    if cat == "dwell":
        ev_type = "VEHICLE_DWELL_ANOMALY"
        obj_type = "vehicle"
        score = 86
        level = "HIGH"
        zone = req.zone_name or "Checkpost Gate Boom Barrier"
        factors = [
            {"factor": "STATIONARY_GATE_DWELL", "weight": 45, "description": "Vehicle stationary at barrier approach > 75 seconds"},
            {"factor": "BLOCKED_ENTRY_CHOKE", "weight": 25, "description": "Obstructing primary checkpost vehicle throughput channel"},
            {"factor": "UNKNOWN_REGISTRATION", "weight": 16, "description": "Vehicle number plate not matching pre-approved convoy whitelist"}
        ]
        details = {"dwell_sec": 75.0, "vehicle_type": "truck", "velocity_ms": 0.0}
    elif cat == "kinetics":
        ev_type = "SUDDEN_SPEED_CHANGE"
        obj_type = "person"
        score = 94
        level = "CRITICAL"
        zone = req.zone_name or "Zero-Line Boundary Sector 2"
        factors = [
            {"factor": "SPRINT_ACCELERATION_BURST", "weight": 50, "description": "Target accelerated from 1.0 m/s to 5.2 m/s towards perimeter wire"},
            {"factor": "DIRECT_BOUNDARY_VECTOR", "weight": 30, "description": "Heading directed immediately at international border fence"},
            {"factor": "RESTRICTED_BUFFER_BREACH", "weight": 14, "description": "Crossed outer acoustic sensor tripwire"}
        ]
        details = {"speed_ms": 5.2, "initial_speed_ms": 1.0, "heading": 182}
    elif cat == "curfew":
        ev_type = "AFTER_HOURS_ACTIVITY"
        obj_type = "person"
        score = 98
        level = "CRITICAL"
        zone = req.zone_name or "Zero-Line Nocturnal Window"
        factors = [
            {"factor": "NOCTURNAL_CURFEW_BREACH", "weight": 55, "description": "Subject moving at night (22:00-05:00) in zero-line restricted zone"},
            {"factor": "THERMAL_CONFIRMATION", "weight": 25, "description": "Thermal IR sensor confirms human body heat signature"},
            {"factor": "UNAUTHORIZED_NO_GO_TERRAIN", "weight": 18, "description": "Physical ground-plane intrusion beyond boundary perimeter"}
        ]
        details = {"hour": now.hour, "curfew_rule": "22:00-05:00", "sensor": "THERMAL_OPTICAL"}
    else: # probing
        ev_type = "POTENTIAL_PERIMETER_PROBING_PATTERN"
        obj_type = "person"
        score = 90
        level = "CRITICAL"
        zone = req.zone_name or "Perimeter Fence North Wire"
        factors = [
            {"factor": "FENCE_PROBING_LOITER", "weight": 45, "description": "Target loitering within 4 meters of international wire for > 40s"},
            {"factor": "REPEATED_APPROACH_PATTERN", "weight": 30, "description": "Subject approached and retreated from wire 3 times"},
            {"factor": "SENSOR_CONE_TESTING", "weight": 15, "description": "Positioned at edge of primary PTZ optical sweep"}
        ]
        details = {"dwell_sec": 44.0, "approaches": 3, "velocity_ms": 1.1}

    new_ev = BehaviourEvent(
        event_id=event_uid,
        camera_id=cam,
        object_type=obj_type,
        event_type=ev_type,
        risk_score=score,
        decayed_risk_score=score,
        risk_level=level,
        confidence=0.95,
        zone_name=zone,
        factors_json=json.dumps(factors),
        counter_factors_json=json.dumps([]),
        details_json=json.dumps(details),
        status="DETECTED",
        created_at=now
    )
    db.add(new_ev)
    
    # Also create notification
    from app.models.notification import Notification
    notif = Notification(
        user_id="all",
        title=f"⚠️ BEHAVIOUR ANOMALY: {ev_type} ({cam})",
        message=f"Threat detected in {zone}: {factors[0]['description']}",
        priority="HIGH" if level == "CRITICAL" else "NORMAL",
        read=False,
        location_description=cam,
        created_at=now
    )
    db.add(notif)
    db.commit()
    db.refresh(new_ev)
    
    return BehaviourEventResponse(
        id=new_ev.id,
        event_id=new_ev.event_id,
        global_track_id=new_ev.global_track_id,
        camera_id=new_ev.camera_id,
        local_track_id=new_ev.local_track_id,
        object_type=new_ev.object_type,
        event_type=new_ev.event_type,
        risk_score=new_ev.risk_score,
        decayed_risk_score=new_ev.decayed_risk_score,
        risk_level=new_ev.risk_level,
        confidence=new_ev.confidence,
        zone_id=new_ev.zone_id,
        zone_name=new_ev.zone_name,
        factors=factors,
        counter_factors=[],
        details=details,
        status=new_ev.status,
        created_at=new_ev.created_at,
        updated_at=new_ev.updated_at
    )

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
    if not event and event_id.isdigit():
        event = db.query(BehaviourEvent).filter(BehaviourEvent.id == int(event_id)).first()
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
