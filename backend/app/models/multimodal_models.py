from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, Index, ForeignKey
from datetime import datetime
from app.database import Base

class AIObservation(Base):
    """
    Section 3: Atomic AI Signal Model across cameras, edge nodes, and multimodal pipelines.
    """
    __tablename__ = "ai_observations"

    id = Column(Integer, primary_key=True, index=True)
    observation_id = Column(String(64), unique=True, index=True, nullable=False) # e.g. OBS-2026-0001
    camera_id = Column(String(50), index=True, nullable=False)
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True, nullable=False)
    bop_id = Column(String(50), default="BOP-ALPHA", index=True, nullable=True)
    zone_id = Column(String(50), index=True, nullable=True)
    track_id = Column(Integer, index=True, nullable=True)
    global_track_id = Column(String(50), index=True, nullable=True)
    
    # Signal Type: PERSON, VEHICLE, PLATE, FACE, BEHAVIOUR, AUDIO, ZONE_TRANSITION, SPEED, ROUTE, OCCLUSION
    observation_type = Column(String(50), index=True, nullable=False)
    
    # Calibrated Confidence
    confidence = Column(Float, nullable=False, default=0.85) # 0.0 to 1.0
    confidence_level = Column(String(20), default="HIGH")    # HIGH, MEDIUM, LOW
    
    # AI Model Attribution
    model_name = Column(String(100), default="yolov8n", nullable=False)
    model_version = Column(String(30), default="v1.0.0", nullable=False)
    
    # Spatial metadata
    bbox_json = Column(Text, nullable=True)                  # {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}
    trajectory_json = Column(Text, nullable=True)            # [{"x": ..., "y": ..., "t": ...}]
    
    # Multimodal Specific Attributes
    vehicle_class = Column(String(30), nullable=True)        # car, truck, motorcycle, bus, van, other
    plate_text = Column(String(30), nullable=True)
    plate_ocr_confidence = Column(Float, nullable=True)
    face_match_status = Column(String(30), nullable=True)    # FACE_DETECTED, FACE_MATCHED, UNKNOWN_FACE
    face_person_name = Column(String(100), nullable=True)    # Redacted for non-privileged scopes
    face_match_confidence = Column(Float, nullable=True)
    
    # Environmental & Quality Context
    lighting_condition = Column(String(30), default="DAY")   # DAY, NIGHT, LOW_LIGHT
    image_quality_score = Column(Float, default=1.0)         # 0.0 to 1.0
    environmental_data_json = Column(Text, default='{}')
    
    # Arbitrary Signal Metadata
    metadata_json = Column(Text, default='{}')
    
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

Index("idx_obs_cam_type_time", AIObservation.camera_id, AIObservation.observation_type, AIObservation.timestamp)
Index("idx_obs_site_bop_time", AIObservation.site_id, AIObservation.bop_id, AIObservation.timestamp)


class MultimodalSecurityEvent(Base):
    """
    Section 40 & 42: Fused Multimodal Security Event with Explainable Graph, Timeline, and Evidence.
    """
    __tablename__ = "multimodal_security_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, index=True, nullable=False) # e.g. MME-2026-000101
    event_group_id = Column(String(64), index=True, nullable=False)        # For deduplication / anti-jitter
    
    title = Column(String(200), nullable=False)
    
    # Event Type: CORRELATED_ANOMALY, PROLONGED_PRESENCE, REPEATED_PRESENCE_PATTERN,
    # UNUSUAL_ROUTE_PATTERN, ZONE_TRANSITION_VIOLATION, VIRTUAL_FENCE_BREACH,
    # UNEXPECTED_DIRECTION, SPEED_ANOMALY, VEHICLE_PLATE_CORRELATION, FACE_PRESENCE,
    # MULTIMODAL_INTRUSION, ACTIVITY_SURGE, UNUSUAL_ACTIVITY_DROP
    event_type = Column(String(60), index=True, nullable=False)
    
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True, nullable=False)
    bop_id = Column(String(50), default="BOP-ALPHA", index=True, nullable=True)
    bop_name = Column(String(100), default="BOP Alpha", index=True)
    
    # Primary Camera & Associated Multi-Cameras
    primary_camera_id = Column(String(50), index=True, nullable=False)
    camera_ids_json = Column(Text, default='[]')              # ["CAM-001", "CAM-002"]
    zone_ids_json = Column(Text, default='[]')                # ["ZONE-01", "ZONE-02"]
    track_ids_json = Column(Text, default='[]')               # [101, 102]
    global_track_id = Column(String(50), index=True, nullable=True)
    
    # Fused Multimodal Indicators
    vehicle_ids_json = Column(Text, default='[]')
    plate_references_json = Column(Text, default='[]')        # [{"plate": "PB08AX1234", "confidence": 0.94}]
    face_references_json = Column(Text, default='[]')         # [{"status": "FACE_MATCHED", "confidence": 0.88}]
    audio_references_json = Column(Text, default='[]')        # Optional audio signals
    
    # Signal Weights and Inputs
    signals_json = Column(Text, default='[]')                 # Array of contributing AIObservation summaries
    
    # Calibrated Fusion Confidence
    confidence = Column(Float, nullable=False, default=0.85)
    confidence_level = Column(String(20), default="HIGH")     # HIGH, MEDIUM, LOW
    
    # Explainable Risk
    risk_score = Column(Integer, default=75, index=True)      # 0 to 100
    risk_level = Column(String(30), default="HIGH", index=True) # INFORMATIONAL, LOW, MEDIUM, HIGH, CRITICAL
    
    # Explainability: "WHY WAS THIS FLAGGED?"
    explanation_json = Column(Text, default='{}')             # {"summary": "...", "contributing_factors": [...], "fusion_method": "..."}
    
    # Event Timeline (Detection -> Tracking -> Context -> Correlation -> Risk -> Alert -> Incident)
    timeline_json = Column(Text, default='[]')
    
    # AI Event Graph (Graph nodes & edges for Explainable Visuals)
    graph_json = Column(Text, default='{}')
    
    # Evidence Bundle & Hash Integrity
    evidence_bundle_json = Column(Text, default='{}')         # {"pre_clip_id": "...", "post_clip_id": "...", "snapshot_url": "...", "hash": "..."}
    
    # Lifecycle & Deduplication
    status = Column(String(30), default="DETECTED", index=True) # DETECTED, CONFIRMED, ACKNOWLEDGED, RESOLVED, FALSE_POSITIVE, UNCERTAIN
    is_cooldown_suppressed = Column(Boolean, default=False, index=True)
    
    # Human-In-The-Loop Feedback
    feedback_label = Column(String(30), nullable=True)        # VALID, FALSE_POSITIVE, UNCERTAIN
    feedback_reason = Column(Text, nullable=True)
    feedback_by = Column(String(100), nullable=True)
    feedback_at = Column(DateTime, nullable=True)
    
    # Attributed Model Info
    model_versions_json = Column(Text, default='{}')          # {"detector": "v1.2", "fusion": "v2.0"}
    
    # Timing
    event_occurred_at = Column(DateTime, default=datetime.utcnow, index=True)
    edge_processed_at = Column(DateTime, nullable=True)
    central_received_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Index("idx_mme_site_bop_type", MultimodalSecurityEvent.site_id, MultimodalSecurityEvent.bop_id, MultimodalSecurityEvent.event_type)
