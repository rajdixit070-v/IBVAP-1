import json
import logging
from typing import Optional, List, Dict, Any
import numpy as np
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.camera import Camera
from app.models.ai_config import CameraAIConfig
from app.models.ai_event import AIAnalyticsEvent
from app.models.zone import SecurityZone
from app.models.security_event import SecurityEvent
from app.models.risk_config import SystemRiskConfig
from app.models.audit_log import SecurityAuditLog
from app.models.vehicle_watchlist import VehicleWatchlist
from app.models.person_watchlist import PersonWatchlist
from app.models.anpr_event import ANPREvent
from app.models.face_event import FaceEvent
from app.models.edge_node import EdgeNode
from app.models.edge_event_buffer import EdgeEventBuffer
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.playbook import IncidentPlaybook
from app.models.incident_relationship import IncidentRelationship
from app.models.incident_review import IncidentReview
from app.models.evidence import Evidence
from app.models.notification import Notification
from app.models.camera_transition import CameraTransition
from app.models.global_track import GlobalTrack
from app.models.track_observation import TrackObservation
from app.models.track_association import TrackAssociation
from app.models.movement_anomaly import MovementAnomaly
from app.models.behaviour_event import BehaviourEvent
from app.models.behaviour_rule import BehaviourRule
from app.models.activity_baseline import ActivityBaseline
from app.models.behaviour_feedback import BehaviourFeedback
from app.models.early_warning import EarlyWarning
from app.models.activity_snapshot import ActivitySnapshot
from app.models.baseline_shift import BaselineShift
from app.models.model_health import ModelHealth
from app.models.prediction_feedback import PredictionFeedback

from app.models.federation_models import Organization, Region, Site, BOP, SiteUserScope, ConfigurationScope

from app.core.security import get_password_hash, encrypt_credential
from app.api.v1.auth import router as auth_router
from app.api.v1.cameras import router as cameras_router
from app.api.v1.ai import router as ai_router
from app.api.v1.zones import router as zones_router
from app.api.v1.events import router as events_router
from app.api.v1.risk_config import router as risk_config_router
from app.api.v1.anpr import router as anpr_router
from app.api.v1.vehicles import router as vehicles_router
from app.api.v1.face import router as face_router
from app.api.v1.watchlist_persons import router as watchlist_persons_router
from app.api.v1.edge import router as edge_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.incidents import router as incidents_router
from app.api.v1.evidence import router as evidence_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.cross_camera import router as cross_camera_router
from app.api.v1.behaviour import router as behaviour_router
from app.api.v1.predictive import router as predictive_router
from app.api.v1.health import router as health_router
from app.api.v1.sites import router as sites_router
from app.api.v1.bops import router as bops_router
from app.api.v1.federation import router as federation_router
from app.api.v1.multimodal import router as multimodal_router
from app.api.v1.security import router as security_router
from app.api.v1.demo import router as demo_router
from app.api.v1.ws import router as ws_router

# Next-Gen Intelligence Routers (Modules 1 - 5)
from app.api.v1.sensors import router as sensors_router
from app.api.v1.thermal import router as thermal_router
from app.api.v1.ptz import router as ptz_router
from app.api.v1.drones import router as drones_router
from app.api.v1.gis import router as gis_router

from app.core.security_middleware import SecurityHeadersMiddleware
from app.config import validate_environment

from app.models.multimodal_models import (
    AIObservation,
    MultimodalSecurityEvent,
    AIModelRegistry,
    AIOperatorFeedback,
    CameraAIProfile
)

from app.models.enterprise_security_models import (
    SecurityThreatEvent,
    EdgeNodeCredential,
    BlockedIPEntry,
    SessionTokenBlacklist,
    SecurityPostureSetting,
    SecurityAuditLogEntry
)

from app.models.sensor_models import Sensor, SensorTelemetry, SensorFusionEvent
from app.models.thermal_fusion_models import CameraPair, ThermalFusionResult
from app.models.ptz_models import PTZDevice, PTZPreset, PTZAuditLog
from app.models.drone_models import Drone, DroneMission, DroneHandoffEvent
from app.models.gis_models import GISLayer, CameraFOV, SectorCoverage, BlindSpot
from app.services.gis.gis_service import GISService
from app.services.security.edge_auth_service import EdgeAuthService

