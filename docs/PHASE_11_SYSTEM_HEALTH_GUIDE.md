# IBVAP Phase 11: AI-Driven System Health, Self-Diagnostics, Resource Optimization & Intelligent Camera Prioritization

## 1. Overview & Architecture

Phase 11 introduces comprehensive infrastructure observability, continuous self-diagnostics, resource optimization, and intelligent camera prioritization to the IBVAP platform. Every tier of the surveillance pipeline is continuously audited:

```
CAMERAS (FPS, Latency, Blur/Brightness Quality, Tampering)
    ↓
RTSP INGESTION (Connection, Reconnects, Interruptions)
    ↓
EDGE APPLIANCES (Heartbeats, CPU, RAM, GPU, Fleet Status)
    ↓
AI INFERENCE PIPELINE (FPS, Latency, Queue Depth, Quality Modulation)
    ↓
NETWORK BACKHAUL (Latency, Packet Loss, Low-Bandwidth Mode)
    ↓
BACKEND & SERVICES (API, DB Latency, Storage, WebSocket Hub)
    ↓
ASYNC QUEUES (Event, AI, Sync, Evidence depths & backlogs)
    ↓
SELF-DIAGNOSTIC ENGINE (Symptom Correlation & Possible Root Cause)
    ↓
INFRASTRUCTURE INCIDENT AUTOMATION (Phase 10 PB-INFRASTRUCTURE-OUTAGE)
    ↓
SYSTEM HEALTH CENTER (0–100 Explainable Score & Mission Control)
```

---

## 2. Key Capabilities Implemented

### 2.1 Explainable System Health Score (0–100)
- The health score is mathematically computed across 5 weighted pillars:
  1. **Camera Availability** (25%): Active online cameras vs total enabled non-maintenance cameras.
  2. **RTSP Stability** (20%): Frame drops and stream reconnect frequency.
  3. **AI Inference Pipeline** (20%): Pipeline worker throughput, latency, and queue backlog.
  4. **Network & Edge Fleet** (20%): Edge appliance heartbeat punctuality and stream round-trip delay.
  5. **Storage & Database Latency** (15%): NVMe disk utilization and SQLite query latency.
- Status classification:
  - `HEALTHY` (85–100)
  - `DEGRADED` (70–84)
  - `WARNING` (50–69)
  - `CRITICAL` (<50)

### 2.2 Camera Health, Optical Quality & Tampering Detection
- Real-time tracking of: `actual_fps`, `expected_fps`, `stream_latency_ms`, `frame_drops`, `reconnect_count`, `priority`.
- Optical image quality analyzer computes:
  - **Blur**: Laplacian variance ($<80$ indicates blur).
  - **Brightness & Low-light Confidence**: Mean luminance.
  - **Contrast**: Standard deviation of pixel intensities.
  - **Tampering & Obstruction**: Detects sudden full-frame darkness, persistent occlusion, or uniform blur; outputs `POTENTIAL_CAMERA_TAMPERING`.
- Modulates downstream AI detection confidence ($0.45\times$ to $1.0\times$) so degraded video cannot produce false high-confidence security triggers.

### 2.3 Edge Fleet Observability & Heartbeat Monitoring
- Edge node telemetry: CPU, RAM, GPU, Disk, Temperature, Queued Events, and Sync status.
- Configurable heartbeat threshold (default: 60s). Stale nodes trigger `EDGE_NODE_UNRESPONSIVE` and automatically enumerate affected camera streams.

### 2.4 Self-Diagnostic Engine & Root Cause Analysis
- Correlates multi-source symptoms into probable root causes:
  - Multi-camera dropout on same edge node $\to$ **EDGE_NODE_UNRESPONSIVE** (Confidence $\ge 90\%$).
  - Sector-wide latency elevation $\to$ **NETWORK_DEGRADATION** (Confidence $\ge 85\%$).
  - Isolated camera offline $\to$ **CAMERA_OFFLINE** (Confidence $\ge 88\%$).
- Adheres strictly to **decision-support language**: outputs **"POSSIBLE ROOT CAUSE"** with confidence percentages and concrete evidence signals.
- Automatically generates Phase 10 **INFRASTRUCTURE INCIDENTS** linked to `PB-INFRASTRUCTURE-OUTAGE`, completely separated from security threat incidents.

### 2.5 Maintenance Mode & Alert Suppression
- Operators can place cameras, edge nodes, or services into Maintenance Mode with reasons and durations (30m to 8h).
- Suppresses false outage alerts during authorized servicing.
- Expired windows automatically transition to `MAINTENANCE WINDOW EXPIRED` without dangerous auto-restoration.

### 2.6 System Health Center Dashboard
- Dedicated frontend operational page ([`SystemHealthCenterPage.tsx`](file:///c:/Users/rajdi/OneDrive/Desktop/IBVAP-1/frontend/src/pages/SystemHealthCenterPage.tsx)) featuring 9 operational drill-down views:
  - Executive Overview
  - Cameras & Video Streams (with interactive priority selectors)
  - Edge Appliances & Fleet
  - AI Pipeline & Queues
  - Diagnostic Engine & Root Causes (with [`DiagnosticDetailModal.tsx`](file:///c:/Users/rajdi/OneDrive/Desktop/IBVAP-1/frontend/src/components/health/DiagnosticDetailModal.tsx))
  - Storage & Evidence Retention Projections
  - Health Event Audit Timeline
  - Maintenance Windows (with [`MaintenanceModal.tsx`](file:///c:/Users/rajdi/OneDrive/Desktop/IBVAP-1/frontend/src/components/health/MaintenanceModal.tsx))
  - Health Threshold Configuration

---

## 3. Verification & Test Summary

- **Phase 11 Dedicated Test Suite**: 11/11 tests passed (`backend/tests/test_phase11_system_health.py`).
- **Platform Regression Suite (Phases 1–11)**: 106/106 tests passed cleanly in 117 seconds.
- **Frontend Production Build**: Clean Vite/TypeScript build with zero errors.
