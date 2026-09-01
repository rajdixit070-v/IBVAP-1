import os
import json
import uuid
import shutil
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.security import encrypt_credential
from app.models.federation_models import Organization, Region, Site, BOP
from app.models.edge_node import EdgeNode
from app.models.camera import Camera
from app.models.zone import SecurityZone
from app.models.security_event import SecurityEvent
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.evidence import Evidence
from app.models.notification import Notification
from app.models.anpr_event import ANPREvent
from app.models.face_event import FaceEvent
from app.models.global_track import GlobalTrack
from app.models.track_observation import TrackObservation
from app.models.camera_transition import CameraTransition

logger = logging.getLogger("ibvap.demo.seeder")

def _create_synthetic_jpeg(output_path: str, camera_id: str, title: str, risk_score: int):
    """Generates a realistic tactical forensic HUD JPEG frame on disk."""
    try:
        import cv2
        import numpy as np
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        # Create dark military NVG green / tactical frame
        img = np.zeros((720, 1280, 3), dtype=np.uint8)
        img[:] = (18, 25, 20)
        
        # Grid lines
        for y in range(0, 720, 80):
            cv2.line(img, (0, y), (1280, y), (28, 45, 30), 1)
        for x in range(0, 1280, 80):
            cv2.line(img, (x, 0), (x, 720), (28, 45, 30), 1)
            
        # Target bounding box (Red/Orange)
        bx1, by1, bx2, by2 = 480, 220, 680, 560
        cv2.rectangle(img, (bx1, by1), (bx2, by2), (0, 0, 255), 2)
        cv2.rectangle(img, (bx1, by1 - 32), (bx2, by1), (0, 0, 220), -1)
        cv2.putText(img, f"TARGET: INTRUDER (RISK {risk_score}%)", (bx1 + 5, by1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
                    
        # Reticle crosshair
        cx, cy = (bx1 + bx2) // 2, (by1 + by2) // 2
        cv2.line(img, (cx - 20, cy), (cx + 20, cy), (0, 255, 255), 1)
        cv2.line(img, (cx, cy - 20), (cx, cy + 20), (0, 255, 255), 1)

        # Tactical HUD Banner Top
        cv2.rectangle(img, (0, 0), (1280, 50), (10, 15, 12), -1)
        cv2.line(img, (0, 50), (1280, 50), (0, 200, 100), 1)
        utc_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        cv2.putText(img, f"[IBVAP FORENSIC VAULT] CAM: {camera_id} | {utc_str} | CLASSIFICATION: TOP SECRET",
                    (20, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 120), 2)

        # Tactical HUD Banner Bottom
        cv2.rectangle(img, (0, 670), (1280, 720), (10, 15, 12), -1)
        cv2.line(img, (0, 670), (1280, 670), (0, 200, 100), 1)
        cv2.putText(img, f"INCIDENT PROOF: {title} | INTEGRITY HASH: SHA-256 VERIFIED",
                    (20, 700), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)

        cv2.imwrite(output_path, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    except Exception as e:
        logger.warning(f"Could not generate OpenCV JPEG ({e}). Writing placeholder bytes.")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB\x00C\x00...")


def seed_demo_data(db: Session) -> dict:
    """
    Injects a complete, rich, highly-realistic Border Surveillance demonstration dataset.
    Covers Cameras, Edge Nodes, Zones, Incidents, Threat Events, ANPR, Face, Evidence JPEGs.
    """
    now = datetime.utcnow()
    
    # 1. Organization & Regional Topology
    if not db.query(Organization).filter(Organization.org_id == "ORG-IBVAP").first():
        db.add(Organization(
            org_id="ORG-IBVAP",
            name="IBVAP Command Central",
            code="ORG-1",
            description="Intelligent Border Video Analytics Central Federation",
            status="ACTIVE"
        ))
    if not db.query(Region).filter(Region.region_id == "REG-NORTH").first():
        db.add(Region(
            region_id="REG-NORTH",
            org_id="ORG-IBVAP",
            name="Northern Border Sector",
            code="R-NORTH",
            description="Northern Mountain & River Border Theater",
            status="ACTIVE"
        ))
    if not db.query(Site).filter(Site.site_id == "SITE-BORDER-NORTH").first():
        db.add(Site(
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
        ))
    db.commit()

    # 2. Border Outposts (BOPs)
    bops = [
        ("BOP-ALPHA", "BOP Alpha", "BOP-A", "Northern Gateway Outpost and Perimeter Wire Surveillance", "Tower Alpha HQ", 32.7266, 74.8570, "CRITICAL"),
        ("BOP-BRAVO", "BOP Bravo", "BOP-B", "Riverbed Crossing Tactical Outpost", "Observation Post 3", 32.7310, 74.8620, "HIGH"),
        ("BOP-CHARLIE", "BOP Charlie", "BOP-C", "Mountain Pass Reserve Observation Outpost", "Hilltop Post 7", 32.7380, 74.8690, "NORMAL")
    ]
    for b_id, b_name, b_code, b_desc, b_loc, b_lat, b_lon, b_prio in bops:
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

    # 3. Edge Nodes (NVIDIA Jetson / Rugged Appliance)
    if db.query(EdgeNode).count() == 0:
        demo_nodes = [
            EdgeNode(
                node_id="EDGE-BOP-001",
                name="BOP Alpha Tactical Gateway",
                bop_site="BOP Alpha",
                location="Tower Alpha HQ",
                status="ONLINE",
                software_version="1.0.0",
                hardware_info="NVIDIA Jetson Orin NX (16GB)",
                cpu_percent=34.2,
                memory_percent=52.8,
                disk_percent=41.5,
                gpu_percent=48.0,
                active_cameras_count=2,
                total_cameras_count=2,
                queued_events_count=0,
                sync_status="SYNCHRONIZED",
                config_version=1,
                low_bandwidth_mode=False,
                latency_ms=22.5,
                last_heartbeat=now,
                created_at=now - timedelta(days=7),
                updated_at=now
            ),
            EdgeNode(
                node_id="EDGE-BOP-002",
                name="BOP Bravo River Gateway",
                bop_site="BOP Bravo",
                location="Observation Post 3",
                status="ONLINE",
                software_version="1.0.0",
                hardware_info="NVIDIA Jetson Orin Nano (8GB)",
                cpu_percent=43.7,
                memory_percent=61.2,
                disk_percent=36.0,
                gpu_percent=56.4,
                active_cameras_count=2,
                total_cameras_count=2,
                queued_events_count=0,
                sync_status="SYNCHRONIZED",
                config_version=1,
                low_bandwidth_mode=False,
                latency_ms=31.0,
                last_heartbeat=now,
                created_at=now - timedelta(days=7),
                updated_at=now
            )
        ]
        db.add_all(demo_nodes)
        db.commit()

    # 4. Realistic Border Cameras
    if db.query(Camera).count() == 0:
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
            ),
            Camera(
                camera_id="CAM-LOCAL",
                camera_name="HQ Tactical Ops Webcam",
                description="Live local command post hardware webcam video feed.",
                bop_site="BOP Alpha",
                sector="Command Sector",
                location="Tactical Operations Center",
                latitude=32.7200,
                longitude=74.8500,
                edge_node_id="LOCAL",
                rtsp_url="webcam://0",
                username="admin",
                encrypted_password=encrypt_credential("SecureCamPass2026"),
                stream_type="main",
                resolution="640x480",
                fps=25.0,
                codec="DirectShow",
                enabled=True,
                status="HEALTHY"
            )
        ]
        db.add_all(demo_cameras)
        db.commit()

    # 5. Security Detection Zones
    if db.query(SecurityZone).count() == 0:
        demo_zones = [
            SecurityZone(
                zone_id="ZONE-001",
                camera_id="CAM-001",
                name="Zero-Line Restricted Wire",
                zone_type="RESTRICTED",
                polygon_json=json.dumps([{"x": 0.15, "y": 0.30}, {"x": 0.85, "y": 0.30}, {"x": 0.85, "y": 0.80}, {"x": 0.15, "y": 0.80}]),
                monitored_classes_json=json.dumps(["person", "vehicle"]),
                direction_rule="ANY_ENTRY",
                severity="CRITICAL",
                enabled=True
            ),
            SecurityZone(
                zone_id="ZONE-002",
                camera_id="CAM-002",
                name="Riverbed Observation Buffer",
                zone_type="BUFFER",
                polygon_json=json.dumps([{"x": 0.20, "y": 0.40}, {"x": 0.80, "y": 0.40}, {"x": 0.80, "y": 0.90}, {"x": 0.20, "y": 0.90}]),
                monitored_classes_json=json.dumps(["person", "vehicle", "animal"]),
                direction_rule="NONE",
                severity="HIGH",
                enabled=True
            ),
            SecurityZone(
                zone_id="ZONE-003",
                camera_id="CAM-004",
                name="Approach Road Checkpoint Corridor",
                zone_type="MONITORING",
                polygon_json=json.dumps([{"x": 0.30, "y": 0.20}, {"x": 0.70, "y": 0.20}, {"x": 0.70, "y": 0.85}, {"x": 0.30, "y": 0.85}]),
                monitored_classes_json=json.dumps(["vehicle"]),
                direction_rule="SOUTH_WEST",
                severity="MEDIUM",
                enabled=True
            )
        ]
        db.add_all(demo_zones)
        db.commit()

    # 6. Physical Forensic Evidence JPEGs & Records
    evd_dir = "./storage/evidence"
    evd1_path = os.path.join(evd_dir, "CAM-001", "EVD-DEMO-001.jpg")
    evd2_path = os.path.join(evd_dir, "CAM-002", "EVD-DEMO-002.jpg")
    evd3_path = os.path.join(evd_dir, "CAM-004", "EVD-DEMO-003.jpg")
    _create_synthetic_jpeg(evd1_path, "CAM-001", "Zero-Line Perimeter Fence Infiltration", 94)
    _create_synthetic_jpeg(evd2_path, "CAM-002", "Thermal Target Crossing Riverbed", 88)
    _create_synthetic_jpeg(evd3_path, "CAM-004", "Watchlist Vehicle Inbound at High Speed", 82)

    if db.query(Evidence).count() == 0:
        db.add_all([
            Evidence(
                evidence_id="EVD-DEMO-001",
                source_event_id="EVT-DEMO-001",
                camera_id="CAM-001",
                evidence_type="SNAPSHOT",
                file_path=evd1_path,
                checksum_sha256="a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
                mime_type="image/jpeg",
                file_size_bytes=os.path.getsize(evd1_path) if os.path.exists(evd1_path) else 1024,
                created_at=now - timedelta(minutes=15)
            ),
            Evidence(
                evidence_id="EVD-DEMO-002",
                source_event_id="EVT-DEMO-002",
                camera_id="CAM-002",
                evidence_type="SNAPSHOT",
                file_path=evd2_path,
                checksum_sha256="b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01a",
                mime_type="image/jpeg",
                file_size_bytes=os.path.getsize(evd2_path) if os.path.exists(evd2_path) else 1024,
                created_at=now - timedelta(minutes=10)
            ),
            Evidence(
                evidence_id="EVD-DEMO-003",
                source_event_id="EVT-DEMO-003",
                camera_id="CAM-004",
                evidence_type="SNAPSHOT",
                file_path=evd3_path,
                checksum_sha256="c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01ab2",
                mime_type="image/jpeg",
                file_size_bytes=os.path.getsize(evd3_path) if os.path.exists(evd3_path) else 1024,
                created_at=now - timedelta(minutes=4)
            )
        ])
        db.commit()

    # 7. Security Threat Events
    if db.query(SecurityEvent).count() == 0:
        demo_events = [
            SecurityEvent(
                event_id="EVT-DEMO-001",
                camera_id="CAM-001",
                zone_id="ZONE-001",
                zone_name="Zero-Line Restricted Wire",
                track_id=142,
                object_type="person",
                event_type="UNAUTHORIZED_INTRUSION",
                severity="CRITICAL",
                risk_score=94,
                risk_level="CRITICAL",
                status="ACTIVE",
                environment="NIGHT",
                location_description="Tower Alpha-1 Perimeter Fence (North)",
                factors_json=json.dumps([
                    {"factor": "Restricted Zero-Line Infiltration", "weight": 0.45},
                    {"factor": "Concealed Movement Profile", "weight": 0.30},
                    {"factor": "Night-Vision Thermal Confirmation", "weight": 0.19}
                ]),
                timeline_json=json.dumps([
                    {"time": (now - timedelta(minutes=15)).isoformat(), "description": "Target crossed outer perimeter tripwire"},
                    {"time": (now - timedelta(minutes=14)).isoformat(), "description": "Stationary loiter observed near wire gate"}
                ]),
                last_bbox_json=json.dumps({"x": 480, "y": 220, "w": 200, "h": 340}),
                last_direction="SOUTH",
                last_speed=2.4,
                evidence_id="EVD-DEMO-001",
                evidence_file_path=evd1_path,
                started_at=now - timedelta(minutes=15),
                last_updated_at=now - timedelta(minutes=15)
            ),
            SecurityEvent(
                event_id="EVT-DEMO-002",
                camera_id="CAM-002",
                zone_id="ZONE-002",
                zone_name="Riverbed Observation Buffer",
                track_id=88,
                object_type="person",
                event_type="RIVERBED_CROSSING",
                severity="HIGH",
                risk_score=88,
                risk_level="HIGH",
                status="ACTIVE",
                environment="NIGHT",
                location_description="Sector 4 River Post Bravo",
                factors_json=json.dumps([{"factor": "Waterway traversal attempt", "weight": 0.50}]),
                last_bbox_json=json.dumps({"x": 320, "y": 210, "w": 140, "h": 280}),
                last_direction="EAST",
                last_speed=1.8,
                evidence_id="EVD-DEMO-002",
                evidence_file_path=evd2_path,
                started_at=now - timedelta(minutes=10),
                last_updated_at=now - timedelta(minutes=10)
            ),
            SecurityEvent(
                event_id="EVT-DEMO-003",
                camera_id="CAM-004",
                zone_id="ZONE-003",
                zone_name="Approach Road Checkpoint Corridor",
                track_id=55,
                object_type="car",
                event_type="WATCHLIST_VEHICLE_APPROACH",
                severity="HIGH",
                risk_score=82,
                risk_level="HIGH",
                status="ACTIVE",
                environment="DAY",
                location_description="Checkpoint Charlie Approach Corridor",
                factors_json=json.dumps([{"factor": "High speed vehicle approach", "weight": 0.40}]),
                last_bbox_json=json.dumps({"x": 400, "y": 300, "w": 280, "h": 180}),
                last_direction="SOUTH_WEST",
                last_speed=65.0,
                evidence_id="EVD-DEMO-003",
                evidence_file_path=evd3_path,
                started_at=now - timedelta(minutes=4),
                last_updated_at=now - timedelta(minutes=4)
            )
        ]
        db.add_all(demo_events)
        db.commit()

    # 8. High-Priority Operational Alerts
    if db.query(Alert).count() == 0:
        demo_alerts = [
            Alert(
                alert_id="ALT-DEMO-001",
                event_id="EVT-DEMO-001",
                camera_id="CAM-001",
                bop_site="BOP Alpha",
                title="CRITICAL: Zero-Line Wire Infiltration at Tower Alpha-1",
                priority="CRITICAL",
                risk_score=94,
                status="NEW",
                created_at=now - timedelta(minutes=15)
            ),
            Alert(
                alert_id="ALT-DEMO-002",
                event_id="EVT-DEMO-002",
                camera_id="CAM-002",
                bop_site="BOP Alpha",
                title="HIGH: Thermal Target Crossing Riverbed Sector 4",
                priority="HIGH",
                risk_score=88,
                status="NEW",
                created_at=now - timedelta(minutes=10)
            ),
            Alert(
                alert_id="ALT-DEMO-003",
                event_id="EVT-DEMO-003",
                camera_id="CAM-004",
                bop_site="BOP Charlie",
                title="HIGH: Black Scorpio (JK02AA9988) Inbound at High Speed",
                priority="HIGH",
                risk_score=82,
                status="NEW",
                created_at=now - timedelta(minutes=4)
            )
        ]
        db.add_all(demo_alerts)
        db.commit()

    # 9. Tactical Incidents with Playbooks
    if db.query(Incident).count() == 0:
        demo_incidents = [
            Incident(
                incident_id="INC-DEMO-001",
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
                risk_score=94,
                related_cameras_json=json.dumps(["CAM-001", "CAM-002"]),
                playbook_id="PB-VIRTUAL-FENCE",
                checklist_json=json.dumps([
                    {"step_id": 1, "title": "Verify source camera live stream", "required": True, "is_completed": True, "completed_by": "Operator Rao", "completed_at": now.isoformat()},
                    {"step_id": 2, "title": "Review adjacent thermal feed", "required": True, "is_completed": True, "completed_by": "Operator Rao", "completed_at": now.isoformat()},
                    {"step_id": 3, "title": "Dispatch Quick Reaction Team (QRT-1)", "required": True, "is_completed": True, "completed_by": "Capt. Sharma", "completed_at": now.isoformat()},
                    {"step_id": 4, "title": "Intercept and secure border breach coordinates", "required": True, "is_completed": False}
                ]),
                assigned_to="Capt. Sharma",
                assigned_team="Quick Reaction Team Alpha (QRT-1)",
                assigned_unit="Patrol Unit 4",
                timeline_json=json.dumps([
                    {"timestamp": (now - timedelta(minutes=15)).isoformat(), "action": "INCIDENT_CREATED", "actor": "system_ai", "notes": "Automated alarm from CAM-001 YOLOv8."},
                    {"timestamp": (now - timedelta(minutes=12)).isoformat(), "action": "QRT_DISPATCHED", "actor": "Capt. Sharma", "notes": "QRT Alpha en route to Tower Alpha-1."}
                ]),
                created_by="system_ai",
                created_at=now - timedelta(minutes=15),
                updated_at=now - timedelta(minutes=12)
            ),
            Incident(
                incident_id="INC-DEMO-002",
                title="Watchlist Vehicle Inbound at Checkpoint Charlie",
                description="Black Mahindra Scorpio with watchlist license plate JK02AA9988 detected on South Approach.",
                incident_type="SECURITY",
                priority="HIGH",
                status="NEW",
                escalation_level=1,
                source_event_id="EVT-DEMO-003",
                camera_id="CAM-004",
                bop_site="BOP Charlie",
                zone_name="Approach Road Checkpoint Corridor",
                track_id=55,
                risk_score=82,
                related_cameras_json=json.dumps(["CAM-004"]),
                playbook_id="PB-VEHICLE-ANOMALY",
                checklist_json=json.dumps([
                    {"step_id": 1, "title": "Activate hydraulic tire spikes at Gate 2", "required": True, "is_completed": False},
                    {"step_id": 2, "title": "Alert checkpoint guard post with vehicle description", "required": True, "is_completed": False}
                ]),
                assigned_to="Sub-Insp. Verma",
                assigned_team="Checkpoint Charlie Security Unit",
                assigned_unit="Post 2",
                created_by="system_ai",
                created_at=now - timedelta(minutes=4),
                updated_at=now - timedelta(minutes=4)
            )
        ]
        db.add_all(demo_incidents)
        db.commit()

    # 10. ANPR Vehicle Intelligence Events
    if db.query(ANPREvent).count() == 0:
        db.add_all([
            ANPREvent(
                event_id="ANPR-DEMO-001",
                camera_id="CAM-004",
                track_id=55,
                plate_number="JK02AA9988",
                normalized_plate="JK02AA9988",
                confidence=0.97,
                plate_confidence=0.98,
                observations_count=4,
                vehicle_type="suv",
                match_status="WATCHLIST_MATCH",
                matched_owner="Suspect Arms Transporter",
                watchlist_notes="Flagged by intelligence: suspected weapon contraband transport.",
                snapshot_url="/api/v1/evidence/EVD-DEMO-003/file",
                timestamp=now - timedelta(minutes=4)
            ),
            ANPREvent(
                event_id="ANPR-DEMO-002",
                camera_id="CAM-001",
                track_id=32,
                plate_number="DL01CA1234",
                normalized_plate="DL01CA1234",
                confidence=0.95,
                plate_confidence=0.96,
                observations_count=5,
                vehicle_type="truck",
                match_status="AUTHORIZED",
                matched_owner="Indian Army Logistics Convoy",
                watchlist_notes="Standard daily ration & supply truck.",
                timestamp=now - timedelta(minutes=45)
            ),
            ANPREvent(
                event_id="ANPR-DEMO-003",
                camera_id="CAM-004",
                track_id=21,
                plate_number="HR26DQ5566",
                normalized_plate="HR26DQ5566",
                confidence=0.92,
                plate_confidence=0.93,
                observations_count=2,
                vehicle_type="car",
                match_status="MONITOR",
                matched_owner="Civilian Contractor",
                watchlist_notes="Monitored for repeat checkpoint loitering.",
                timestamp=now - timedelta(hours=2)
            )
        ])
        db.commit()

    # 11. Face Recognition Watchlist Events
    if db.query(FaceEvent).count() == 0:
        db.add_all([
            FaceEvent(
                event_id="FACE-DEMO-001",
                camera_id="CAM-001",
                track_id=142,
                match_status="WATCHLIST_POTENTIAL_MATCH",
                matched_person_id="WLIST-PERS-092",
                matched_person_name="Tariq 'Shadow' Ahmed",
                matched_category="HIGH_THREAT",
                similarity_score=0.91,
                quality_score=0.94,
                verification_status="PENDING",
                verification_notes="High cosine similarity with cross-border intrusion suspect watchlist.",
                snapshot_url="/api/v1/evidence/EVD-DEMO-001/file",
                timestamp=now - timedelta(minutes=14)
            ),
            FaceEvent(
                event_id="FACE-DEMO-002",
                camera_id="CAM-001",
                track_id=89,
                match_status="AUTHORIZED_MATCH",
                matched_person_id="AUTH-PERS-014",
                matched_person_name="Havildar Vikram Singh",
                matched_category="ARMED_FORCES",
                similarity_score=0.97,
                quality_score=0.98,
                verification_status="VERIFIED",
                verification_notes="Cleared perimeter patrol commander.",
                timestamp=now - timedelta(minutes=50)
            )
        ])
        db.commit()

    # 12. Movement Intelligence Corridors & Graph Topology
    if db.query(CameraTransition).count() == 0:
        db.add_all([
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
        ])
        db.commit()

    if db.query(GlobalTrack).count() == 0:
        db.add(GlobalTrack(
            global_track_id="GT-DEMO-000101",
            object_type="vehicle",
            primary_identifier="JK02AA9988",
            status="ACTIVE",
            current_camera_id="CAM-004",
            previous_camera_id="CAM-003",
            last_observation_time=now - timedelta(minutes=4),
            total_observations=3,
            overall_confidence=0.95,
            created_at=now - timedelta(minutes=20),
            updated_at=now - timedelta(minutes=4)
        ))
        db.commit()

        db.add_all([
            TrackObservation(
                observation_id="OBS-DEMO-001",
                global_track_id="GT-DEMO-000101",
                camera_id="CAM-002",
                local_track_id=14,
                object_type="vehicle",
                timestamp=now - timedelta(minutes=20),
                bbox_json="[100, 200, 300, 400]",
                direction="EAST",
                plate_number="JK02AA9988",
                plate_confidence=0.94,
                confidence=0.93
            ),
            TrackObservation(
                observation_id="OBS-DEMO-002",
                global_track_id="GT-DEMO-000101",
                camera_id="CAM-003",
                local_track_id=28,
                object_type="vehicle",
                timestamp=now - timedelta(minutes=12),
                bbox_json="[120, 210, 310, 410]",
                direction="SOUTH-EAST",
                plate_number="JK02AA9988",
                plate_confidence=0.96,
                confidence=0.95
            ),
            TrackObservation(
                observation_id="OBS-DEMO-003",
                global_track_id="GT-DEMO-000101",
                camera_id="CAM-004",
                local_track_id=55,
                object_type="vehicle",
                timestamp=now - timedelta(minutes=4),
                bbox_json="[150, 240, 340, 450]",
                direction="SOUTH-WEST",
                plate_number="JK02AA9988",
                plate_confidence=0.98,
                confidence=0.97
            )
        ])
        db.commit()

    # 13. System Notifications for Operators
    if db.query(Notification).count() == 0:
        db.add_all([
            Notification(
                user_id="all",
                alert_id="ALT-DEMO-001",
                title="CRITICAL INTRUSION: Zero-Line Wire Breach",
                message="Target track #142 detected breaching Tower Alpha-1 perimeter. QRT dispatched.",
                priority="CRITICAL",
                read=False,
                created_at=now - timedelta(minutes=15)
            ),
            Notification(
                user_id="all",
                alert_id="ALT-DEMO-003",
                title="WATCHLIST VEHICLE: JK02AA9988 Approaching Checkpoint",
                message="Black Mahindra Scorpio inbound at 65 km/h. Hydraulic spikes standby.",
                priority="HIGH",
                read=False,
                created_at=now - timedelta(minutes=4)
            )
        ])
        db.commit()

    logger.info("Successfully seeded comprehensive demo dataset across all 13 modules.")
    return get_demo_status(db)


def purge_demo_data(db: Session) -> dict:
    """
    Cleans ALL operational demonstration and fake data from the database.
    Resets tables to 0 rows and removes generated evidence images from disk.
    """
    tables = [
        "alerts",
        "security_events",
        "security_threat_events",
        "multimodal_security_events",
        "incidents",
        "incident_relationships",
        "incident_reviews",
        "evidence_records",
        "notifications",
        "global_tracks",
        "track_observations",
        "track_associations",
        "movement_anomalies",
        "anpr_events",
        "face_events",
        "ai_events",
        "ai_observations",
        "camera_transitions",
        "cameras",
        "camera_ai_configs",
        "camera_ai_profiles",
        "camera_health_logs",
        "edge_nodes",
        "edge_node_credentials",
        "edge_event_buffers",
        "security_zones",
        "sites",
        "bops",
        "site_user_scopes",
        "vehicle_watchlist",
        "person_watchlist",
        "early_warnings",
        "baseline_shifts",
        "activity_baselines",
        "activity_snapshots",
        "model_health",
        "health_config_records",
        "maintenance_windows",
        "prediction_feedback",
        "behaviour_feedback",
        "ai_operator_feedbacks"
    ]
    
    for t in tables:
        try:
            db.execute(text(f"DELETE FROM {t}"))
        except Exception as e:
            logger.debug(f"Could not delete from {t}: {e}")

    # Delete non-admin demo users
    try:
        db.execute(text("DELETE FROM users WHERE username != 'admin'"))
    except Exception:
        pass
        
    db.commit()

    # Clean evidence snapshots on disk
    for path in ["./storage/evidence", "./storage/edge_local", "./storage/temp"]:
        if os.path.exists(path):
            try:
                for item in os.listdir(path):
                    full_p = os.path.join(path, item)
                    if os.path.isdir(full_p):
                        shutil.rmtree(full_p)
                    else:
                        os.remove(full_p)
            except Exception as e:
                logger.warning(f"Error purging disk path {path}: {e}")

    logger.info("Successfully purged all operational demo data.")
    return get_demo_status(db)


def simulate_live_threat(db: Session) -> dict:
    """
    Simulates an immediate live high-priority border intruder event:
    Generates a SecurityEvent, Alert, Notification, and Forensic Evidence JPEG.
    Used by the frontend 'SIMULATE LIVE THREAT' button.
    """
    now = datetime.utcnow()
    rand_suffix = uuid.uuid4().hex[:6].upper()
    evt_id = f"EVT-LIVE-{rand_suffix}"
    alt_id = f"ALT-LIVE-{rand_suffix}"
    evd_id = f"EVD-LIVE-{rand_suffix}"
    cam_id = "CAM-001"
    
    # Check if CAM-001 exists; if not, seed first
    if not db.query(Camera).filter(Camera.camera_id == cam_id).first():
        seed_demo_data(db)

    evd_path = f"./storage/evidence/{cam_id}/{evd_id}.jpg"
    _create_synthetic_jpeg(evd_path, cam_id, "LIVE SIMULATED THREAT: ARMED INTRUSION AT ZERO LINE", 98)

    # 1. Forensic Evidence
    db.add(Evidence(
        evidence_id=evd_id,
        source_event_id=evt_id,
        camera_id=cam_id,
        evidence_type="SNAPSHOT",
        file_path=evd_path,
        checksum_sha256="ff00aa11bb22cc33dd44ee55ff66aa77bb88cc99dd00ee11ff22aa33bb44cc55",
        mime_type="image/jpeg",
        file_size_bytes=os.path.getsize(evd_path) if os.path.exists(evd_path) else 2048,
        created_at=now
    ))

    # 2. Security Event
    db.add(SecurityEvent(
        event_id=evt_id,
        camera_id=cam_id,
        zone_id="ZONE-001",
        zone_name="Zero-Line Restricted Wire",
        track_id=int(uuid.uuid4().int % 900 + 100),
        object_type="person",
        event_type="UNAUTHORIZED_INTRUSION",
        severity="CRITICAL",
        risk_score=98,
        risk_level="CRITICAL",
        status="ACTIVE",
        environment="NIGHT",
        location_description="Tower Alpha-1 Perimeter Wire (North Gate)",
        factors_json=json.dumps([
            {"factor": "Direct Wire Breach Detected", "weight": 0.50},
            {"factor": "Rapid Tactical Approach", "weight": 0.30},
            {"factor": "Face Concealment Mask", "weight": 0.18}
        ]),
        timeline_json=json.dumps([
            {"time": now.isoformat(), "description": "Target track identified breaching zero line wire."}
        ]),
        last_bbox_json=json.dumps({"x": 480, "y": 220, "w": 200, "h": 340}),
        last_direction="SOUTH",
        last_speed=3.2,
        evidence_id=evd_id,
        evidence_file_path=evd_path,
        started_at=now,
        last_updated_at=now
    ))

    # 3. Alert
    db.add(Alert(
        alert_id=alt_id,
        event_id=evt_id,
        camera_id=cam_id,
        bop_site="BOP Alpha",
        title="[CRITICAL] LIVE THREAT: Armed Infiltration Detected at Tower Alpha-1",
        priority="CRITICAL",
        risk_score=98,
        status="NEW",
        created_at=now
    ))

    # 4. Notification
    db.add(Notification(
        user_id="all",
        alert_id=alt_id,
        title="LIVE INTRUSION ALARM: Tower Alpha-1",
        message="Simulated intruder breached Zero-Line wire. Threat level CRITICAL (Risk 98).",
        priority="CRITICAL",
        read=False,
        created_at=now
    ))

    db.commit()
    logger.info(f"Simulated live threat injected: Event {evt_id}, Alert {alt_id}")

    return {
        "status": "THREAT_SIMULATED",
        "event_id": evt_id,
        "alert_id": alt_id,
        "camera_id": cam_id,
        "title": "[CRITICAL] LIVE THREAT: Armed Infiltration Detected at Tower Alpha-1",
        "priority": "CRITICAL",
        "risk_score": 98,
        "timestamp": now.isoformat()
    }


def get_demo_status(db: Session) -> dict:
    """Returns whether demonstration mode is active along with module counts."""
    cam_count = db.query(Camera).count()
    node_count = db.query(EdgeNode).count()
    alert_count = db.query(Alert).count()
    event_count = db.query(SecurityEvent).count()
    inc_count = db.query(Incident).count()
    anpr_count = db.query(ANPREvent).count()
    face_count = db.query(FaceEvent).count()
    evd_count = db.query(Evidence).count()
    track_count = db.query(GlobalTrack).count()

    total_records = cam_count + node_count + alert_count + event_count + inc_count + anpr_count + face_count
    is_active = total_records > 0

    return {
        "demo_active": is_active,
        "total_records": total_records,
        "counts": {
            "cameras": cam_count,
            "edge_nodes": node_count,
            "alerts": alert_count,
            "security_events": event_count,
            "incidents": inc_count,
            "anpr_events": anpr_count,
            "face_events": face_count,
            "evidence_snapshots": evd_count,
            "global_tracks": track_count
        }
    }