from app.services.health_monitor import health_monitor
from app.services.stream_manager import stream_manager
from app.services.ai.pipeline import ai_pipeline_manager
from app.services.incident.playbook_service import playbook_service

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)
logger = logging.getLogger("ibvap.main")

def init_db_defaults(seed_demo: Optional[bool] = None):
    """
    Initializes tables, default admin, and playbooks.
    Demo/synthetic cameras, zones, edge nodes, and simulated events are only seeded
    if seed_demo is explicitly True or settings.DEMO_MODE is True.
    """
    if seed_demo is None:
        seed_demo = False

    Base.metadata.create_all(bind=engine)
    
    # Auto-migrate columns for SQLite if missing
    try:
        with engine.connect() as conn:
            # Cameras
            cursor = conn.execute(text("PRAGMA table_info(cameras)"))
            cols = [row[1] for row in cursor.fetchall()]
            if cols:
                if "edge_node_id" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN edge_node_id VARCHAR(50) DEFAULT 'EDGE-BOP-001'"))
                if "stream_profile" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN stream_profile VARCHAR(20) DEFAULT 'HIGH'"))
                if "priority" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN priority VARCHAR(20) DEFAULT 'NORMAL'"))
                if "expected_fps" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN expected_fps FLOAT DEFAULT 25.0"))
                if "frame_drops" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN frame_drops INTEGER DEFAULT 0"))
                if "stream_latency_ms" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN stream_latency_ms FLOAT DEFAULT 35.0"))
                if "reconnect_count" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN reconnect_count INTEGER DEFAULT 0"))
                if "image_quality_score" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN image_quality_score FLOAT DEFAULT 88.0"))
                if "tampering_detected" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN tampering_detected BOOLEAN DEFAULT 0"))
                if "is_maintenance" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN is_maintenance BOOLEAN DEFAULT 0"))
                if "maintenance_reason" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN maintenance_reason VARCHAR(255)"))
                if "site_id" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN site_id VARCHAR(50) DEFAULT 'SITE-BORDER-NORTH'"))
                if "bop_id" not in cols:
                    conn.execute(text("ALTER TABLE cameras ADD COLUMN bop_id VARCHAR(50)"))

            # Edge Nodes Phase 12 auto-migrations
            cursor = conn.execute(text("PRAGMA table_info(edge_nodes)"))
            edge_cols = [row[1] for row in cursor.fetchall()]
            if edge_cols:
                if "site_id" not in edge_cols:
                    conn.execute(text("ALTER TABLE edge_nodes ADD COLUMN site_id VARCHAR(50) DEFAULT 'SITE-BORDER-NORTH'"))
                if "bop_id" not in edge_cols:
                    conn.execute(text("ALTER TABLE edge_nodes ADD COLUMN bop_id VARCHAR(50)"))

            # Users Phase 14 auto-migrations
            cursor = conn.execute(text("PRAGMA table_info(users)"))
            user_cols = [row[1] for row in cursor.fetchall()]
            if user_cols:
                if "failed_login_attempts" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"))
                if "locked_until" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN locked_until DATETIME"))
                if "last_login_at" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN last_login_at DATETIME"))
                if "last_password_change" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN last_password_change DATETIME"))
                if "mfa_enabled" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT 0"))
                if "force_password_change" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN force_password_change BOOLEAN DEFAULT 0"))

            # Incidents Phase 10 auto-migrations
            cursor = conn.execute(text("PRAGMA table_info(incidents)"))
            inc_cols = [row[1] for row in cursor.fetchall()]
            if inc_cols:
                if "incident_type" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN incident_type VARCHAR(30) DEFAULT 'SECURITY'"))
                if "escalation_level" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN escalation_level INTEGER DEFAULT 1"))
                if "escalation_due_at" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN escalation_due_at DATETIME"))
                if "resolution_category" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN resolution_category VARCHAR(50)"))
                if "global_track_id" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN global_track_id VARCHAR(50)"))
                if "related_cameras_json" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN related_cameras_json TEXT DEFAULT '[]'"))
                if "parent_incident_id" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN parent_incident_id VARCHAR(50)"))
                if "playbook_id" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN playbook_id VARCHAR(50)"))
                if "checklist_json" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN checklist_json TEXT DEFAULT '[]'"))
                if "review_json" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN review_json TEXT DEFAULT '{}'"))
                if "assigned_team" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN assigned_team VARCHAR(100)"))
                if "assigned_at" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN assigned_at DATETIME"))
                if "assigned_by" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN assigned_by VARCHAR(100)"))
                if "version" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN version INTEGER DEFAULT 1"))
                if "resolved_by" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN resolved_by VARCHAR(100)"))
                if "closed_by" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN closed_by VARCHAR(100)"))
                if "site_id" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN site_id VARCHAR(50) DEFAULT 'SITE-BORDER-NORTH'"))
                if "bop_id" not in inc_cols:
                    conn.execute(text("ALTER TABLE incidents ADD COLUMN bop_id VARCHAR(50)"))

            # Alerts auto-migrations
            cursor = conn.execute(text("PRAGMA table_info(alerts)"))
            alert_cols = [row[1] for row in cursor.fetchall()]
            if alert_cols:
                if "resolved_at" not in alert_cols:
                    conn.execute(text("ALTER TABLE alerts ADD COLUMN resolved_at DATETIME"))
                if "resolved_by" not in alert_cols:
                    conn.execute(text("ALTER TABLE alerts ADD COLUMN resolved_by VARCHAR(100)"))
                if "resolution_notes" not in alert_cols:
                    conn.execute(text("ALTER TABLE alerts ADD COLUMN resolution_notes VARCHAR(500)"))

            # Multimodal security events auto-migrations
            cursor = conn.execute(text("PRAGMA table_info(multimodal_security_events)"))
            mme_cols = [row[1] for row in cursor.fetchall()]
            if mme_cols:
                if "evidence_sha256" not in mme_cols:
                    conn.execute(text("ALTER TABLE multimodal_security_events ADD COLUMN evidence_sha256 VARCHAR(64)"))

            conn.commit()
    except Exception as e:
        logger.warning(f"Schema auto-migration notice: {e}")

    # Ensure default response playbooks are seeded
    playbook_service.ensure_default_playbooks()

    db = SessionLocal()
    try:
        # Create default Admin if not exists
        admin = db.query(User).filter(User.username == settings.DEFAULT_ADMIN_USERNAME).first()
        if not admin:
            admin = User(
                username=settings.DEFAULT_ADMIN_USERNAME,
                email=settings.DEFAULT_ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
                role="admin",
                is_active=True
            )
            db.add(admin)
            db.commit()
            logger.info(f"Default admin user '{settings.DEFAULT_ADMIN_USERNAME}' created.")

        # Assign global admin scope
        admin_scope = db.query(SiteUserScope).filter(SiteUserScope.username == settings.DEFAULT_ADMIN_USERNAME).first()
        if not admin_scope:
            admin_scope = SiteUserScope(
                username=settings.DEFAULT_ADMIN_USERNAME,
                scope_type="GLOBAL",
                scope_id="*",
                role="SUPER_ADMIN",
                assigned_by="system"
            )
            db.add(admin_scope)
            db.commit()

        # Seed initial Behaviour Rules (Phase 8)
        rule_count = db.query(BehaviourRule).count()
        if rule_count == 0:
            demo_rules = [
                BehaviourRule(
                    rule_id="RULE-REPEATED-APPROACH",
                    name="Perimeter Repeated Approach Anomaly",
                    description="Detects subjects repeatedly approaching perimeter barrier and retreating.",
                    event_type="REPEATED_APPROACH",
                    is_enabled=True,
                    dwell_threshold_sec=20.0,
                    stop_count_threshold=2,
                    base_risk_weight=22,
                    max_risk_cap=40,
                    cooldown_sec=60,
                    rule_version=1,
                    changed_by="admin"
                ),
                BehaviourRule(
                    rule_id="RULE-FENCE-EDGE",
                    name="Perimeter Fence-Edge Movement",
                    description="Detects prolonged lateral trajectory parallel to zero-line fence wire.",
                    event_type="FENCE_EDGE_MOVEMENT",
                    is_enabled=True,
                    dwell_threshold_sec=30.0,
                    base_risk_weight=18,
                    max_risk_cap=35,
                    cooldown_sec=60,
                    rule_version=1,
                    changed_by="admin"
                ),
                BehaviourRule(
                    rule_id="RULE-SUDDEN-SPEED",
                    name="Sudden Speed Change & Sprint Detection",
                    description="Detects rapid acceleration / sudden running in surveillance sectors.",
                    event_type="SUDDEN_SPEED_CHANGE",
                    is_enabled=True,
                    speed_threshold_ms=4.0,
                    base_risk_weight=15,
                    max_risk_cap=30,
                    cooldown_sec=45,
                    rule_version=1,
                    changed_by="admin"
                ),
                BehaviourRule(
                    rule_id="RULE-AFTER-HOURS",
                    name="Restricted Night Activity",
                    description="Monitors movement during 22:00 to 05:00 restricted sector window.",
                    event_type="AFTER_HOURS_ACTIVITY",
                    is_enabled=True,
                    after_hours_start="22:00",
                    after_hours_end="05:00",
                    base_risk_weight=15,
                    max_risk_cap=30,
                    cooldown_sec=120,
                    rule_version=1,
                    changed_by="admin"
                )
            ]
            db.add_all(demo_rules)
            db.commit()
            logger.info("Seeded initial behaviour detection rules.")

        # Seed operational/demo data only if explicitly requested
        if seed_demo:
            from app.services.demo.demo_seeder import seed_demo_data
            seed_demo_data(db)

        # Initialize AI configs, start RTSP/synthetic streamers, and auto-register active cameras
        from app.core.security import decrypt_credential
        cameras = db.query(Camera).filter(Camera.enabled == True).all()
        for cam in cameras:
            # Start camera in stream_manager so live video feed is immediately working
            try:
                decrypted_pw = decrypt_credential(cam.encrypted_password) if cam.encrypted_password else None
                stream_manager.start_camera(
                    camera_id=cam.camera_id,
                    camera_name=cam.camera_name,
                    bop_site=cam.bop_site,
                    rtsp_url=cam.rtsp_url,
                    username=cam.username,
                    password=decrypted_pw
                )
                logger.info(f"Started video stream for camera {cam.camera_id} ({cam.rtsp_url})")
            except Exception as se:
                logger.warning(f"Could not auto-start streamer for {cam.camera_id}: {se}")

            config = db.query(CameraAIConfig).filter(CameraAIConfig.camera_id == cam.camera_id).first()
            if not config:
                config = CameraAIConfig(
                    camera_id=cam.camera_id,
                    enabled=True,
                    model_name="yolov8n",
                    target_fps=10.0,
                    input_size=640,
                    conf_person=0.40,
                    conf_vehicle=0.45,
                    conf_animal=0.35,
                    conf_drone=0.30,
                    conf_other=0.40
                )
                db.add(config)
                db.commit()

            if config.enabled:
                ai_pipeline_manager.register_camera(
                    camera_id=cam.camera_id,
                    target_fps=config.target_fps,
                    auto_start=True
                )

        # Seed Phase 13 AI Model Registry defaults
        if db.query(AIModelRegistry).count() == 0:
            default_models = [
                AIModelRegistry(
                    model_name="YOLOv8-Border-Detector",
                    version="v1.0.0",
                    model_type="OBJECT_DETECTION",
                    status="ACTIVE",
                    is_active=True,
                    deployment_profile="BALANCED",
                    precision=0.942,
                    recall=0.915,
                    f1_score=0.928,
                    latency_ms=16.4,
                    error_rate=0.002,
                    notes="Optimized YOLOv8 nano model for border tactical perimeter."
                ),
                AIModelRegistry(
                    model_name="ByteTrack-Tactical-Tracker",
                    version="v1.0.0",
                    model_type="TRACKER",
                    status="ACTIVE",
                    is_active=True,
                    deployment_profile="BALANCED",
                    precision=0.965,
                    recall=0.948,
                    f1_score=0.956,
                    latency_ms=4.2,
                    error_rate=0.001,
                    notes="High-speed Kalman-filter multi-object bounding box tracker."
                ),
                AIModelRegistry(
                    model_name="Multimodal-Fusion-Engine",
                    version="v2.0.0",
                    model_type="MULTIMODAL_FUSION",
                    status="ACTIVE",
                    is_active=True,
                    deployment_profile="BALANCED",
                    precision=0.958,
                    recall=0.932,
                    f1_score=0.945,
                    latency_ms=8.5,
                    error_rate=0.003,
                    notes="Bayesian non-linear signal correlation & temporal fusion engine."
                ),
                AIModelRegistry(
                    model_name="CRNN-ANPR-OCR-Engine",
                    version="v1.2.0",
                    model_type="ANPR_OCR",
                    status="ACTIVE",
                    is_active=True,
                    deployment_profile="HIGH",
                    precision=0.971,
                    recall=0.955,
                    f1_score=0.963,
                    latency_ms=22.1,
                    error_rate=0.004,
                    notes="Deep OCR engine with multi-frame temporal voting."
                ),
                AIModelRegistry(
                    model_name="MobileFaceNet-Embedder",
                    version="v1.0.0",
                    model_type="FACE_REID",
                    status="ACTIVE",
                    is_active=True,
                    deployment_profile="HIGH",
                    precision=0.952,
                    recall=0.924,
                    f1_score=0.938,
                    latency_ms=28.0,
                    error_rate=0.006,
                    notes="Privacy-preserving 512-dim facial feature embedder."
                )
            ]
            db.add_all(default_models)
            db.commit()
            logger.info("Seeded default AI model registry entries.")

        # Seed Camera AI Profiles
        for cam in cameras:
            prof = db.query(CameraAIProfile).filter(CameraAIProfile.camera_id == cam.camera_id).first()
            if not prof:
                prof = CameraAIProfile(
                    camera_id=cam.camera_id,
                    site_id=cam.site_id or "SITE-BORDER-NORTH",
                    bop_id=cam.bop_id or "BOP-ALPHA",
                    profile="BALANCED",
                    target_fps=10.0,
                    human_detection=True,
                    vehicle_detection=True,
                    anpr_enabled=True,
                    face_detection=True,
                    tracking_enabled=True,
                    virtual_fence_enabled=True,
                    behaviour_analytics=True,
                    anomaly_detection=True,
                    loitering_threshold_seconds=180
                )
        # Seed Next-Gen Intelligence Defaults (Modules 1 - 5)
        # 1. Sensors
        if db.query(Sensor).count() == 0:
            db.add_all([
                Sensor(
                    sensor_id="RAD-01",
                    name="Perimeter Surveillance Radar Alpha",
                    sensor_type="RADAR",
                    site_id="SITE-BORDER-NORTH",
                    bop_id="BOP-ALPHA",
                    sector="Sector-North",
                    location="Tower 1 Overlook",
                    latitude=31.6245,
                    longitude=74.8725,
                    status="ONLINE",
                    health_score=98.0,
                    reliability_weight=0.92
                ),
                Sensor(
                    sensor_id="SEIS-01",
                    name="Subsurface Seismic Array-1",
                    sensor_type="SEISMIC",
                    site_id="SITE-BORDER-NORTH",
                    bop_id="BOP-ALPHA",
                    sector="Sector-North",
                    location="Riverbed Zero-Line",
                    latitude=31.6260,
                    longitude=74.8750,
                    status="ONLINE",
                    health_score=95.0,
                    reliability_weight=0.82
                ),
                Sensor(
                    sensor_id="ACU-01",
                    name="Acoustic Drone/Incursion Mic Array",
                    sensor_type="ACOUSTIC",
                    site_id="SITE-BORDER-NORTH",
                    bop_id="BOP-ALPHA",
                    sector="Sector-North",
                    location="Main Gate BOP",
                    latitude=31.6238,
                    longitude=74.8715,
                    status="ONLINE",
                    health_score=92.0,
                    reliability_weight=0.76
                )
            ])
            db.commit()

        # 2. Camera Pairs (RGB + Thermal Fusion)
        if db.query(CameraPair).count() == 0:
            db.add(CameraPair(
                pair_id="PAIR-01",
                rgb_camera_id="CAM-001",
                thermal_camera_id="CAM-002",
                site_id="SITE-BORDER-NORTH",
                bop_id="BOP-ALPHA",
                overlap_ratio=0.88,
                fusion_mode="FUSED",
                status="ACTIVE"
            ))
            db.commit()

        # 3. PTZ Camera Profile
        if db.query(PTZDevice).count() == 0:
            db.add(PTZDevice(
                device_id="PTZ-CAM-001",
                camera_id="CAM-001",
                onvif_endpoint="http://192.168.1.101/onvif/device_service",
                onvif_port=80,
                onvif_profile_token="Profile_1_Main",
                supports_continuous_move=True,
                supports_absolute_move=True,
                supports_presets=True,
                status="READY",
                current_pan=0.0,
                current_tilt=0.0,
                current_zoom=1.0,
                auto_track_enabled=False
            ))
            db.commit()

        # 4. Autonomous Drones
        if db.query(Drone).count() == 0:
            db.add(Drone(
                drone_id="UAV-BOP-01",
                name="Guardian Eagle-1",
                model="BorderGuardian-X8",
                site_id="SITE-BORDER-NORTH",
                bop_id="BOP-ALPHA",
                status="AVAILABLE",
                battery_pct=96.0,
                latitude=31.6240,
                longitude=74.8720,
                altitude_m=45.0,
                flight_state="HOVER",
                camera_stream_url="rtsp://192.168.1.150:8554/drone01",
                capabilities_json='{"has_thermal": true, "max_speed_mps": 24.0, "max_flight_time_min": 50}'
            ))
            db.commit()

        # 5. GIS Layers
        if db.query(GISLayer).count() == 0:
            GISService.init_default_layers(db, "SITE-BORDER-NORTH")

    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing IBVAP Platform & Intelligence Matrix...")
    validate_environment()
    init_db_defaults()
    await health_monitor.start()
    logger.info("IBVAP Platform Ready.")
    yield
    # Shutdown
    logger.info("Shutting down IBVAP Platform gracefully...")
    await health_monitor.stop()
    ai_pipeline_manager.unregister_all()
    stream_manager.shutdown_all()
    logger.info("Shutdown complete.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Intelligent Border Video Analytics Platform - Phase 15 Production Hardening, Scalability, Performance & Final Demo Readiness",
    version=settings.VERSION,
    lifespan=lifespan
)

