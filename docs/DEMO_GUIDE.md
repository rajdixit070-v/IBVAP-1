# IBVAP — Evaluator & Hackathon Demonstration Guide

## 1. Overview

IBVAP includes an isolated, deterministic **Demonstration Engine** designed for live hackathon evaluations, technical walkthroughs, and jury presentations. The demo engine executes realistic multi-step security scenarios without requiring physical border cameras or polluting production databases.

---

## 2. 16-Step Master Hackathon Scenario Walkthrough

| Step | Title | Action / Subsystem | Tactical Outcome |
|---|---|---|---|
| **1** | Camera Stream Ingested | RTSP Ingestion | Ingests 1080p @ 25 FPS stream (`CAM-DEMO-01`) |
| **2** | Person Detected in Frame | YOLOv8 Edge AI | Detects intruder (Confidence 0.94) |
| **3** | Tactical Trajectory Tracked | DeepSORT Kalman Filter | Establishes Track `#TRK-DEMO-8821` heading South-East |
| **4** | Buffer Zone Proximity | Geometric Polygon Intersect | Approaching high-security buffer perimeter |
| **5** | Virtual Fence Breach | Tripwire Crossing Engine | Triggers border breach event |
| **6** | AI Event Created & Correlated | Multimodal Fusion Matrix | Correlates person, night infrared mode, and speed |
| **7** | Risk Score Evaluated | Multi-Signal Risk Engine | Computes Risk Score: **92 / 100 (`CRITICAL`)** |
| **8** | Critical Alert Broadcasted | WebSocket Real-Time Channel | Broadcasts `ALT-DEMO-01` to Command Center |
| **9** | Command Center Displayed | Situational UI Update | Sounds alarm, flashes tactical map marker red |
| **10** | Forensic Evidence Captured | SHA-256 Tamper-Evident Storage | Captures verified high-resolution snapshot |
| **11** | Incident Automatically Opened | Tactical Playbook Activation | Activates `PB-INTRUSION-RESPONSE` |
| **12** | Operator Acknowledged | Duty Officer Response | Duty Officer acknowledges and dispatches Quick Reaction Team |
| **13** | Tactical Interception | Field Patrol Tracking | Patrol arrives on scene; suspect detained |
| **14** | Incident Resolved | Incident Closure | Perimeter confirmed secure; incident closed |
| **15** | Immutable Audit Logged | Compliance Audit Log | Records tamper-evident audit record |
| **16** | End-to-End Complete | Scenario Summary | Full cycle finished in **< 350 ms** detection-to-alert latency |

---

## 3. How to Trigger Scenarios

### Option A: From Command Center UI
1. Click the floating **EVALUATION & DEMO MODE** button at the bottom-right of the screen.
2. Select your scenario:
   - *16-Step Master Intrusion & Incident Workflow*
   - *Vehicle Classification & Speed ANPR*
   - *Cross-Camera Re-Identification & Handover*
   - *Stream Loss & Self-Healing Diagnostics*
3. Click **Step Next** to step through manually, or **Run All Steps** for an automated 1-click execution.

### Option B: From REST API
```bash
# Run Master Scenario
curl -X POST http://localhost:8000/api/v1/demo/run-scenario \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": "HACKATHON_MASTER_FLOW", "auto_run_all": true}'

# Reset Demo State
curl -X POST http://localhost:8000/api/v1/demo/reset \
  -H "Authorization: Bearer <TOKEN>"
```
