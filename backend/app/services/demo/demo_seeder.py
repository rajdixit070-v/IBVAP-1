import json
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.core.security import encrypt_credential
from app.models.federation_models import Organization, Region, Site, BOP
from app.models.edge_node import EdgeNode
from app.models.camera import Camera
from app.models.camera_transition import CameraTransition
from app.models.global_track import GlobalTrack
from app.models.track_observation import TrackObservation
from app.models.incident import Incident

logger = logging.getLogger("ibvap.demo.seeder")

def seed_demo_data(db: Session):
    """
    Seeds synthetic demo nodes, cameras, transitions, tracks, and incidents.
    Only executed when DEMO_MODE is True.
    """
    now = datetime.utcnow()

    # 1. Seed Phase 12 default Organization, Region, Site, and BOPs
    if not db.query(Organization).filter(Organization.org_id == "ORG-IBVAP").first():
        default_org = Organization(
            org_id="ORG-IBVAP",
            name="IBVAP Command Central",
            code="ORG-1",
            description="Intelligent Border Video Analytics Central Federation",
            status="ACTIVE"
        )
        db.add(default_org)
        db.commit()

    if not db.query(Region).filter(Region.region_id == "REG-NORTH").first():
        default_reg = Region(
            region_id="REG-NORTH",
            org_id="ORG-IBVAP",
            name="Northern Border Sector",
            code="R-NORTH",
            description="Northern Mountain & River Border Theater",
            status="ACTIVE"
        )
        db.add(default_reg)
        db.commit()

    if not db.query(Site).filter(Site.site_id == "SITE-BORDER-NORTH").first():
        default_site = Site(
            site_id="SITE-BORDER-NORTH",
            region_id="REG-NORTH",
            name="Northern Border Tactical Command",
            code="S-NORTH",
            description="Primary tactical border command covering Northern Ridge & Riverbed sectors",
            location="Northern Himalayan Ridge",
            latitude=32.7266,
            longitude=74.8570,
            timezone="UTC+05:30",
            status="ACTIVE"
        )
        db.add(default_site)
        db.commit()

    default_bops = [
        ("BOP-ALPHA", "BOP Alpha", "BOP-A", "Northern Gateway Outpost and Perimeter Wire Surveillance", "Tower Alpha HQ", 32.7266, 74.8570, "CRITICAL"),
        ("BOP-BRAVO", "BOP Bravo", "BOP-B", "Riverbed Crossing Tactical Outpost", "Observation Post 3", 32.7310, 74.8620, "HIGH"),
        ("BOP-CHARLIE", "BOP Charlie", "BOP-C", "Mountain Pass Reserve Observation Outpost", "Hilltop Post 7", 32.7380, 74.8690, "NORMAL")
    ]
    for b_id, b_name, b_code, b_desc, b_loc, b_lat, b_lon, b_prio in default_bops:
        if not db.query(BOP).filter(BOP.bop_id == b_id).first():
            db.add(BOP(
                bop_id=b_id,
                site_id="SITE-BORDER-NORTH",
                name=b_name,
                code=b_code,
                description=b_desc,
                location=b_loc,
                latitude=b_lat,
                longitude=b_lon,
                status="ACTIVE",
                operational_priority=b_prio
            ))
    db.commit()
    logger.info("Seeded Phase 12 default Organization, Region, Site, and BOPs.")

    # 2. Seed initial demo Edge Nodes
    edge_count = db.query(EdgeNode).count()
    if edge_count == 0:
        demo_nodes = [
            EdgeNode(
                node_id="EDGE-BOP-001",
                name="BOP Alpha Tactical Gateway",
                bop_site="BOP Alpha",
                location="Tower Alpha HQ",
                status="ONLINE",
                software_version="1.0.0",
                hardware_info="NVIDIA Jetson Orin NX (16GB)",
                cpu_percent=32.0,
                memory_percent=54.0,
                disk_percent=42.0,
                gpu_percent=45.0,
                active_cameras_count=2,
                total_cameras_count=2,
                queued_events_count=0,
                sync_status="SYNCHRONIZED",
                config_version=1,
                low_bandwidth_mode=False,
                latency_ms=22.5
            ),
            EdgeNode(
                node_id="EDGE-BOP-002",
                name="BOP Bravo River Gateway",
                bop_site="BOP Bravo",
                location="Observation Post 3",
                status="ONLINE",
                software_version="1.0.0",
                hardware_info="NVIDIA Jetson Orin Nano (8GB)",
                cpu_percent=41.0,
                memory_percent=62.0,
                disk_percent=35.0,
                gpu_percent=55.0,
                active_cameras_count=2,
                total_cameras_count=2,
                queued_events_count=0,
                sync_status="SYNCHRONIZED",
                config_version=1,
                low_bandwidth_mode=False,
                latency_ms=35.0
            )
        ]
        db.add_all(demo_nodes)
        db.commit()
        logger.info("Seeded initial demo edge appliances.")

    # 3. Seed initial demo border cameras if DB is empty
    camera_count = db.query(Camera).count()
    if camera_count == 0:
        demo_cameras = [
            Camera(
                camera_id="CAM-001",
                camera_name="Perimeter Gate North-1",
                description="High-definition PTZ camera covering Northern Gate and Perimeter Wire.",
                bop_site="BOP Alpha",
                sector="North Sector",
                location="Tower Alpha-1",
                latitude=32.7266,
                longitude=74.8570,
                edge_node_id="EDGE-BOP-001",
                rtsp_url="synthetic://cam-001/main",
                username="admin",
                encrypted_password=encrypt_credential("SecureCamPass2026"),
                stream_type="main",
                resolution="1920x1080",
                fps=25.0,
                codec="H.264",
                enabled=True,
                status="HEALTHY"
            ),
            Camera(
                camera_id="CAM-002",
                camera_name="Sector 4 River Crossing",
                description="Thermal & Optical dual-sensor camera monitoring riverbed crossing point.",
                bop_site="BOP Alpha",
                sector="Sector 4",
                location="River Post Bravo",
                latitude=32.7310,
                longitude=74.8620,
                edge_node_id="EDGE-BOP-001",
                rtsp_url="synthetic://cam-002/main",
                username="admin",
                encrypted_password=encrypt_credential("SecureCamPass2026"),
                stream_type="thermal",
                resolution="1920x1080",
                fps=25.0,
                codec="H.264",
                enabled=True,
                status="HEALTHY"
            ),
            Camera(
                camera_id="CAM-003",
                camera_name="East Boundary Fencing",
                description="Fixed wide-angle optical camera covering East border fence line.",
                bop_site="BOP Bravo",
                sector="East Sector",
                location="Observation Post 3",
                latitude=32.7150,
                longitude=74.8790,
                edge_node_id="EDGE-BOP-002",
                rtsp_url="synthetic://cam-003/main",
                username="admin",
                encrypted_password=encrypt_credential("SecureCamPass2026"),
                stream_type="main",
                resolution="1920x1080",
                fps=25.0,
                codec="H.264",
                enabled=True,
                status="HEALTHY"
            ),
            Camera(
                camera_id="CAM-004",
                camera_name="South Approach Road",
                description="Long-range optical camera monitoring incoming vehicle approach corridor.",
                bop_site="BOP Charlie",
                sector="South Sector",
                location="Checkpoint Charlie",
                latitude=32.6980,
                longitude=74.8450,
                edge_node_id="EDGE-BOP-002",
                rtsp_url="synthetic://cam-004/main",
                username="admin",
                encrypted_password=encrypt_credential("SecureCamPass2026"),
                stream_type="main",
                resolution="1920x1080",
                fps=25.0,
                codec="H.264",
                enabled=True,
                status="HEALTHY"
            )
        ]
        db.add_all(demo_cameras)
        db.commit()
        logger.info("Seeded initial demo border cameras.")

    # 4. Seed Camera Topology Network Graph
    transition_count = db.query(CameraTransition).count()
    if transition_count == 0:
        demo_transitions = [
            CameraTransition(
                from_camera_id="CAM-001",
                to_camera_id="CAM-002",
                min_travel_time_sec=15.0,
                expected_travel_time_sec=45.0,
                max_travel_time_sec=300.0,
                direction="EAST",
                transition_confidence=0.92,
                is_enabled=True
            ),
            CameraTransition(
                from_camera_id="CAM-002",
                to_camera_id="CAM-003",
                min_travel_time_sec=20.0,
                expected_travel_time_sec=60.0,
                max_travel_time_sec=400.0,
                direction="SOUTH-EAST",
                transition_confidence=0.88,
                is_enabled=True
            ),
            CameraTransition(
                from_camera_id="CAM-003",
                to_camera_id="CAM-004",
                min_travel_time_sec=30.0,
                expected_travel_time_sec=90.0,
                max_travel_time_sec=600.0,
                direction="SOUTH-WEST",
                transition_confidence=0.85,
                is_enabled=True
            )
        ]
        db.add_all(demo_transitions)
        db.commit()
        logger.info("Seeded initial camera network topology transitions.")

    # 5. Seed initial demo Global Tracks
    gt_count = db.query(GlobalTrack).count()
    if gt_count == 0:
        demo_gt = GlobalTrack(
            global_track_id="GT-20260827-000101",
            object_type="vehicle",
            primary_identifier="UP32AB1234",
            status="ACTIVE",
            current_camera_id="CAM-003",
            previous_camera_id="CAM-002",
            last_observation_time=now - timedelta(minutes=2),
            total_observations=3,
            overall_confidence=0.93,
            created_at=now - timedelta(minutes=8),
            updated_at=now - timedelta(minutes=2)
        )
        db.add(demo_gt)
        db.commit()

        demo_obs = [
            TrackObservation(
                observation_id="OBS-20260827-0001",
                global_track_id="GT-20260827-000101",
                camera_id="CAM-001",
                local_track_id=14,
                object_type="vehicle",
                timestamp=now - timedelta(minutes=8),
                bbox_json="[100, 200, 300, 400]",
                direction="EAST",
                plate_number="UP32AB1234",
                plate_confidence=0.96,
                confidence=0.95
            ),
            TrackObservation(
                observation_id="OBS-20260827-0002",
                global_track_id="GT-20260827-000101",
                camera_id="CAM-002",
                local_track_id=28,
                object_type="vehicle",
                timestamp=now - timedelta(minutes=5),
                bbox_json="[120, 210, 310, 410]",
                direction="SOUTH-EAST",
                plate_number="UP32AB1234",
                plate_confidence=0.94,
                confidence=0.92
            ),
            TrackObservation(
                observation_id="OBS-20260827-0003",
                global_track_id="GT-20260827-000101",
                camera_id="CAM-003",
                local_track_id=52,
                object_type="vehicle",
                timestamp=now - timedelta(minutes=2),
                bbox_json="[150, 240, 340, 450]",
                direction="SOUTH-WEST",
                plate_number="UP32AB1234",
                plate_confidence=0.95,
                confidence=0.94
            )
        ]
        db.add_all(demo_obs)
        db.commit()
        logger.info("Seeded initial multi-camera global journey track.")

    # 6. Seed initial demo Incidents with Phase 10 fields
    incident_count = db.query(Incident).count()
    if incident_count == 0:
        demo_incidents = [
            Incident(
                incident_id="INC-2026-000101",
                title="Critical Wire Infiltration near Tower Alpha-1",
                description="Unidentified human track observed breaching Zero-Line Restricted Wire.",
                incident_type="SECURITY",
                priority="CRITICAL",
                status="IN_PROGRESS",
                escalation_level=2,
                source_event_id="EVT-DEMO-001",
                camera_id="CAM-001",
                bop_site="BOP Alpha",
                zone_name="Zero-Line Restricted Wire",
                track_id=142,
                risk_score=91,
                related_cameras_json=json.dumps(["CAM-001", "CAM-002"]),
                playbook_id="PB-VIRTUAL-FENCE",
                checklist_json=json.dumps([
                    {"step_id": 1, "title": "Verify source camera live stream", "required": True, "is_completed": True, "completed_by": "operator", "completed_at": now.isoformat()},
                    {"step_id": 2, "title": "Review adjacent camera feeds", "required": True, "is_completed": True, "completed_by": "operator", "completed_at": now.isoformat()},
                    {"step_id": 3, "title": "Inspect trajectory breadcrumb path", "required": True, "is_completed": False},
                    {"step_id": 4, "title": "Dispatch Quick Reaction Team (QRT)", "required": True, "is_completed": False}
                ]),
                assigned_to="Capt. Rajesh Kumar",
                assigned_team="Quick Reaction Team Alpha (QRT-1)",
                assigned_unit="Patrol Alpha",
                timeline_json=json.dumps([
                    {"timestamp": (now - timedelta(minutes=15)).isoformat(), "action": "INCIDENT_CREATED", "actor": "operator", "notes": "Incident created from intrusion alert."},
                    {"timestamp": (now - timedelta(minutes=12)).isoformat(), "action": "INCIDENT_ASSIGNED", "actor": "supervisor", "notes": "Dispatched QRT-1 to intercept target."}
                ]),
                created_by="operator",
                created_at=now - timedelta(minutes=15),
                updated_at=now - timedelta(minutes=12)
            ),
            Incident(
                incident_id="INC-2026-000102",
                title="Watchlist Target Vehicle Loitering at Sector 4",
                description="License plate UP32AB1234 detected stationary in river crossing buffer.",
                incident_type="SECURITY",
                priority="HIGH",
                status="NEW",
                escalation_level=1,
                source_event_id="EVT-DEMO-002",
                camera_id="CAM-002",
                bop_site="BOP Alpha",
                zone_name="Riverbed Observation Buffer",
                track_id=88,
                global_track_id="GT-20260827-000101",
                risk_score=78,
                related_cameras_json=json.dumps(["CAM-002", "CAM-003"]),
                playbook_id="PB-VEHICLE-ANOMALY",
                timeline_json=json.dumps([
                    {"timestamp": (now - timedelta(minutes=5)).isoformat(), "action": "INCIDENT_CREATED", "actor": "operator", "notes": "Incident created from ANPR watchlist match."}
                ]),
                created_by="operator",
                created_at=now - timedelta(minutes=5),
                updated_at=now - timedelta(minutes=5)
            )
        ]
        db.add_all(demo_incidents)
        db.commit()
        logger.info("Seeded initial demo incidents.")
