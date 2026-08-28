# IBVAP Phase 1: RTSP Camera Ingestion & Live Stream Gateway

## Overview & Architecture

The **Intelligent Border Video Analytics Platform (IBVAP)** is engineered for ruggedized border security and perimeter surveillance. Phase 1 establishes the direct video ingestion foundation connecting to existing IP CCTV cameras via RTSP (Real-Time Streaming Protocol) without requiring camera replacement.

```
┌────────────────────────────────────────────────────────┐
│              Existing IP CCTV Cameras                  │
│       Standard RTSP Stream (TCP Transport)             │
│   e.g. rtsp://admin:pass@192.168.1.100:554/stream1     │
└───────────────────────────┬────────────────────────────┘
                            │ (TCP Socket Ingestion)
                            ▼
┌────────────────────────────────────────────────────────┐
│             IBVAP Backend Ingestion Engine             │
│                                                        │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │   RTSPStreamer   │  │       RTSPTester           │  │
│  │ (Worker Thread)  │  │ (TCP Socket + Codec Probe) │  │
│  └────────┬─────────┘  └────────────────────────────┘  │
│           │                                            │
│           ▼                                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Non-Blocking Frame Buffer (Latest BGR + JPEG)   │  │
│  │  • Real-time FPS Meter                           │  │
│  │  • Exponential Backoff Auto-Reconnect (2s - 60s) │  │
│  └────────┬─────────────────────────────────────────┘  │
│           │                                            │
│           ▼                                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │       StreamManager & HealthMonitor              │  │
│  │  • Stalled Frame Detection (>5.0s -> Degraded)   │  │
│  │  • Diagnostic Event Logger                       │  │
│  │  • WebSocket Broadcaster & MJPEG Stream Server   │  │
│  └────────┬─────────────────────────────────────────┘  │
└───────────┼────────────────────────────────────────────┘
            │
            ├──────────────────────────┐
            ▼ (Binary WebSocket)       ▼ (HTTP MJPEG / Snapshot)
┌────────────────────────────────────────────────────────┐
│             IBVAP React + Vite Frontend                │
│                                                        │
│  • Tactical Live Video Wall (1x1 Focus, 2x2, 3x3)      │
│  • Real-time HUD (Status, FPS, Resolution, Latency)    │
│  • BOP Site & Sector Filtering                         │
│  • Deep RTSP Diagnostic Test Modal                     │
│  • AES-256 Safe Password Storage                       │
└────────────────────────────────────────────────────────┘
```

---

## 1. Connecting a Real IP Camera

IBVAP works with standard commercial and military-grade IP cameras (Hikvision, Dahua, Axis, Hanwha, Uniview, Bosch, ONVIF Profile S/T RTSP endpoints).

### Step-by-Step Connection Guide:

1. **Obtain the Camera RTSP Stream URL**
   Typical vendor URL formats:
   - **Hikvision / Uniview:** `rtsp://<camera-ip>:554/Streaming/Channels/101`
   - **Dahua:** `rtsp://<camera-ip>:554/cam/realmonitor?channel=1&subtype=0`
   - **Axis:** `rtsp://<camera-ip>:554/axis-media/media.amp`
   - **Generic / ONVIF:** `rtsp://<camera-ip>:554/live/ch0` or `rtsp://<camera-ip>:554/h264Preview_01_main`

2. **Open Camera Management in IBVAP**
   - Click **"Register New Camera"**.
   - Input the **Camera ID** (e.g., `CAM-NORTH-01`), **BOP Site** (e.g., `BOP Alpha`), and **Sector** (e.g., `Sector 4`).
   - Enter the **RTSP URL**, **Username**, and **Password**.

3. **Perform Pre-Flight Test Connection**
   - Click the **"Test Connection"** button inside the registration form.
   - The backend performs an active socket probe and OpenCV frame acquisition.
   - You will see the decoded resolution (e.g., `1920x1080`), actual stream FPS (`25.0 FPS`), codec (`H.264`), and latency (`18 ms`).

