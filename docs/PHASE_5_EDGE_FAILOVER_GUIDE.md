# IBVAP Phase 5: Edge AI, Offline Mode, Store-and-Forward & Failover Guide

## Overview & Architecture

**Phase 5 of IBVAP** empowers remote Border Outposts (BOPs) with distributed Edge Computing, durable offline mode, prioritized store-and-forward synchronization, adaptive low-bandwidth streaming, and isolated service/camera failover.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Existing IP CCTV Camera                         │
│                    RTSP Stream Ingestion (TCP/UDP)                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          EDGE NODE APPLIANCE                           │
│                       (e.g., NVIDIA Jetson / IPC)                      │
│  ├── Ingestion & Process Isolation                                     │
│  ├── Local AI Inference (YOLO + ByteTrack)                             │
│  ├── Local Behaviour & Virtual Zone Analysis                           │
│  ├── ANPR & Facial Analytics Quality Gates                             │
│  ├── Risk Scoring & Incident Engine                                    │
│  ├── Hardware & Telemetry Monitor (CPU, RAM, Disk, GPU)                │
│  ├── Durable Local Storage Queue (`EdgeEventBuffer`)                   │
│  └── Store-and-Forward Sync Engine                                     │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
      [ONLINE]: Fast Streaming             [OFFLINE]: Zero Loss
      Metadata & Event Telemetry           Buffer Events Locally
                    │                                │
                    ▼                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CENTRAL IBVAP SERVER                            │
│  ├── Authenticated Node Gateway                                        │
│  ├── Heartbeat & Health Monitor                                        │
│  ├── Idempotent Batch Ingestion (Duplicate Prevention)                 │
│  ├── Remote Configuration Management                                   │
│  └── Central Command Dashboard (WebSockets)                            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Edge Node Architecture & Heartbeats

- **Node Identity & Assignment:**
  Each outpost appliance registers with a unique `node_id` (e.g. `EDGE-BOP-001`), assigned to specific BOP sites (e.g. *BOP Alpha*).
- **Periodic Telemetry Heartbeat:**
  Every 15-30s, edge nodes dispatch lightweight health reports containing:
  - `cpu_percent`, `memory_percent`, `disk_percent`, `gpu_percent`
  - `active_cameras_count`, `total_cameras_count`
  - `queued_events_count` (local buffer depth)
  - `latency_ms` and `config_version`
- **Automatic State Machine:**
  - `ONLINE`: Normal operational status.
  - `DEGRADED`: Network latency $>300\text{ms}$ or high queue depth ($>20$ pending events).
  - `OFFLINE`: Missed heartbeat timeout ($>60\text{s}$).

---

## 2. Zero-Loss Offline Mode & Durable Storage

When internet or cellular uplink drops:
1. **AI Processing Continues:** Camera ingestion, YOLO tracking, intrusion detection, ANPR, and face analytics run locally with zero degradation.
2. **Durable Local Storage:** Events are saved to `EdgeEventBuffer` in persistent SQLite/NVMe storage (never RAM-only) with priority ratings.

---

## 3. Prioritized Store-and-Forward Synchronization

Upon network restoration:
1. **Priority Ordering:** Pending queue is sorted strictly by tactical severity:
   1. `CRITICAL` (Intrusions, watchlist potential matches)
   2. `HIGH` (Suspicious loitering, wrong direction)
   3. `MEDIUM` (Buffer zone crossings, vehicle speed alerts)
   4. `LOW` (Routine classification metadata)
2. **Idempotent Ingestion:** Every event carries a globally unique `event_id` (`EVT-{node}-{date}-{seq}`). If network retransmits an event, central ingestion recognizes it as duplicate and acknowledges safely without creating duplicate database entries.

---

## 4. Low-Bandwidth Mode & Stream Profiles

- **Event-First Architecture:** Video streams are not continuously uploaded to central headquarters. Instead, lightweight JSON event telemetry and selected snapshot evidence are transferred.
- **Adaptive Remote Preview:**
  - `HIGH`: 1080p (Standard Broadband)
  - `MEDIUM`: 720p (Constrained 4G/Cellular)
  - `LOW`: 360p (Satellite / Tactical Radio)

---

## 5. Camera & Service Failover Isolation

- **Camera Isolation:** If an RTSP stream on `CAM-001` drops or encounters network jitter, its isolated thread reconnects with exponential backoff without affecting `CAM-002`, `CAM-003`, or `CAM-004`.
- **AI Worker Recovery:** If an unhandled inference exception occurs, the worker logs the error, attempts an isolated process restart, and flags `ai_status = 'ERROR'` while live video streaming remains active.
- **Power Failure Recovery:** Persistent queues retain pending events across edge hardware reboots, resuming synchronization automatically once connectivity is verified.

---

## 6. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/edge/nodes` | List registered edge appliances with live telemetry |
| `POST` | `/api/v1/edge/nodes` | Register a new edge appliance |
| `GET` | `/api/v1/edge/nodes/{id}` | Get single node telemetry |
| `PUT` | `/api/v1/edge/nodes/{id}/config` | Remote configuration update (increments `config_version`) |
| `POST` | `/api/v1/edge/heartbeat` | Ingest live heartbeat telemetry |
| `POST` | `/api/v1/edge/sync` | Idempotent batch store-and-forward event ingestion |
| `GET` | `/api/v1/edge/sync/stats` | Aggregated sync queue and node health stats |

---

## 7. Automated Test Results

### Backend Automated Test Suite:
```bash
python -m pytest backend/tests
```
**Result:** **48 passed in 45.76s** (100% pass rate across Phases 1, 2, 3, 4, and 5).

### Frontend Production Build:
```bash
npm run build
```
**Result:** **Built in 3.98s with 0 errors** (`dist/`).