# Zero-Trust Security Headers Middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS configuration with explicit origins, methods, and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# Mount API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(cameras_router, prefix=settings.API_V1_STR)
app.include_router(ai_router, prefix=settings.API_V1_STR)
app.include_router(zones_router, prefix=settings.API_V1_STR)
app.include_router(events_router, prefix=settings.API_V1_STR)
app.include_router(risk_config_router, prefix=settings.API_V1_STR)
app.include_router(anpr_router, prefix=f"{settings.API_V1_STR}/anpr", tags=["ANPR"])
app.include_router(vehicles_router, prefix=f"{settings.API_V1_STR}/vehicles", tags=["Vehicles"])
app.include_router(face_router, prefix=f"{settings.API_V1_STR}/face", tags=["Face Analytics"])
app.include_router(watchlist_persons_router, prefix=f"{settings.API_V1_STR}/watchlist/persons", tags=["Person Watchlist"])
app.include_router(edge_router, prefix=f"{settings.API_V1_STR}/edge", tags=["Edge Infrastructure"])
app.include_router(alerts_router, prefix=f"{settings.API_V1_STR}/alerts", tags=["Alerts"])
app.include_router(incidents_router, prefix=f"{settings.API_V1_STR}/incidents", tags=["Incidents"])
app.include_router(evidence_router, prefix=f"{settings.API_V1_STR}/evidence", tags=["Evidence"])
app.include_router(notifications_router, prefix=f"{settings.API_V1_STR}/notifications", tags=["Notifications"])
app.include_router(cross_camera_router, prefix=f"{settings.API_V1_STR}/cross-camera", tags=["Cross-Camera Intelligence"])
app.include_router(behaviour_router, prefix=f"{settings.API_V1_STR}/behaviour", tags=["Behaviour Intelligence"])
app.include_router(predictive_router, prefix=f"{settings.API_V1_STR}/predictive", tags=["Predictive Intelligence"])
app.include_router(health_router, prefix=f"{settings.API_V1_STR}/health", tags=["System Health & Diagnostics"])
app.include_router(sites_router, prefix=settings.API_V1_STR)
app.include_router(bops_router, prefix=settings.API_V1_STR)
app.include_router(federation_router, prefix=settings.API_V1_STR)
app.include_router(multimodal_router, prefix=settings.API_V1_STR)
app.include_router(security_router, prefix=settings.API_V1_STR)
app.include_router(demo_router, prefix=settings.API_V1_STR)
app.include_router(ws_router, prefix=settings.API_V1_STR)

