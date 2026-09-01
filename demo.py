#!/usr/bin/env python3
"""
IBVAP - Intelligent Border Video Analytics Platform
Unified Demo & Threat Simulation Management CLI

Commands:
    python demo.py load        - Injects rich, realistic demonstration data across all 13 modules
    python demo.py clean       - Completely purges all demo data back to clean 0-row state
    python demo.py status      - Displays current demo mode status and operational table counts
    python demo.py simulate    - Injects a real-time high-priority intruder threat with evidence snapshot
"""

import sys
import os

# Add backend to sys.path so we can import models and services directly
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from app.database import SessionLocal, engine, Base
    from app.services.demo.demo_seeder import (
        seed_demo_data,
        purge_demo_data,
        simulate_live_threat,
        get_demo_status
    )
except ImportError as e:
    print(f"[ERROR] Could not import backend modules: {e}")
    print("Ensure you run this command from the project root with the Python environment active.")
    sys.exit(1)


def print_status(status_data):
    is_active = status_data["demo_active"]
    counts = status_data["counts"]
    
    status_badge = "[ACTIVE] (DEMO LOADED)" if is_active else "[INACTIVE] (SYSTEM CLEAN / 0 ROWS)"
    print("\n" + "=" * 65)
    print("   IBVAP TACTICAL DEMO STATUS & FLEET TELEMETRY")
    print("=" * 65)
    print(f" Mode State            : {status_badge}")
    print(f" Total Operational Rows: {status_data['total_records']}")
    print("-" * 65)
    print(f" - Border Cameras      : {counts['cameras']}")
    print(f" - Remote Edge Nodes   : {counts['edge_nodes']}")
    print(f" - Live Security Alerts: {counts['alerts']}")
    print(f" - Threat Events       : {counts['security_events']}")
    print(f" - Tactical Incidents  : {counts['incidents']}")
    print(f" - ANPR Vehicle Logs   : {counts['anpr_events']}")
    print(f" - Face Watchlist Logs : {counts['face_events']}")
    print(f" - Forensic Snapshots  : {counts['evidence_snapshots']}")
    print(f" - Movement Corridors  : {counts['global_tracks']}")
    print("=" * 65 + "\n")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    cmd = sys.argv[1].lower().strip()

    if cmd in ("load", "seed", "init"):
        print("\n[*] Initializing database & injecting comprehensive demo dataset...")
        db = SessionLocal()
        try:
            status_data = seed_demo_data(db)
            print("[+] Demo data successfully loaded!")
            print_status(status_data)
            print("Tip: Refresh your browser (http://localhost:5173). The 'DEMO MODE ACTIVE'")
            print("     banner and 'SIMULATE LIVE THREAT' button are now available in the header.\n")
        finally:
            db.close()

    elif cmd in ("clean", "purge", "reset", "clear"):
        print("\n[*] Purging all operational demonstration data and evidence files...")
        db = SessionLocal()
        try:
            status_data = purge_demo_data(db)
            print("[+] All demo data cleanly purged! Database reset to 0 rows.")
            print_status(status_data)
            print("Tip: In your browser, the Demo banner and simulation button are now hidden.\n")
        finally:
            db.close()

    elif cmd in ("status", "info", "check"):
        db = SessionLocal()
        try:
            status_data = get_demo_status(db)
            print_status(status_data)
        finally:
            db.close()

    elif cmd in ("simulate", "threat", "alarm"):
        print("\n[*] Triggering immediate live high-priority border intruder simulation...")
        db = SessionLocal()
        try:
            res = simulate_live_threat(db)
            print(f"[!] Threat Triggered : {res['title']}")
            print(f"    Event ID         : {res['event_id']}")
            print(f"    Alert ID         : {res['alert_id']}")
            print(f"    Camera ID        : {res['camera_id']}")
            print(f"    Risk Score       : {res['risk_score']} (CRITICAL)")
            print(f"    Timestamp        : {res['timestamp']}")
            print("[+] Check the Live SOC Command Center and Alerts Stream in your browser!\n")
        finally:
            db.close()

    else:
        print(f"[!] Unknown command '{cmd}'")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
