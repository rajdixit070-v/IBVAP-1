# IBVAP Phase 3: Virtual Fence, Behavioural Analytics & Threat Risk Scoring Guide

## Overview & Architecture

**Phase 3 of IBVAP** transforms raw AI detections and multi-frame tracks into actionable border surveillance intelligence. It introduces resolution-independent virtual security perimeters, multi-condition behavioural anomaly detectors, false alarm filtering, explainable $0-100$ threat risk scoring, event deduplication, and a real-time Security Operations Center (SOC) incident stream.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Existing IP CCTV Camera                         │
│                  RTSP Stream Ingestion (25 FPS)                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 IBVAP AI Engine (YOLO + ByteTrack)                     │
│            • Persistent Track ID (e.g. #142)                           │
│            • Ground-Plane Bottom-Center Point (x, y in [0.0, 1.0])     │
│            • Image-Space Direction Vector (e.g. SOUTH)                 │
│            • Relative Velocity (e.g. 24 px/s)                          │
│            • Bounded Trajectory History (30 points)                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Phase 3: Intelligence & Analytics Engine                 │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. Spatial Zone Intersection & Boundary Crossing                 │  │
│  │    • Ray-casting point-in-polygon analysis                       │  │
│  │    • State Transitions: OUTSIDE -> ENTER -> INSIDE -> EXIT       │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────┴───────────────────────────────┐  │
│  │ 2. Behavioural Anomaly Detectors & False Alarm Filtering         │  │
│  │    • Dwell Loitering (>10s with low displacement)                │  │
│  │    • Suspicious Stationary Vehicles (>12s with zero speed)       │  │
│  │    • Forbidden Wrong-Direction Movement (e.g. SOUTH)             │  │
│  │    • Coordinated Group Movement (Spatial Clustering)             │  │
│  │    • Rapid Abnormal Velocity (>65 px/s)                          │  │
│  │    • Night Movement (Configured 20:00 - 06:00 window)            │  │
│  │    • Animal / Non-threat Class Filtering                         │  │
│  │    • Temporal Confirmation (Persistence >= 2-3 frames)           │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────┴───────────────────────────────┐  │
│  │ 3. Explainable Threat Risk Engine (0 - 100)                      │  │
│  │    • Restricted Zone Intrusion: +25                              │  │
│  │    • Night Movement: +15                                         │  │
│  │    • Forbidden Direction Breach: +15                             │  │
│  │    • Loitering: +10 • Stationary Vehicle: +15 • Group: +10       │  │
│  │    • Transparent Factor Rationale Breakdown                     │  │
│  │    • Risk Level: CRITICAL (81-100), HIGH (61-80), MEDIUM (31-60)│  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────┴───────────────────────────────┐  │
│  │ 4. Event Bus, Deduplication & Real-Time Broadcast                │  │
│  │    • Cooldown & Debounce Manager (Timeline updates vs spam)      │  │
│  │    • SQLite / PostgreSQL Database Persistence (`security_events`) │  │
│  │    • High-frequency WebSocket Push (`/ws/security-events`)       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬──────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        IBVAP React Frontend                            │
│  • Visual Zone Drawing Canvas (Click-to-draw normalized polygon)       │
│  • Tactical Live Video Overlay with Tinted Perimeter Polygons          │
│  • SOC Incident Log & Multi-Criteria Risk Filter Matrix                │
│  • Incident Details Modal with Explainable Factors & Timeline          │
│  • Operator Action Buttons (Acknowledge, Dismiss False Alarm, Resolve) │
│  • Human Verification Disclaimer Notice                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Virtual Fence & Restricted Zone Management

- **Supported Zone Types:**
  - `RESTRICTED`: High-criticality zero-line border wire or sterile zone.
  - `HIGH_SECURITY`: Sensitive critical infrastructure perimeter.
  - `BUFFER`: Observation and staging perimeter.
  - `MONITORING`: General situational awareness sector.
  - `CUSTOM`: User-defined operational zone.
- **Normalized Coordinates ($[0.0, 1.0]$):**
  Polygons are resolution-independent. They scale seamlessly across video viewport resizing, 1080p, 4K, or mobile screens.
- **Ground-Plane Intersection:**
  Evaluates the target object's **bottom-center point** ($x_{\text{center}}, y_{\text{bottom}}$), ensuring true boundary crossing is detected where the subject touches the ground rather than floating upper body bboxes.

---

## 2. Multi-Condition Behavioural Anomaly Detectors

1. **Zone Intrusion (`ZONE_INTRUSION`):**
   Triggered on state transition from `OUTSIDE` to `INSIDE` after temporal confirmation ($\ge 2$ frames).
2. **Loitering Detection (`LOITERING`):**
   Triggered when a person remains inside a zone exceeding configurable dwell time (default: 10s) with low net displacement.
3. **Suspicious Stationary Vehicle (`STATIONARY_VEHICLE`):**
   Triggered when a vehicle remains stationary ($\le 4\text{ px/s}$) inside a zone for $>12\text{s}$.
4. **Wrong-Direction Movement (`WRONG_DIRECTION`):**
   Compares object trajectory direction against zone rule (e.g. `SOUTH` towards domestic territory).
5. **Group Movement (`GROUP_MOVEMENT`):**
   Detects spatial clustering of 2 or more correlated human tracks moving in proximity.
6. **Night Movement (`NIGHT_MOVEMENT`):**
   Applies enhanced risk scoring when activity occurs during configured night hours ($20:00 - 06:00$).
7. **Animal / Non-Threat Filter:**
   Automatically filters out animals if the zone's monitored classes list does not include `animal`.

---

## 3. Explainable 0–100 Threat Risk Scoring Engine

Every confirmed security incident receives a mathematical, explainable threat score from $0$ to $100$:

$$\text{Risk Score} = \min\left(100, \sum \text{Active Threat Factor Weights} + \text{Penalties}\right)$$

### Default Factor Weights:
| Factor | Weight | Condition |
|---|---|---|
| `RESTRICTED_ZONE_INTRUSION` | $+25$ | Target enters Restricted Zone |
| `HIGH_SECURITY_BREACH` | $+35$ | Target enters High Security Zone |
| `NIGHT_MOVEMENT` | $+15$ | Activity during night hours |
| `FORBIDDEN_DIRECTION` | $+15$ | Movement matches forbidden breach vector |
| `LOITERING_BEHAVIOUR` | $+10$ | Dwell limit exceeded |
| `STATIONARY_VEHICLE` | $+15$ | Vehicle stopped $>12\text{s}$ in perimeter |
| `GROUP_MOVEMENT` | $+10$ | Multi-person coordinated transit |
| `RAPID_MOVEMENT` | $+10$ | Sudden abnormal velocity ($>65\text{ px/s}$) |
| `LOW_DETECTION_CONFIDENCE` | $-10$ | AI detection confidence $<0.50$ |

### Risk Level Classifications:
- **`CRITICAL` ($81 - 100$):** Immediate high-priority tactical breach.
- **`HIGH` ($61 - 80$):** Confirmed perimeter anomaly.
- **`MEDIUM` ($31 - 60$):** Buffer or low-light movement.
- **`LOW` ($0 - 30$):** Informational or exit transition.

### Operational Transparency:
The UI always displays the complete list of applied factor weights and the mandatory disclaimer:
> *"Operational Disclaimer: AI-generated threat assessment is advisory. Human operator verification is mandatory prior to physical interdiction."*

---

## 4. API Endpoints Reference

### Security Zones (`/api/v1/zones`):
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/zones/` | List security zones with optional camera filtering |
| `POST` | `/api/v1/zones/` | Create a new virtual perimeter zone with normalized vertices |
| `GET` | `/api/v1/zones/{zone_id}` | Get single zone configuration |
| `PUT` | `/api/v1/zones/{zone_id}` | Update zone name, type, polygon, monitored classes, or direction rule |
| `DELETE` | `/api/v1/zones/{zone_id}` | Delete a virtual security zone |

### Security Events & Threat Feed (`/api/v1/events`):
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/events/` | Query events with filters (`camera_id`, `risk_level`, `event_type`, `status`, pagination) |
| `GET` | `/api/v1/events/summary` | Get active risk level counts (Critical, High, Medium, Low) and recent events |
| `GET` | `/api/v1/events/{event_id}` | Get single incident detail with full chronological timeline and risk factors |
| `PUT` | `/api/v1/events/{event_id}/status` | Update incident status (`ACKNOWLEDGED`, `DISMISSED`, `RESOLVED`) |

### Threat Risk Configuration (`/api/v1/risk-config`):
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/risk-config/` | View system risk weights, night hours, and loitering thresholds |
| `PUT` | `/api/v1/risk-config/` | Update risk factor weights, behavioural parameters, and night hours |

### WebSocket Endpoint:
- **`WS /api/v1/ws/security-events`**:
  High-frequency WebSocket broadcasting real-time incident generation and status updates directly to dashboard operations.

---

## 5. Verification & Testing

### Automated Backend Tests:
```bash
python -m pytest backend/tests
```
*Executes 32 unit and integration tests covering spatial ray-casting, zone crossing, loitering, stationary vehicle, wrong direction, group movement, explainable risk calculation, event deduplication, and all REST/WebSocket endpoints.*

### Frontend Production Build:
```bash
cd frontend
npm run build
```
*Builds production bundle (`dist/`) with zero TypeScript/Vite errors.*
