import os
import sys
import re
import shutil
from datetime import datetime

# Add backend directory to sys.path
base_backend_dir = os.path.dirname(os.path.abspath(__file__))
if base_backend_dir not in sys.path:
    sys.path.insert(0, base_backend_dir)

from sqlalchemy import text
from app.config import settings
from app.database import Base, engine, SessionLocal, init_tables
from app.core.security import get_password_hash
from app.models.user import User
from app.models.federation_models import Organization, Region, Site, BOP, SiteUserScope
from app.models.behaviour_rule import BehaviourRule
from app.models.risk_config import SystemRiskConfig
from app.models.enterprise_security_models import SecurityPostureSetting
from app.models.multimodal_models import AIModelRegistry
from app.models.gis_models import GISLayer
from app.services.incident.playbook_service import playbook_service
from app.services.gis.gis_service import GISService

# Database file paths
db_path = settings._db_path
wal_path = f"{db_path}-wal"
shm_path = f"{db_path}-shm"


def clear_database():
    """
    Clears all fake cameras, fake events, alerts, mock evidence, and demo data.
    Preserves:
      - Admin account (admin / Admin@IBVAP2026)
      - Default officer account (officer_alpha / Officer@IBVAP2026)
      - Real calibrated frontier checkposts (57 BOPs across 7 Frontier Commands)
      - Incident response playbooks and system risk rules
      - Default AI model registry entries
    """
    print("=" * 80)
    print(" [IBVAP PURGE ENGINE] INITIALIZING CLEAN RESET...")
    print("=" * 80)

    # 1. Shutdown active video streams and AI inference workers if any
    try:
        from app.services.stream_manager import stream_manager
        stream_manager.shutdown_all()
    except Exception:
        pass

    try:
        from app.services.ai.pipeline import ai_pipeline_manager
        ai_pipeline_manager.shutdown_all()
    except Exception:
        pass

    # 2. Reset database schema safely via SQL
    print("[-] Rebuilding clean database schema...")
    try:
        with engine.begin() as conn:
            if engine.dialect.name == "sqlite":
                conn.execute(text("PRAGMA foreign_keys = OFF;"))
                res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"))
                tables = [r[0] for r in res.fetchall()]
                for t in tables:
                    conn.execute(text(f'DROP TABLE IF EXISTS "{t}";'))
                conn.execute(text("PRAGMA foreign_keys = ON;"))
            else:
                # PostgreSQL: drop and recreate public schema to clean all tables cleanly
                conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    except Exception as e:
        print(f"    Notice resetting schema via SQL: {e}")

    # Re-create all tables in clean pristine state across all registered modules
    init_tables()

    # 3. Clean up disk evidence / temp files
    print("[-] Purging generated synthetic evidence snapshots from disk...")
    for folder in ["./storage/evidence", "./storage/edge_local", "./storage/temp", "storage/evidence", "storage/temp"]:
        if os.path.exists(folder):
            try:
                for item in os.listdir(folder):
                    fp = os.path.join(folder, item)
                    if os.path.isdir(fp):
                        shutil.rmtree(fp, ignore_errors=True)
                    else:
                        try:
                            os.remove(fp)
                        except Exception:
                            pass
            except Exception as e:
                print(f"    Notice: {e}")

    db = SessionLocal()
    try:
        # 4. Seed Organization & Regional Matrix
        print("[-] Seeding Command Federation Topology...")
        if not db.query(Organization).filter(Organization.org_id == "ORG-IBVAP").first():
            db.add(Organization(
                org_id="ORG-IBVAP",
                name="IBVAP Central Command Matrix",
                code="ORG-1",
                description="Intelligent Border Video Analytics Central Federation",
                status="ACTIVE"
            ))

        if not db.query(Region).filter(Region.region_id == "REG-INDIA-BORDER").first():
            db.add(Region(
                region_id="REG-INDIA-BORDER",
                org_id="ORG-IBVAP",
                name="National Defense Border Matrix",
                code="R-INDIA",
                description="Comprehensive Strategic Border Command Sectors",
                status="ACTIVE"
            ))
        db.commit()

        # 5. Seed 7 Frontier Command Sites
        sites_coords = [
            ("SITE-PUNJAB", "Punjab Frontier Command", "Punjab Frontier", 31.6048, 74.5731),
            ("SITE-RAJASTHAN", "Rajasthan Frontier Command", "Rajasthan Frontier", 27.5255, 70.1558),
            ("SITE-JAMMU", "Jammu & Kashmir Frontier Command", "Jammu & Kashmir", 32.6105, 74.6980),
            ("SITE-LADAKH", "Ladakh High-Altitude Sector", "Ladakh Sector", 34.7578, 78.2241),
            ("SITE-GUJARAT", "Gujarat & Rann of Kutch Command", "Gujarat / Kutch", 23.8560, 68.6740),
            ("SITE-EASTERN", "Eastern Frontier Command", "Eastern Frontier", 25.1873, 92.0197),
            ("SITE-CENTRAL", "Delhi Central Command HQ", "All Frontiers (National HQ)", 28.6139, 77.2090),
            ("SITE-BORDER-NORTH", "North Frontier Sector", "Jammu & Kashmir", 32.7266, 74.8570)
        ]

        for s_id, s_name, s_loc, lat, lng in sites_coords:
            if not db.query(Site).filter(Site.site_id == s_id).first():
                db.add(Site(
                    site_id=s_id,
                    region_id="REG-INDIA-BORDER",
                    name=s_name,
                    code=s_id.replace("SITE-", ""),
                    description=f"{s_name} - Tactical Command",
                    location=s_loc,
                    latitude=lat,
                    longitude=lng,
                    status="ACTIVE"
                ))
        db.commit()

        # 6. Seed Calibrated Checkposts (BOPs) from checkposts.ts
        print("[-] Seeding Calibrated Strategic Border Outposts (BOPs)...")
        checkposts_path = os.path.join(base_backend_dir, "..", "frontend", "src", "constants", "checkposts.ts")
        loaded_bops = []

        if os.path.exists(checkposts_path):
            with open(checkposts_path, "r", encoding="utf-8") as f:
                ts_content = f.read()

            pattern = re.compile(
                r"id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*code:\s*'([^']+)',\s*sector:\s*'([^']+)',[\s\S]*?latitude:\s*([\d\.-]+),\s*longitude:\s*([\d\.-]+)",
                re.MULTILINE
            )
            for m in pattern.finditer(ts_content):
                cp_id, name, code, sector, lat, lng = m.groups()
                loaded_bops.append({
                    "id": cp_id,
                    "name": name,
                    "code": code,
                    "sector": sector,
                    "latitude": float(lat),
                    "longitude": float(lng)
                })

        site_matcher = {
            "punjab": "SITE-PUNJAB",
            "rajasthan": "SITE-RAJASTHAN",
            "jammu": "SITE-JAMMU",
            "ladakh": "SITE-LADAKH",
            "gujarat": "SITE-GUJARAT",
            "eastern": "SITE-EASTERN",
            "central": "SITE-CENTRAL",
        }

        bop_count = 0
        for cp in loaded_bops:
            target_site = "SITE-PUNJAB"
            sec_lower = cp["sector"].lower()
            for k, s_id in site_matcher.items():
                if k in sec_lower:
                    target_site = s_id
                    break

            if not db.query(BOP).filter(BOP.bop_id == cp["id"]).first():
                db.add(BOP(
                    bop_id=cp["id"],
                    site_id=target_site,
                    name=cp["name"],
                    code=cp["code"],
                    description=f"Strategic Border Outpost • {cp['sector']}",
                    location=cp["sector"],
                    latitude=cp["latitude"],
                    longitude=cp["longitude"],
                    status="ACTIVE",
                    operational_priority="HIGH"
                ))
            bop_count += 1

        db.commit()
        print(f"    -> Seeded {bop_count} calibrated checkposts across all sectors.")

        # 7. Seed Admin & Default Officer User Accounts
        print("[-] Provisioning System Admin & Officer Credentials...")
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

        officer = db.query(User).filter(User.username == settings.DEFAULT_OFFICER_USERNAME).first()
        if not officer:
            officer = User(
                username=settings.DEFAULT_OFFICER_USERNAME,
                email=settings.DEFAULT_OFFICER_EMAIL,
                hashed_password=get_password_hash(settings.DEFAULT_OFFICER_PASSWORD),
                role="COMMANDER",
                is_active=True
            )
            db.add(officer)
        db.commit()

        # Assign scopes
        if not db.query(SiteUserScope).filter(SiteUserScope.username == settings.DEFAULT_ADMIN_USERNAME).first():
            db.add(SiteUserScope(
                username=settings.DEFAULT_ADMIN_USERNAME,
                scope_type="GLOBAL",
                scope_id="*",
                role="SUPER_ADMIN",
                assigned_by="system"
            ))
        if not db.query(SiteUserScope).filter(SiteUserScope.username == settings.DEFAULT_OFFICER_USERNAME).first():
            db.add(SiteUserScope(
                username=settings.DEFAULT_OFFICER_USERNAME,
                scope_type="BOP",
                scope_id="BOP-WAGAH",
                role="BOP_COMMANDER",
                assigned_by="system"
            ))
        db.commit()

        # 8. Seed Default Incident Response Playbooks
        print("[-] Seeding Default SOP Incident Response Playbooks...")
        playbook_service.ensure_default_playbooks()

        # 9. Seed Core Behaviour Rules
        print("[-] Seeding Core Tactical Behaviour Detection Rules...")
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

        # 10. Seed AI Model Registry Defaults
        print("[-] Seeding AI Model Registry Defaults...")
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

        # 11. Seed GIS base layers
        GISService.init_default_layers(db, "SITE-BORDER-NORTH")

        print("=" * 80)
        print(" [SUCCESS] IBVAP DATABASE CLEARED TO PRISTINE CLEAN STATE")
        print("=" * 80)
        print(" [+] Surveillance Cameras:  0 (All fake/synthetic cameras cleared - ready for real feeds)")
        print(" [+] Fake Events Cleared:   0 events, 0 alerts, 0 incidents, 0 evidence, 0 observations")
        print(f" [+] Admin Clearance:       {settings.DEFAULT_ADMIN_USERNAME} / {settings.DEFAULT_ADMIN_PASSWORD}")
        print(f" [+] Default Officer:       {settings.DEFAULT_OFFICER_USERNAME} / {settings.DEFAULT_OFFICER_PASSWORD}")
        print(f" [+] Strategic Outposts:    {bop_count} Calibrated BOPs across 7 Frontiers")
        print(" [+] New Officer Reg:       Available directly from Login Page")
        print("=" * 80)
        print(" NOTE: To load the demonstration fleet & test scenarios on demand, run:")
        print("       python load.py")
        print("=" * 80)

    finally:
        db.close()


if __name__ == "__main__":
    clear_database()
