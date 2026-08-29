# IBVAP — Intelligent Border Video Analytics Platform

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18+-61dafb.svg)](https://reactjs.org/)
[![Zero-Trust Security](https://img.shields.io/badge/Security-Zero--Trust%20Hardened-emerald.svg)](docs/SECURITY.md)
[![Tests Passing](https://img.shields.io/badge/Tests-250%2F250%20Passed-brightgreen.svg)](backend/tests/)

IBVAP is a production-grade, distributed edge-to-cloud security analytics platform designed for perimeter defense, real-time intrusion detection, ANPR, facial analytics, multi-camera handover, and federated command center operations across tactical border outposts (BOPs).

---

## 🌟 Key Architecture & Capabilities (Phases 1–15)

1. **RTSP Ingestion & Hardware Telemetry (Phase 1)**: Asynchronous multi-camera ingestion with auto-reconnection, optical blur calculation, and lens tampering detection.
2. **Edge AI & ByteTrack Multi-Object Tracking (Phase 2)**: YOLOv8 real-time object classification and ByteTrack high-efficiency Kalman filter state trajectory tracking.
3. **Virtual Fencing & Zone Intelligence (Phase 3)**: Polygon geometric intrusion detection, directional tripwires, and buffer zones.
4. **ANPR & Facial Recognition (Phase 4)**: Multi-frame character voting consensus and privacy-preserving facial analytics with role-based redaction.
5. **Edge Failover & Offline Sync (Phase 5)**: Local event buffering during network disruption and deduplicated central synchronization.
6. **Command Center & Real-Time Alerts (Phase 6)**: Live map, real-time WebSocket alert broadcasting, and multi-camera walls.
7. **Movement Intelligence & Re-ID (Phase 7)**: Feature embedding extraction, cross-camera trajectory tracking, and global track handover.
8. **Behaviour Analytics & Early Warning (Phase 8)**: Anomaly detection, loitering analysis, speed bursts, and group gathering intelligence.
9. **Predictive Intelligence & Sector Risk (Phase 9)**: Temporal risk heatmaps, shift anomaly prediction, and proactive deployment recommendations.
10. **Incident Command & Tactical Playbooks (Phase 10)**: Automated playbook activation, evidence bundling with SHA-256 integrity, and investigation workflows.
11. **System Health & Self-Diagnostics (Phase 11)**: Explainable 0–100 infrastructure health score, root-cause correlation, and maintenance modes.
12. **Multi-Site / Multi-BOP Central Federation (Phase 12)**: Scoped RBAC, multi-site hierarchy (Org $\rightarrow$ Region $\rightarrow$ Site $\rightarrow$ BOP), and federated search.
13. **Multimodal AI Intelligence Matrix (Phase 13)**: Detection fusion, 7-stage event timelines, causal relationship graphs, and natural language AI search.
14. **Enterprise Zero-Trust Cybersecurity (Phase 14)**: Rate limiting, account lockout, IDOR defense, RTSP password encryption, SSRF protection, and threat correlation.
15. **Production Hardening, Scalability & Verification (Phase 15)**: Liveness/readiness probes, metrics, data retention lifecycle, real RTSP IP camera support, and fully isolated demonstration engine.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- (Optional) NVIDIA GPU for hardware-accelerated AI inference

### 2. Backend Setup
```bash
# 1. Setup virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Configure environment
cp backend/.env.example backend/.env

# 4. Start Backend Server
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser. Default Admin Login: `admin` / `Admin@IBVAP2026`.

---

## 📹 Real IP / RTSP Camera Setup

To connect live physical cameras in production without demo data:
1. Ensure `.env` sets `DEMO_MODE=false`.
2. Register the camera through the Web UI or via API:
   ```bash
   POST /api/v1/cameras
   {
     "camera_id": "CAM-BOP-01",
     "camera_name": "Perimeter North Thermal",
     "bop_site": "BOP Alpha",
     "sector": "Sector North",
     "site_id": "SITE-BORDER-NORTH",
     "bop_id": "BOP-001",
     "edge_node_id": "EDGE-BOP-001",
     "rtsp_url": "rtsp://camera_ip:554/stream1",
     "username": "operator",
     "password": "CameraPassword123",
     "stream_type": "thermal"
   }
   ```
3. Credentials are encrypted at rest with AES-256 and URLs are masked in logs and API responses.
4. If thermal or drone models are not loaded, the system reports stream available and model unconfigured without fabricating fake detections.

---

## 🧪 Testing & Verification

Run the full automated test suite (250 tests across all 15 phases):
```bash
# Run all tests
python -m pytest backend/tests
```

---

## 📚 Technical Documentation

- **[System Architecture](docs/ARCHITECTURE.md)**: Detailed subsystem diagrams, data flow, and pipeline components.
- **[Production Deployment](docs/DEPLOYMENT.md)**: Containerization, Kubernetes probes, environment configuration, and scaling.
- **[Security Architecture](docs/SECURITY.md)**: Zero-Trust controls, scoped authorization, credential masking, and compliance.
- **[Evaluator & Hackathon Demo Guide](docs/DEMO_GUIDE.md)**: 16-step deterministic demonstration scenarios and evaluator instructions.
- **[REST API Reference](docs/API_REFERENCE.md)**: Endpoints, request schemas, and authentication models.

---

## 🛡️ License & Compliance

Designed and built for national security and border surveillance applications with strict data isolation, privacy preservation, and tamper-evident audit logging.
