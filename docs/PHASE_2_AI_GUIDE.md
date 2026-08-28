# IBVAP Phase 2: Real-Time AI Object Detection, Classification & Tracking Guide

## Overview & Architecture

**Phase 2 of IBVAP** integrates a real-time deep neural network inference layer and multi-frame ByteTrack tracking system directly onto the Phase 1 RTSP streaming foundation.

```
┌────────────────────────────────────────────────────────┐
│               Existing IP CCTV Camera                  │
│       Standard RTSP Stream (TCP Transport)             │
└───────────────────────────┬────────────────────────────┘
                            │ (TCP Socket Ingestion @ 25 FPS)
                            ▼
┌────────────────────────────────────────────────────────┐
│             IBVAP Backend Ingestion Engine             │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Non-Blocking Frame Buffer (Latest BGR Image)   │  │
│  └────────┬──────────────────────────────────┬──────┘  │
│           │ (25 FPS Direct Feed)             │         │
│           │                                  │ (Decoupled @ 10 FPS)
│           ▼                                  ▼
│  ┌──────────────────┐               ┌──────────────────────────────────────┐
│  │ Live Video Feeds │               │       CameraAIWorker (Thread)        │
│  │ (WebSocket/MJPEG)│               │  • YOLO Object Detector              │
│  └──────────────────┘               │    (Person, Vehicle, Animal, Drone)  │
│                                     │  • ByteTrack Multi-Frame Tracker     │
│                                     │    (Persistent Track IDs, States)    │
│                                     │  • Image-Space Direction & Speed     │
│                                     │  • Bounded Trajectory History (30pts)│
│                                     └───────────────┬──────────────────────┘
└─────────────────────────────────────────────────────┼────────────────────────┘
                                                      │ (AI Telemetry JSON)
                                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        IBVAP React Frontend                                  │
│                                                                              │
│  • Tactical Live Video HUD Overlay (Bounding Boxes, Reticles, Badges)        │
│  • Real-Time Object Counters (People, Vehicles, Animals, Total Tracks)       │
│  • AI Engine Status (🟢 AI ACTIVE, 🟡 AI STARTING, ⚪ AI PAUSED, 🔴 AI ERROR) │
│  • Trajectory Path Trails & Direction Vectors                                │
│  • Per-Camera AI Tuning Modal (Confidence Thresholds & Target Inference FPS) │
│  • Dedicated AI Inference Pipeline Matrix Dashboard                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Object Detection Engine (YOLO)

- **Model:** YOLOv8 (default `yolov8n.pt`, with runtime support for `yolov8s`, `yolov8m`, or specialized custom border security weights).
- **Categories Detected:**
  - **Person:** `person` (border patrol, civilians, intruders).
  - **Vehicles:** `car`, `truck`, `bus`, `motorcycle`, `bicycle`, `boat`, `airplane`.
  - **Animals:** `dog`, `horse`, `cow`, `sheep`, `cat`, `bird`, `elephant`, `bear` (border wildlife & livestock).
  - **Drone / UAV Hook:** Pluggable interface for airborne targets (`drone`, `uav`, `quadcopter`).
  - **Other:** `backpack`, `suitcase`, `handbag`.
- **Configurable Thresholds:** Per-category minimum confidence thresholds configured in the database (`CameraAIConfig`) and modifiable on the fly via UI or API.

---

## 2. ByteTrack Multi-Frame Object Tracking

Every active detection is processed through the **ByteTrack** tracking algorithm:
1. **High-Confidence Association:** Matches high-confidence detections ($\ge \text{track\_thresh}$) with active tracks using IoU cost matrices and the Hungarian bipartite matching algorithm.
2. **Low-Confidence Association:** Matches remaining active tracks with lower-confidence detections, preserving continuous tracking through brief occlusions (e.g. foliage, fences, shadows).
3. **State Lifecycle:**
   $$\text{DETECTED} \longrightarrow \text{TRACKING} \longrightarrow \text{TEMPORARILY\_LOST} \longrightarrow \text{REACQUIRED} \longrightarrow \text{EXPIRED}$$
4. **Trajectory & Direction Calculation:**
   - Maintains a bounded FIFO deque of up to 30 center and bottom-center coordinates.
   - Computes displacement vector $(\Delta x, \Delta y)$ to classify image-space direction: `NORTH`, `SOUTH`, `EAST`, `WEST`, `NORTH_EAST`, `NORTH_WEST`, `SOUTH_EAST`, `SOUTH_WEST`, `STATIONARY`, or `UNKNOWN`.
   - Computes relative image-space pixel velocity ($px/s$).

---

## 3. Decoupled Pipeline Architecture & Fault Isolation

- **Asynchronous Decoupling:** Video streaming and AI inference run in isolated worker threads.
  - Video stream runs at full camera frame rate (e.g. 25 FPS).
  - AI worker samples the latest available frame buffer at target inference rate (e.g. 10 FPS) with automatic frame skipping.
- **Fault Isolation:** If an AI model or tracker encounters an exception, the camera stream remains 100% operational, while the AI status transitions to `ERROR`.
- **Multi-Camera Isolation:** Each camera maintains an independent `ByteTracker` instance. Track IDs are unique per camera session (`CAM-001` Track #101 is isolated from `CAM-002` Track #101).

---

## 4. API Endpoints Reference

### REST Endpoints (`/api/v1/ai`):
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/ai/status` | List real-time AI statuses and FPS for all cameras |
| `GET` | `/api/v1/ai/cameras/{id}/status` | Get detailed AI status, latency, and counts for a camera |
| `POST` | `/api/v1/ai/cameras/{id}/enable` | Enable AI inference for a camera |
| `POST` | `/api/v1/ai/cameras/{id}/disable` | Disable/pause AI inference for a camera |
| `GET` | `/api/v1/ai/cameras/{id}/tracks` | List currently active confirmed tracks and trajectories |
| `GET` | `/api/v1/ai/cameras/{id}/config` | Get AI confidence thresholds and target FPS |
| `PUT` | `/api/v1/ai/cameras/{id}/config` | Update AI confidence thresholds and target FPS |
| `GET` | `/api/v1/ai/metrics` | Fleet-wide aggregate inference metrics & hardware stats |

### WebSocket Endpoint:
- **`WS /api/v1/ws/ai-feed/{camera_id}`**:
  High-frequency telemetry stream broadcasting bounding boxes, persistent track IDs, direction, speed, trajectories, and object counts.

---

## 5. Verification & Testing

### Backend Automated Test Suite:
```bash
python -m pytest backend/tests
```
*Executes 22 unit and integration tests covering category mappings, IoU, direction computation, ByteTrack persistent IDs, track expiration, multi-camera isolation, YOLO detector inference, and AI REST APIs.*

### Frontend Production Build:
```bash
cd frontend
npm run build
```
*Builds TypeScript and Vite production bundle (`dist/`).*