4. **Save & Start Ingestion**
   - Click **"Register Camera"**.
   - The background worker thread automatically opens the stream over TCP and delivers frames to the video wall.

---

## 2. Environment Variables & Security Configuration

| Environment Variable | Default Value | Purpose |
|---|---|---|
| `SECRET_KEY` | `ibvap-secure-production-...` | JWT HMAC-SHA256 signing key |
| `CREDENTIAL_ENCRYPTION_KEY` | `b3B2YXAt...` | AES-256 Fernet symmetric key for encrypting camera credentials |
| `DATABASE_URL` | `sqlite:///./ibvap.db` | Database connection string (SQLite or PostgreSQL) |
| `RTSP_CONNECT_TIMEOUT_SEC` | `8.0` | Timeout threshold when opening camera streams |
| `RTSP_FRAME_TIMEOUT_SEC` | `5.0` | Max silence allowed before marking stream `DEGRADED` |
| `RECONNECT_BACKOFF_BASE` | `2.0` | Base multiplier for exponential backoff retry |
| `RECONNECT_MAX_DELAY_SEC` | `60.0` | Maximum wait ceiling between reconnection attempts |
| `DEFAULT_ADMIN_USERNAME` | `admin` | Initial admin username |
| `DEFAULT_ADMIN_PASSWORD` | `Admin@IBVAP2026` | Initial admin password |

### Security Model:
- **Zero Password Exposure:** Passwords are encrypted at rest with AES-256 before database insertion. The `CameraResponse` API schema strips and masks passwords and credentials from all GET/list responses and logs.
- **RTSP URL Masking:** When URLs contain inline credentials (`rtsp://user:pass@host`), the backend masks them (`rtsp://***:***@host`) in all API responses.
- **Role-Based Access:** Adding, updating, and deleting cameras requires Admin authentication.

---

## 3. Automatic Exponential Backoff Reconnection

If a network cable is unplugged, camera power cycles, or packet loss occurs:
1. `RTSPStreamer` detects frame loss (`consecutive_failures > 5`).
2. Status immediately transitions to `DEGRADED` (attempt #1) or `OFFLINE` (attempt #3+).
3. The background worker calculates backoff:
   $$\text{Delay} = \min(60.0, 2^{\min(\text{attempts}, 6)})$$
   - Attempt 1: 2.0s
   - Attempt 2: 4.0s
   - Attempt 3: 8.0s
   - Attempt 4: 16.0s
   - Attempt 5: 32.0s
   - Attempt 6+: 60.0s (capped)
4. When connectivity returns, the stream resumes smoothly, status transitions back to `HEALTHY`, and a diagnostic event is recorded in `CameraHealthLog`.
5. No memory leaks or orphaned threads are generated.

---

## 4. Troubleshooting Guide

| Issue | Likely Cause | Solution |
|---|---|---|
| `CONNECTION_REFUSED` | Camera IP is unreachable or port 554 is closed by firewall | Check camera power, network ping, and ensure RTSP port 554 is open. |
| `AUTHENTICATION_FAILED` | Incorrect username or password | Verify credentials in camera's web UI. |
| `STREAM_UNAVAILABLE` | Wrong RTSP path (e.g. `/stream1` vs `/ch0`) | Verify vendor documentation for the exact RTSP channel URL. |
| `DECODER_ERROR` | Unsupported video codec or zero-byte stream | Ensure camera is streaming standard H.264 or H.265. |
| `STREAM DEGRADED` | Network congestion / packet drop | Check network switch bandwidth or switch camera to sub-stream. |

---

## 5. Testing & Verification Commands

### Backend Automated Test Suite:
```bash
python -m pytest backend/tests
```
Runs 13 automated unit and integration tests for authentication, camera CRUD, security encryption/masking, stream worker lifecycle, and RTSP connection probes.

### Run Backend API Server:
```bash
python backend/run_backend.py
```
Starts FastAPI on `http://localhost:8000`. Swagger API docs available at `http://localhost:8000/docs`.

### Run Frontend Development Server:
```bash
cd frontend
npm run dev
```
Starts Vite dev server on `http://localhost:5173`.