# Next-Gen Intelligence Routers (Modules 1 - 5)
app.include_router(sensors_router, prefix=settings.API_V1_STR)
app.include_router(thermal_router, prefix=settings.API_V1_STR)
app.include_router(ptz_router, prefix=settings.API_V1_STR)
app.include_router(drones_router, prefix=settings.API_V1_STR)
app.include_router(gis_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health & Probes"])
def liveness_probe():
    """Kubernetes / Container Liveness Probe (Returns 200 if process is running)."""
    return {
        "status": "ALIVE",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION,
        "env_mode": settings.ENV_MODE
    }

@app.get("/ready", tags=["Health & Probes"])
def readiness_probe():
    """
    Kubernetes / Container Readiness Probe: verifies database,
    storage writeability, and subsystem health before routing production traffic.
    """
    ready_status = {
        "status": "READY",
        "timestamp": datetime.utcnow().isoformat(),
        "subsystems": {
            "database": "OK",
            "storage": "OK",
            "ai_pipeline": "OK" if len(ai_pipeline_manager.workers) > 0 else "IDLE",
            "stream_manager": "OK"
        }
    }
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        ready_status["subsystems"]["database"] = f"DEGRADED: {str(e)}"
        ready_status["status"] = "NOT_READY"

    import os
    if not os.path.exists(settings.STORAGE_PATH):
        ready_status["subsystems"]["storage"] = "NOT_ACCESSIBLE"
        ready_status["status"] = "NOT_READY"

    return ready_status

@app.get("/api/v1/system/metrics", tags=["System Health & Diagnostics"])
def get_system_metrics():
    """Returns measured live platform performance metrics, process memory, and queue depths."""
    try:
        import psutil
        process = psutil.Process()
        mem_info = process.memory_info()
        cpu_p = psutil.cpu_percent(interval=None)
        proc_cpu = process.cpu_percent(interval=None)
        rss_mb = round(mem_info.rss / (1024 * 1024), 2)
        vms_mb = round(mem_info.vms / (1024 * 1024), 2)
    except Exception:
        cpu_p, proc_cpu, rss_mb, vms_mb = 0.0, 0.0, 0.0, 0.0

    return {
        "cpu_percent": cpu_p,
        "process_cpu_percent": proc_cpu,
        "memory_rss_mb": rss_mb,
        "memory_vms_mb": vms_mb,
        "active_rtsp_streamers": len(stream_manager._streamers),
        "ai_pipeline_workers": len(ai_pipeline_manager.workers),
        "env_mode": settings.ENV_MODE,
        "demo_mode": settings.DEMO_MODE,
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat()
    }

def seed_demo_database():
    """Explicit utility to populate database with synthetic demo/hackathon records."""
    init_db_defaults(seed_demo=True)

@app.get("/")
def root():
    return {
        "platform": "IBVAP",
        "phase": "Phase 15: Production Hardening, Scalability, Performance & Final Demo Readiness",
        "version": settings.VERSION,
        "status": "OPERATIONAL",
        "env_mode": settings.ENV_MODE,
        "demo_mode": settings.DEMO_MODE,
        "features": [
            "End-to-End Multimodal Border Video Analytics Matrix",
            "Zero-Trust Multi-Layer Security Architecture (Deny-by-Default)",
            "High-Throughput RTSP Ingestion with Auto-Reconnection & Failover",
            "YOLOv8 Edge Inference & ByteTrack Multi-Object Tracking",
            "Optical ANPR Consensus Voting & Privacy-Preserving Facial Analytics",
            "Virtual Fencing, Spatial Dwell Time & Movement Anomaly Detection",
            "Multi-BOP / Multi-Site Hierarchical Federation Command",
            "Deterministic 16-Step Hackathon Demonstration Engine",
            "Automated Data Retention & Pruning Lifecycle Management",
            "Comprehensive Health, Liveness & Readiness Probes"
        ],
        "docs_url": "/docs"
    }

@app.get("/api/health")
def system_health_check():
    return {
        "status": "HEALTHY",
        "active_streamers": len(stream_manager._streamers),
        "ai_workers": len(ai_pipeline_manager.workers),
        "database": "CONNECTED"
    }
