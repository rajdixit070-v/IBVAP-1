# IBVAP — Comprehensive System Architecture

## 1. High-Level System Architecture

The **Intelligent Border Video Analytics Platform (IBVAP)** is a production-grade, distributed, zero-trust edge-to-cloud security analytics system designed for perimeter defense, real-time intrusion analytics, automated vehicle classification & ANPR, and hierarchical command center operations.

```
                              TACTICAL BORDER DEPLOYMENT
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   [ CCTV / Thermal / PTZ Cameras ]                                        │
│          │                                                                 │
│          ▼ (RTSP / RTSPS Stream Ingestion)                                 │
│   [ Distributed Edge Appliances / Jetson Nodes ]                           │
│     • Hardware Video Frame Capture & Ring Buffer                          │
│     • Offline Event Buffer & Failover Cache                                │
│     • YOLOv8 Person/Vehicle Detection & DeepSORT Tracking                  │
│     • Multi-Frame ANPR OCR & FastFace Feature Extraction                   │
│          │                                                                 │
│          ▼ (HTTPS / WSS / gRPC Zero-Trust Cryptographic Channel)          │
│   [ Central Command & Analytics Core ]                                     │
│     ┌──────────────────────────────────────────────────────────────────┐   │
│     │  SecurityHeadersMiddleware • AuthRateLimiter • IDOR Guard        │   │
│     │  Multimodal Event Correlation Engine • 7-Stage Risk Fusion       │   │
│     │  Self-Diagnostics & System Health Observer (0-100 Score)         │   │
│     │  Multi-Site / Multi-BOP Federated Hierarchy Routing              │   │
│     │  Tactical Playbook Dispatcher • Incident Management              │   │
│     │  Deterministic 16-Step Hackathon Demonstration Engine            │   │
│     └──────────────────────────────────────────────────────────────────┘   │
│          │                                                                 │
│          ├───────────────────────────────┬─────────────────────────────┐   │
│          ▼                               ▼                             ▼   │
│   [ SQLite / PostgreSQL ]     [ Local SHA-256 Storage ]    [ Web Client UI]│
│   • Indexed Relational Tables • Tamper-Evident Evidence   • Tactical Map   │
│   • Scoped RBAC Matrices      • Incident Snapshots & Clips • Live Stream   │
│   • Audit & Security Logs     • Retention Pruning Lifecycle• SOC Feed      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architecture Subsystems

### 2.1 Video Ingestion & Stream Processing
- **Stream Manager (`stream_manager.py`)**: Asynchronous multi-threaded OpenCV & FFmpeg ingestion with exponential backoff auto-reconnection.
- **Failover & Reconnect**: Tracks camera status (`ONLINE`, `RECONNECTING`, `OFFLINE`, `UNSTABLE`, `MAINTENANCE`) without crashing worker threads.
- **Optical Quality Monitoring**: Laplacian blur estimation, brightness/contrast normalization, and camera lens occlusion/tampering detection.

### 2.2 Artificial Intelligence & Multimodal Correlation
- **Detection & Tracking**: YOLOv8 real-time bounding box inference paired with DeepSORT Kalman filter state estimation.
- **ANPR Consensus**: Multi-frame character voting across frames to correct optical noise without hallucination.
- **Privacy-Preserving Facial Analytics**: Strict confidence thresholding ($\ge 0.85$) with automatic identity redaction for non-admin viewers.
- **Multimodal Correlation**: Fuses detections, tracking vectors, optical plates, face tags, zone polygons, and night lighting into unified high-level security events with explainable risk breakdown factors.

### 2.3 Edge Resilience & Offline Operation
- **Local Buffering**: When central connection drops, edge appliances buffer detections in local SQLite stores.
- **Sync & Deduplication**: On reconnection, events are ingested with batch deduplication keys preventing duplicate alerts.

### 2.4 Multi-Site / Multi-BOP Federation
- **Hierarchy**: Organization $\rightarrow$ Region $\rightarrow$ Site $\rightarrow$ Border Outpost (BOP) $\rightarrow$ Camera.
- **Scoped RBAC**: Operators are restricted to their assigned Site/BOP scopes. Any cross-site access is denied by IDOR security guards.

### 2.5 Zero-Trust Cybersecurity Architecture
- **Fail-Secure Principle**: Deny-by-default on all API endpoints.
- **Brute-Force & Lockout**: 5 failed login attempts trigger automated 15-minute lockout and `BRUTE_FORCE_ATTEMPT` logging.
- **Credential Protection**: RTSP passwords encrypted via Fernet AES-256 and masked in all client responses.
- **SSRF & Path Traversal Shield**: Blocks AWS/GCP cloud metadata (`169.254.169.254`), loopbacks, directory escapes (`../`), and null bytes.
