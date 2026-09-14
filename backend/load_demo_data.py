import os
import sys
import json
from datetime import datetime, timedelta

base_backend_dir = os.path.dirname(os.path.abspath(__file__))
if base_backend_dir not in sys.path:
    sys.path.insert(0, base_backend_dir)

from app.config import settings
from app.database import Base, engine, SessionLocal
from app.core.security import encrypt_credential, get_password_hash
from app.models.camera import Camera
from app.models.ai_config import CameraAIConfig
from app.models.multimodal_models import CameraAIProfile
from app.models.edge_node import EdgeNode
from app.models.zone import SecurityZone
from app.models.security_event import SecurityEvent
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.evidence import Evidence
from app.models.notification import Notification
from app.models.anpr_event import ANPREvent
from app.models.face_event import FaceEvent
from app.models.vehicle_watchlist import VehicleWatchlist
from app.models.person_watchlist import PersonWatchlist
from app.models.thermal_fusion_models import CameraPair
from app.models.ptz_models import PTZDevice
from app.models.drone_models import Drone, DroneMission
from app.models.sensor_models import Sensor, SensorTelemetry, SensorFusionEvent
from app.models.camera_transition import CameraTransition
from app.models.global_track import GlobalTrack
from app.models.track_observation import TrackObservation


def _generate_synthetic_evidence_jpeg(output_path: str, camera_id: str, title: str, risk_score: int):
    """Generates realistic tactical HUD forensic frame on disk."""
    try:
        import cv2
        import numpy as np

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        img = np.zeros((720, 1280, 3), dtype=np.uint8)
        img[:] = (18, 25, 20)

        # Tactical grid lines
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

        # Header HUD
        cv2.rectangle(img, (0, 0), (1280, 50), (10, 15, 12), -1)
        cv2.line(img, (0, 50), (1280, 50), (0, 200, 100), 1)
        utc_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        cv2.putText(img, f"[IBVAP FORENSIC VAULT] CAM: {camera_id} | {utc_str} | CLASSIFICATION: TOP SECRET",
                    (20, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 120), 2)

        # Footer HUD
        cv2.rectangle(img, (0, 670), (1280, 720), (10, 15, 12), -1)
        cv2.line(img, (0, 670), (1280, 670), (0, 200, 100), 1)
        cv2.putText(img, f"INCIDENT PROOF: {title} | INTEGRITY HASH: SHA-256 VERIFIED",
                    (20, 700), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)

        cv2.imwrite(output_path, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    except Exception:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB\x00C\x00DEMO_EVIDENCE")


def load_demo_data():
    """
    Populates full demonstration dataset on demand:
    17 Tactical Border Cameras, Edge Nodes, Security Zones, Threat Events,
    Incidents, Alerts, Evidence JPEGs, ANPR, Face Watchlists, and Drones.
    """
    print("=" * 80)
    print(" [IBVAP DEMO SEEDER] LOADING DEMO DATASET...")
    print("=" * 80)

    db = SessionLocal()
    now = datetime.utcnow()
    pwd_encrypted = encrypt_credential("SecureCamPass2026")

    try:
        # 1. Edge Nodes
        print("[-] Deploying Tactical Edge Nodes...")
        edge_nodes = [
            EdgeNode(
                node_id="EDGE-BOP-001",
                name="BOP Wagah Tactical Edge Gateway",
                bop_site="Attari-Wagah Joint Check Post",
                location="Tower Alpha HQ",
                status="ONLINE",
                software_version="15.0.0",
                hardware_info="NVIDIA Jetson AGX Orin (64GB)",
                cpu_percent=32.4,
                memory_percent=48.2,
                disk_percent=38.0,
                gpu_percent=44.5,
                active_cameras_count=3,
                total_cameras_count=3,
                sync_status="SYNCHRONIZED",
                latency_ms=18.5,
                last_heartbeat=now,
                site_id="SITE-PUNJAB",
                bop_id="BOP-WAGAH"
            ),
            EdgeNode(
                node_id="EDGE-BOP-002",
                name="BOP Longewala Desert Edge Appliance",
                bop_site="Longewala Desert Outpost",
                location="Sand Dune Post Alpha",
                status="ONLINE",
                software_version="15.0.0",
                hardware_info="NVIDIA Jetson Orin NX (16GB)",
                cpu_percent=41.2,
                memory_percent=55.0,
                disk_percent=42.1,
                gpu_percent=52.0,
                active_cameras_count=3,
                total_cameras_count=3,
                sync_status="SYNCHRONIZED",
                latency_ms=26.4,
                last_heartbeat=now,
                site_id="SITE-RAJASTHAN",
                bop_id="BOP-LONGEWALA"
            ),
            EdgeNode(
                node_id="EDGE-BOP-003",
                name="BOP Galwan High-Altitude Tactical Node",
                bop_site="Galwan Valley Forward Post",
                location="PP-14 Tactical Ridge",
                status="ONLINE",
                software_version="15.0.0",
                hardware_info="Ruggedized Defense Compute Unit",
                cpu_percent=45.8,
                memory_percent=60.4,
                disk_percent=35.0,
                gpu_percent=58.2,
                active_cameras_count=3,
                total_cameras_count=3,
                sync_status="SYNCHRONIZED",
                latency_ms=34.0,
                last_heartbeat=now,
                site_id="SITE-LADAKH",
                bop_id="BOP-GALWAN"
            ),
            EdgeNode(
                node_id="EDGE-BOP-004",
                name="BOP Suchetgarh Surveillance Node",
                bop_site="Suchetgarh International Border Post",
                location="RS Pura Zero Point",
                status="ONLINE",
                software_version="15.0.0",
                hardware_info="NVIDIA Jetson Orin Nano (8GB)",
                cpu_percent=38.0,
                memory_percent=50.2,
                disk_percent=40.0,
                gpu_percent=46.0,
                active_cameras_count=3,
                total_cameras_count=3,
                sync_status="SYNCHRONIZED",
                latency_ms=21.0,
                last_heartbeat=now,
                site_id="SITE-JAMMU",
                bop_id="BOP-SUCHETGARH"
            )
        ]
        for node in edge_nodes:
            if not db.query(EdgeNode).filter(EdgeNode.node_id == node.node_id).first():
                db.add(node)
        db.commit()

        # 2. Seed 17 Calibrated Tactical Cameras Across 6 Frontiers
        print("[-] Deploying 17 Tactical Frontier Surveillance Cameras...")
        TACTICAL_CAMERAS = [
            # Punjab Frontier
            {
                "camera_id": "CAM-PUNJAB-WAGAH-01",
                "camera_name": "Wagah Zero-Line Optical PTZ",
                "description": "High-zoom 4K optical PTZ covering Attari-Wagah border crossing gate and zero line.",
                "bop_site": "Attari-Wagah Joint Check Post",
                "bop_id": "BOP-WAGAH",
                "site_id": "SITE-PUNJAB",
                "sector": "Punjab Frontier",
                "location": "Zero Line Gate Tower",
                "latitude": 31.6048,
                "longitude": 74.5731,
                "edge_node_id": "EDGE-BOP-001",
                "stream_type": "main",
                "priority": "CRITICAL"
            },
            {
                "camera_id": "CAM-PUNJAB-WAGAH-02",
                "camera_name": "Wagah Grand Trunk Gate Thermal",
                "description": "FLIR Thermal long-wave sensor for night-vision perimeter surveillance.",
                "bop_site": "Attari-Wagah Joint Check Post",
                "bop_id": "BOP-WAGAH",
                "site_id": "SITE-PUNJAB",
                "sector": "Punjab Frontier",
                "location": "North Observation Post",
                "latitude": 31.6055,
                "longitude": 74.5724,
                "edge_node_id": "EDGE-BOP-001",
                "stream_type": "thermal",
                "priority": "HIGH"
            },
            {
                "camera_id": "CAM-PUNJAB-HUSSAINI-01",
                "camera_name": "Hussainiwala Riverbank Optical",
                "description": "Riverbed & riverine boundary monitoring sensor at Ferozepur.",
                "bop_site": "Hussainiwala Joint Checkpost",
                "bop_id": "BOP-HUSSAINIWALA",
                "site_id": "SITE-PUNJAB",
                "sector": "Punjab Frontier",
                "location": "Sutlej River Tower",
                "latitude": 30.9328,
                "longitude": 74.6052,
                "edge_node_id": "EDGE-BOP-001",
                "stream_type": "main",
                "priority": "HIGH"
            },

            # Rajasthan Desert Frontier
            {
                "camera_id": "CAM-RAJ-LONG-01",
                "camera_name": "Longewala Desert Thermal Radar",
                "description": "Long-range military thermal camera monitoring Thar desert movement.",
                "bop_site": "Longewala Desert Outpost",
                "bop_id": "BOP-LONGEWALA",
                "site_id": "SITE-RAJASTHAN",
                "sector": "Rajasthan Frontier",
                "location": "Sand Dune Tower Alpha",
                "latitude": 27.5255,
                "longitude": 70.1558,
                "edge_node_id": "EDGE-BOP-002",
                "stream_type": "thermal",
                "priority": "CRITICAL"
            },
            {
                "camera_id": "CAM-RAJ-TANOT-01",
                "camera_name": "Tanot Sand Dune Optical Cam",
                "description": "Solar-powered desert border post optical sensor.",
                "bop_site": "Tanot Mata Border Post",
                "bop_id": "BOP-TANOT",
                "site_id": "SITE-RAJASTHAN",
                "sector": "Rajasthan Frontier",
                "location": "Observation Mast 4",
                "latitude": 27.8016,
                "longitude": 70.3541,
                "edge_node_id": "EDGE-BOP-002",
                "stream_type": "main",
                "priority": "NORMAL"
            },
            {
                "camera_id": "CAM-RAJ-MUNABAO-01",
                "camera_name": "Munabao Railway Line Perimeter",
                "description": "Fixed camera covering Thar Express international rail track border fence.",
                "bop_site": "Munabao Border Checkpost (Barmer)",
                "bop_id": "BOP-MUNABAO",
                "site_id": "SITE-RAJASTHAN",
                "sector": "Rajasthan Frontier",
                "location": "Track Milepost 18",
                "latitude": 25.7197,
                "longitude": 70.2520,
                "edge_node_id": "EDGE-BOP-002",
                "stream_type": "main",
                "priority": "HIGH"
            },

            # Jammu & Kashmir
            {
                "camera_id": "CAM-JAMMU-SUCHET-01",
                "camera_name": "Suchetgarh IB Crossing Sensor",
                "description": "RS Pura border post optical pan-tilt-zoom camera.",
                "bop_site": "Suchetgarh International Border Post",
                "bop_id": "BOP-SUCHETGARH",
                "site_id": "SITE-JAMMU",
                "sector": "Jammu & Kashmir",
                "location": "RS Pura Zero Point",
                "latitude": 32.6105,
                "longitude": 74.6980,
                "edge_node_id": "EDGE-BOP-004",
                "stream_type": "main",
                "priority": "CRITICAL"
            },
            {
                "camera_id": "CAM-JAMMU-SAMBA-01",
                "camera_name": "Samba Forward Wire Camera",
                "description": "Smart optical tripwire camera for anti-infiltration surveillance.",
                "bop_site": "Samba Sector Forward Post",
                "bop_id": "BOP-SAMBA-FORWARD",
                "site_id": "SITE-JAMMU",
                "sector": "Jammu & Kashmir",
                "location": "Perimeter Bunk 9",
                "latitude": 32.5562,
                "longitude": 75.1189,
                "edge_node_id": "EDGE-BOP-004",
                "stream_type": "main",
                "priority": "CRITICAL"
            },
            {
                "camera_id": "CAM-JAMMU-URI-01",
                "camera_name": "Uri Kaman Post LoC Bridge",
                "description": "Line of Control bridge surveillance camera.",
                "bop_site": "Kaman Post (Uri LoC)",
                "bop_id": "BOP-URI",
                "site_id": "SITE-JAMMU",
                "sector": "Jammu & Kashmir",
                "location": "Aman Setu Bridgehead",
                "latitude": 34.0886,
                "longitude": 74.0416,
                "edge_node_id": "EDGE-BOP-004",
                "stream_type": "main",
                "priority": "CRITICAL"
            },

            # Ladakh Sector
            {
                "camera_id": "CAM-LADAKH-GALWAN-01",
                "camera_name": "Galwan Valley LAC Tactical Cam",
                "description": "Sub-zero ruggedized tactical sensor overlooking Galwan river confluence.",
                "bop_site": "Galwan Valley Forward Post",
                "bop_id": "BOP-GALWAN",
                "site_id": "SITE-LADAKH",
                "sector": "Ladakh Sector",
                "location": "PP-14 Tactical Ridge",
                "latitude": 34.7578,
                "longitude": 78.2241,
                "edge_node_id": "EDGE-BOP-003",
                "stream_type": "thermal",
                "priority": "CRITICAL"
            },
            {
                "camera_id": "CAM-LADAKH-PANGONG-01",
                "camera_name": "Pangong Tso North Bank Cam",
                "description": "Finger 4 high-altitude long-range optical sensor.",
                "bop_site": "Pangong Tso North Outpost",
                "bop_id": "BOP-PANGONG",
                "site_id": "SITE-LADAKH",
                "sector": "Ladakh Sector",
                "location": "Finger 4 Overlook",
                "latitude": 33.7595,
                "longitude": 78.6674,
                "edge_node_id": "EDGE-BOP-003",
                "stream_type": "main",
                "priority": "HIGH"
            },
            {
                "camera_id": "CAM-LADAKH-DBO-01",
                "camera_name": "DBO Airfield Perimeter Sensor",
                "description": "Daulat Beg Oldi forward air base boundary optical monitor.",
                "bop_site": "Daulat Beg Oldi (DBO) Base",
                "bop_id": "BOP-DBO",
                "site_id": "SITE-LADAKH",
                "sector": "Ladakh Sector",
                "location": "Karakoram Pass Approach",
                "latitude": 35.2536,
                "longitude": 77.9254,
                "edge_node_id": "EDGE-BOP-003",
                "stream_type": "main",
                "priority": "CRITICAL"
            },

            # Gujarat / Kutch
            {
                "camera_id": "CAM-GUJ-CREEK-01",
                "camera_name": "Sir Creek Tidal Marsh Sensor",
                "description": "Amphibious coastal radar & optical camera monitoring Harami Nala channel.",
                "bop_site": "Harami Nala Border Outpost",
                "bop_id": "BOP-HARAMI-NALA",
                "site_id": "SITE-GUJARAT",
                "sector": "Gujarat / Kutch",
                "location": "Creek Pillar 1175",
                "latitude": 23.8560,
                "longitude": 68.6740,
                "edge_node_id": "EDGE-BOP-001",
                "stream_type": "thermal",
                "priority": "CRITICAL"
            },
            {
                "camera_id": "CAM-GUJ-LAKHPAT-01",
                "camera_name": "Lakhpat Salt Desert Perimeter",
                "description": "Salt flat border fence wide-angle sensor.",
                "bop_site": "Lakhpat Border Outpost",
                "bop_id": "BOP-LAKHPAT",
                "site_id": "SITE-GUJARAT",
                "sector": "Gujarat / Kutch",
                "location": "Fort Bastion Tower",
                "latitude": 23.8294,
                "longitude": 68.7842,
                "edge_node_id": "EDGE-BOP-001",
                "stream_type": "main",
                "priority": "NORMAL"
            },

            # Eastern Frontier
            {
                "camera_id": "CAM-EAST-PETRA-01",
                "camera_name": "Petrapole ICP Cargo Terminal",
                "description": "Integrated Check Post optical & ANPR cargo lane camera.",
                "bop_site": "Petrapole ICP Joint Post",
                "bop_id": "BOP-PETRAPOLE",
                "site_id": "SITE-EASTERN",
                "sector": "Eastern Frontier",
                "location": "Terminal Gate 1",
                "latitude": 23.0722,
                "longitude": 88.8953,
                "edge_node_id": "EDGE-BOP-001",
                "stream_type": "main",
                "priority": "HIGH"
            },
            {
                "camera_id": "CAM-EAST-DAWKI-01",
                "camera_name": "Dawki River Crossing Cam",
                "description": "Umngot River suspension bridge international boundary camera.",
                "bop_site": "Dawki Border Checkpost",
                "bop_id": "BOP-DAWKI",
                "site_id": "SITE-EASTERN",
                "sector": "Eastern Frontier",
                "location": "River Checkpoint",
                "latitude": 25.1873,
                "longitude": 92.0197,
                "edge_node_id": "EDGE-BOP-001",
                "stream_type": "main",
                "priority": "HIGH"
            },
            {
                "camera_id": "CAM-EAST-MOREH-01",
                "camera_name": "Moreh Myanmar Friendship Gate",
                "description": "International friendship bridge optical checkpoint.",
                "bop_site": "Moreh Border Outpost",
                "bop_id": "BOP-MOREH",
                "site_id": "SITE-EASTERN",
                "sector": "Eastern Frontier",
                "location": "Gate 2 Friendship Bridge",
                "latitude": 24.2483,
                "longitude": 94.3056,
                "edge_node_id": "EDGE-BOP-001",
                "stream_type": "main",
                "priority": "HIGH"
            }
        ]

        cam_count = 0
        for c_data in TACTICAL_CAMERAS:
            existing = db.query(Camera).filter(Camera.camera_id == c_data["camera_id"]).first()
            synthetic_url = f"synthetic://{c_data['camera_id'].lower()}/live"
            if not existing:
                db.add(Camera(
                    camera_id=c_data["camera_id"],
                    camera_name=c_data["camera_name"],
                    description=c_data["description"],
                    bop_site=c_data["bop_site"],
                    bop_id=c_data["bop_id"],
                    site_id=c_data["site_id"],
                    sector=c_data["sector"],
                    location=c_data["location"],
                    latitude=c_data["latitude"],
                    longitude=c_data["longitude"],
                    edge_node_id=c_data["edge_node_id"],
                    rtsp_url=synthetic_url,
                    username="admin",
                    encrypted_password=pwd_encrypted,
                    stream_type=c_data["stream_type"],
                    resolution="1920x1080",
                    fps=25.0,
                    expected_fps=25.0,
                    priority=c_data["priority"],
                    enabled=True,
                    status="HEALTHY"
                ))
                cam_count += 1

            # AI Config
            ai_cfg = db.query(CameraAIConfig).filter(CameraAIConfig.camera_id == c_data["camera_id"]).first()
            if not ai_cfg:
                db.add(CameraAIConfig(
                    camera_id=c_data["camera_id"],
                    enabled=True,
                    model_name="yolov8n",
                    target_fps=12.0,
                    input_size=640,
                    conf_person=0.40,
                    conf_vehicle=0.45,
                    conf_animal=0.35,
                    conf_drone=0.30,
                    conf_other=0.40
                ))

            # AI Profile
            ai_prof = db.query(CameraAIProfile).filter(CameraAIProfile.camera_id == c_data["camera_id"]).first()
            if not ai_prof:
                db.add(CameraAIProfile(
                    camera_id=c_data["camera_id"],
                    site_id=c_data["site_id"],
                    bop_id=c_data["bop_id"],
                    profile="BALANCED",
                    target_fps=12.0,
                    human_detection=True,
                    vehicle_detection=True,
                    anpr_enabled=True,
                    face_detection=True,
                    tracking_enabled=True,
                    virtual_fence_enabled=True,
                    behaviour_analytics=True,
                    anomaly_detection=True,
                    loitering_threshold_seconds=120
                ))

        db.commit()
        print(f"    -> Deployed {len(TACTICAL_CAMERAS)} cameras with AI Profiles and Stream Endpoints.")

        # 3. Security Detection Zones
        print("[-] Configuring Tactical Security Detection Zones...")
        zones = [
            SecurityZone(
                zone_id="ZONE-WAGAH-01",
                camera_id="CAM-PUNJAB-WAGAH-01",
                name="Wagah Zero-Line Wire Restricted Zone",
                zone_type="RESTRICTED",
                polygon_json=json.dumps([{"x": 0.15, "y": 0.30}, {"x": 0.85, "y": 0.30}, {"x": 0.85, "y": 0.80}, {"x": 0.15, "y": 0.80}]),
                monitored_classes_json=json.dumps(["person", "vehicle"]),
                direction_rule="ANY_ENTRY",
                severity="CRITICAL",
                enabled=True
            ),
            SecurityZone(
                zone_id="ZONE-LONG-01",
                camera_id="CAM-RAJ-LONG-01",
                name="Longewala Desert Buffer Zone",
                zone_type="BUFFER",
                polygon_json=json.dumps([{"x": 0.20, "y": 0.40}, {"x": 0.80, "y": 0.40}, {"x": 0.80, "y": 0.90}, {"x": 0.20, "y": 0.90}]),
                monitored_classes_json=json.dumps(["person", "vehicle", "animal"]),
                direction_rule="NONE",
                severity="HIGH",
                enabled=True
            ),
            SecurityZone(
                zone_id="ZONE-GALWAN-01",
                camera_id="CAM-LADAKH-GALWAN-01",
                name="Galwan Confluence Observation Corridor",
                zone_type="MONITORING",
                polygon_json=json.dumps([{"x": 0.10, "y": 0.20}, {"x": 0.90, "y": 0.20}, {"x": 0.90, "y": 0.85}, {"x": 0.10, "y": 0.85}]),
                monitored_classes_json=json.dumps(["person", "vehicle", "drone"]),
                direction_rule="NONE",
                severity="CRITICAL",
                enabled=True
            )
        ]
        for z in zones:
            if not db.query(SecurityZone).filter(SecurityZone.zone_id == z.zone_id).first():
                db.add(z)
        db.commit()

        # 4. Generate Forensic Evidence Frame on Disk
        evidence_file = os.path.abspath(os.path.join(base_backend_dir, "..", "storage", "evidence", "EV-DEMO-001.jpg"))
        _generate_synthetic_evidence_jpeg(evidence_file, "CAM-PUNJAB-WAGAH-01", "Wagah Zero-Line Infiltration", 94)

        # 5. Security Threat Events
        print("[-] Populating Active Security Threat Telemetry...")
        evt1 = SecurityEvent(
            event_id="EVT-DEMO-001",
            camera_id="CAM-PUNJAB-WAGAH-01",
            zone_id="ZONE-WAGAH-01",
            zone_name="Wagah Zero-Line Wire Restricted Zone",
            track_id=142,
            object_type="person",
            event_type="UNAUTHORIZED_INTRUSION",
            severity="CRITICAL",
            risk_score=94,
            risk_level="CRITICAL",
            status="ACTIVE",
            environment="NIGHT",
            location_description="Zero Line Gate Tower Perimeter Fence (Punjab)",
            factors_json=json.dumps([
                {"factor": "Restricted Zero-Line Infiltration", "weight": 0.45},
                {"factor": "Concealed Movement Profile", "weight": 0.30},
                {"factor": "Thermal Confirmation", "weight": 0.19}
            ]),
            timeline_json=json.dumps([
                {"time": (now - timedelta(minutes=15)).isoformat(), "description": "Subject crossed outer border tripwire"},
                {"time": (now - timedelta(minutes=14)).isoformat(), "description": "Stationary loiter detected near zero line wire"}
            ]),
            last_bbox_json=json.dumps({"x": 480, "y": 220, "w": 200, "h": 340}),
            last_direction="SOUTH",
            last_speed=2.4,
            evidence_file_path=evidence_file,
            started_at=now - timedelta(minutes=15),
            last_updated_at=now - timedelta(minutes=14)
        )
        evt2 = SecurityEvent(
            event_id="EVT-DEMO-002",
            camera_id="CAM-RAJ-LONG-01",
            zone_id="ZONE-LONG-01",
            zone_name="Longewala Desert Buffer Zone",
            track_id=88,
            object_type="vehicle",
            event_type="WATCHLIST_VEHICLE_APPROACH",
            severity="HIGH",
            risk_score=86,
            risk_level="HIGH",
            status="ACTIVE",
            environment="NIGHT",
            location_description="Longewala Sand Dune Tower Alpha (Thar Desert)",
            factors_json=json.dumps([{"factor": "High speed desert vehicle approaching border wire", "weight": 0.50}]),
            last_bbox_json=json.dumps({"x": 320, "y": 210, "w": 140, "h": 280}),
            last_direction="EAST",
            last_speed=65.0,
            started_at=now - timedelta(minutes=10),
            last_updated_at=now - timedelta(minutes=10)
        )
        if not db.query(SecurityEvent).filter(SecurityEvent.event_id == "EVT-DEMO-001").first():
            db.add(evt1)
        if not db.query(SecurityEvent).filter(SecurityEvent.event_id == "EVT-DEMO-002").first():
            db.add(evt2)
        db.commit()

        # 6. Alerts & Incidents
        print("[-] Populating Tactical Incidents & Alert Dispatches...")
        alt1 = Alert(
            alert_id="ALT-DEMO-001",
            event_id="EVT-DEMO-001",
            camera_id="CAM-PUNJAB-WAGAH-01",
            bop_site="Attari-Wagah Joint Check Post",
            title="CRITICAL: Zero-Line Wire Infiltration at Wagah Sector",
            priority="CRITICAL",
            risk_score=94,
            status="NEW",
            created_at=now - timedelta(minutes=15)
        )
        if not db.query(Alert).filter(Alert.alert_id == "ALT-DEMO-001").first():
            db.add(alt1)

        inc1 = Incident(
            incident_id="INC-DEMO-001",
            title="Critical Wire Infiltration near Wagah Zero Line",
            description="Unidentified subject breached Zero-Line Restricted Wire. Thermal tracking active.",
            incident_type="SECURITY",
            priority="CRITICAL",
            status="IN_PROGRESS",
            escalation_level=2,
            source_event_id="EVT-DEMO-001",
            camera_id="CAM-PUNJAB-WAGAH-01",
            bop_site="Attari-Wagah Joint Check Post",
            bop_id="BOP-WAGAH",
            site_id="SITE-PUNJAB",
            zone_name="Wagah Zero-Line Wire Restricted Zone",
            track_id=142,
            risk_score=94,
            related_cameras_json=json.dumps(["CAM-PUNJAB-WAGAH-01", "CAM-PUNJAB-WAGAH-02"]),
            playbook_id="PB-VIRTUAL-FENCE",
            checklist_json=json.dumps([
                {"step_id": 1, "title": "Verify Wagah PTZ optical feed", "required": True, "is_completed": True, "completed_by": "Capt. Surender", "completed_at": now.isoformat()},
                {"step_id": 2, "title": "Cross-reference FLIR thermal channel", "required": True, "is_completed": True, "completed_by": "Capt. Surender", "completed_at": now.isoformat()},
                {"step_id": 3, "title": "Dispatch Quick Reaction Team (QRT-Wagah-1)", "required": True, "is_completed": True, "completed_by": "Capt. Surender", "completed_at": now.isoformat()},
                {"step_id": 4, "title": "Secure perimeter breach point", "required": True, "is_completed": False}
            ]),
            assigned_to="Capt. Surender Singh",
            assigned_team="Quick Reaction Team Wagah (QRT-1)",
            assigned_unit="Patrol Alpha-1",
            timeline_json=json.dumps([
                {"timestamp": (now - timedelta(minutes=15)).isoformat(), "action": "INCIDENT_TRIGGERED", "actor": "YOLOv8 Edge Engine", "notes": "Optical tripwire violated."},
                {"timestamp": (now - timedelta(minutes=12)).isoformat(), "action": "QRT_MOBILIZED", "actor": "Capt. Surender Singh", "notes": "Patrol vehicle dispatched."}
            ]),
            created_by="system_ai",
            created_at=now - timedelta(minutes=15),
            updated_at=now - timedelta(minutes=12)
        )
        if not db.query(Incident).filter(Incident.incident_id == "INC-DEMO-001").first():
            db.add(inc1)

        # Evidence record
        if not db.query(Evidence).filter(Evidence.incident_id == "INC-DEMO-001").first():
            db.add(Evidence(
                evidence_id="EVD-DEMO-001",
                source_event_id="EVT-DEMO-001",
                incident_id="INC-DEMO-001",
                camera_id="CAM-PUNJAB-WAGAH-01",
                evidence_type="SNAPSHOT",
                file_path=evidence_file,
                mime_type="image/jpeg",
                file_size_bytes=1048576,
                checksum_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                created_at=now - timedelta(minutes=14)
            ))
        db.commit()

        # 7. ANPR & Face Recognition Watchlists
        print("[-] Populating Tactical Intelligence Watchlists (ANPR & Facial ReID)...")
        if not db.query(VehicleWatchlist).filter(VehicleWatchlist.plate_number == "JK02AA9988").first():
            db.add(VehicleWatchlist(
                plate_number="JK02AA9988",
                normalized_plate_number="JK02AA9988",
                vehicle_type="suv",
                owner_name="Cross-Border Contraband Syndicate",
                status="WATCHLIST",
                watchlist_category="RESTRICTED_THREAT",
                notes="Suspected weapon/contraband trafficking vehicle."
            ))
        if not db.query(ANPREvent).filter(ANPREvent.event_id == "ANPR-DEMO-001").first():
            db.add(ANPREvent(
                event_id="ANPR-DEMO-001",
                camera_id="CAM-RAJ-MUNABAO-01",
                track_id=55,
                plate_number="JK02AA9988",
                normalized_plate="JK02AA9988",
                confidence=0.97,
                plate_confidence=0.98,
                observations_count=4,
                vehicle_type="suv",
                match_status="WATCHLIST_MATCH",
                matched_owner="Suspect Arms Transporter",
                watchlist_notes="Flagged: suspected weapon transport corridor.",
                timestamp=now - timedelta(minutes=8)
            ))

        if not db.query(PersonWatchlist).filter(PersonWatchlist.person_id == "WLIST-PERS-092").first():
            dummy_emb = json.dumps([0.05] * 128)
            db.add(PersonWatchlist(
                person_id="WLIST-PERS-092",
                display_name="Tariq 'Shadow' Ahmed",
                category="WATCHLIST",
                status="ACTIVE",
                embedding_json=dummy_emb,
                notes="High-priority cross-border infiltration operative."
            ))
        if not db.query(FaceEvent).filter(FaceEvent.event_id == "FACE-DEMO-001").first():
            db.add(FaceEvent(
                event_id="FACE-DEMO-001",
                camera_id="CAM-PUNJAB-WAGAH-01",
                track_id=142,
                match_status="WATCHLIST_POTENTIAL_MATCH",
                matched_person_id="WLIST-PERS-092",
                matched_person_name="Tariq 'Shadow' Ahmed",
                matched_category="HIGH_THREAT",
                similarity_score=0.92,
                quality_score=0.95,
                verification_status="PENDING",
                verification_notes="High cosine similarity with cross-border infiltration suspect.",
                timestamp=now - timedelta(minutes=14)
            ))
        db.commit()

        # 8. Thermal Pair & PTZ Device
        print("[-] Linking Thermal-Optical Sensor Pairs & PTZ Tracking Device...")
        if not db.query(CameraPair).filter(CameraPair.pair_id == "PAIR-WAGAH-01").first():
            db.add(CameraPair(
                pair_id="PAIR-WAGAH-01",
                rgb_camera_id="CAM-PUNJAB-WAGAH-01",
                thermal_camera_id="CAM-PUNJAB-WAGAH-02",
                site_id="SITE-PUNJAB",
                bop_id="BOP-WAGAH",
                overlap_ratio=0.90,
                sync_tolerance_ms=80.0,
                fusion_mode="FUSED",
                status="ACTIVE"
            ))
        if not db.query(PTZDevice).filter(PTZDevice.camera_id == "CAM-PUNJAB-WAGAH-01").first():
            db.add(PTZDevice(
                device_id="PTZ-WAGAH-01",
                camera_id="CAM-PUNJAB-WAGAH-01",
                onvif_endpoint="http://192.168.1.101/onvif/device_service",
                onvif_port=80,
                supports_continuous_move=True,
                supports_absolute_move=True,
                supports_presets=True,
                status="READY",
                current_pan=45.0,
                current_tilt=-12.0,
                current_zoom=3.5,
                auto_track_enabled=True
            ))
        db.commit()

        # 9. Tactical Drone Fleet
        print("[-] Registering Tactical Drone Aerial Recon Fleet...")
        if not db.query(Drone).filter(Drone.drone_id == "DRONE-ALPHA-01").first():
            db.add(Drone(
                drone_id="DRONE-ALPHA-01",
                name="Garuda Tactical Quad-4",
                model="GARUDA-V2-LONG-RANGE",
                site_id="SITE-PUNJAB",
                bop_id="BOP-WAGAH",
                status="ACTIVE",
                battery_pct=84.0,
                latitude=31.6060,
                longitude=74.5740,
                altitude_m=120.0,
                speed_mps=14.5,
                heading_deg=180.0
            ))
            db.add(DroneMission(
                mission_id="MSN-WAGAH-PATROL-01",
                drone_id="DRONE-ALPHA-01",
                objective="Wagah Zero-Line Night Recon Patrol",
                mission_type="PATROL",
                status="ACTIVE",
                priority="HIGH",
                site_id="SITE-PUNJAB",
                bop_id="BOP-WAGAH"
            ))
        db.commit()

        print("=" * 80)
        print(" [SUCCESS] IBVAP DEMO DATASET LOADED SUCCESSFULLY")
        print("=" * 80)
        print(" [+] Tactical Cameras:      17 cameras deployed across 6 Frontier Sectors")
        print(" [+] Tactical Edge Nodes:   4 Jetson Orin appliances online")
        print(" [+] AI Camera Profiles:    17 Edge inference pipelines configured")
        print(" [+] Active Threat Events:  Zero-line infiltration & watchlist vehicles loaded")
        print(" [+] Incidents & Evidence:  Forensic vault HUD frames populated")
        print(" [+] Sensor Fusion:         Thermal pair & optical PTZ tracker linked")
        print(" [+] Drone Fleet:           Garuda Recon Quad-4 airborne patrol active")
        print("=" * 80)
        print(" NOTE: If you wish to wipe this demo data back to a clean state, run:")
        print("       python clear_data.py")
        print("=" * 80)

    finally:
        db.close()


if __name__ == "__main__":
    load_demo_data()