Index("idx_mme_risk_occurred", MultimodalSecurityEvent.risk_level, MultimodalSecurityEvent.event_occurred_at)


class AIModelRegistry(Base):
    """
    Section 56-61: AI Model Registry, Versioning, Rollback & Observability.
    """
    __tablename__ = "ai_model_registry"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), index=True, nullable=False) # e.g. "Multimodal Fusion Engine"
    version = Column(String(30), index=True, nullable=False)     # e.g. "v2.1.0"
    model_type = Column(String(50), nullable=False)              # OBJECT_DETECTION, TRACKER, ANPR_OCR, FACE_REID, MULTIMODAL_FUSION, BEHAVIOUR
    
    # Deployment State
    status = Column(String(30), default="ACTIVE", index=True)    # ACTIVE, STANDBY, DEPRECATED, DEGRADED
    is_active = Column(Boolean, default=True, index=True)
    deployment_profile = Column(String(30), default="BALANCED")  # LOW, BALANCED, HIGH
    
    # Telemetry & Benchmark Metrics
    precision = Column(Float, default=0.94)
    recall = Column(Float, default=0.91)
    f1_score = Column(Float, default=0.925)
    false_positive_rate = Column(Float, default=0.04)
    false_negative_rate = Column(Float, default=0.05)
    latency_ms = Column(Float, default=18.5)
    error_rate = Column(Float, default=0.005)
    confidence_avg = Column(Float, default=0.88)
    
    parameters_json = Column(Text, default='{}')
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AIOperatorFeedback(Base):
    """
    Section 62-63: Human-in-the-Loop Feedback Logging for Analytics.
    """
    __tablename__ = "ai_operator_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), index=True, nullable=False)
    label = Column(String(30), nullable=False)                  # VALID, FALSE_POSITIVE, UNCERTAIN
    model_name = Column(String(100), nullable=False, default="Multimodal Fusion Engine")
    model_version = Column(String(30), nullable=False, default="v2.0.0")
    camera_id = Column(String(50), index=True, nullable=False)
    event_type = Column(String(60), index=True, nullable=False)
    user = Column(String(100), nullable=False)
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class CameraAIProfile(Base):
    """
    Section 93-94: Camera-specific AI Resource Profiles (LOW, BALANCED, HIGH).
    """
    __tablename__ = "camera_ai_profiles"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String(50), unique=True, index=True, nullable=False)
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True)
    bop_id = Column(String(50), default="BOP-ALPHA", index=True)
    
    # Profile: LOW (5 FPS, basic tracking), BALANCED (10 FPS, ANPR/Face), HIGH (20 FPS, deep multimodal correlation)
    profile = Column(String(30), default="BALANCED", nullable=False)
    target_fps = Column(Float, default=10.0)
    
    # Feature Toggles (Section 95-96)
    human_detection = Column(Boolean, default=True)
    vehicle_detection = Column(Boolean, default=True)
    anpr_enabled = Column(Boolean, default=True)
    face_detection = Column(Boolean, default=True)
    tracking_enabled = Column(Boolean, default=True)
    virtual_fence_enabled = Column(Boolean, default=True)
    behaviour_analytics = Column(Boolean, default=True)
    anomaly_detection = Column(Boolean, default=True)
    audio_analytics = Column(Boolean, default=False)
    
    loitering_threshold_seconds = Column(Integer, default=180) # Configurable threshold for PROLONGED_PRESENCE
    
    updated_by = Column(String(100), default="admin")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
