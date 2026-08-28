# IBVAP Phase 8: Advanced Behaviour Intelligence & Explainable Threat/Risk Assessment

## Overview
Phase 8 transforms IBVAP from simple point-rule alert triggers into an intelligent multi-signal behavioural analytics system with transparent explainable risk scoring, kinetic feature extraction, statistical activity baselines, mitigating counter-signals, and graceful temporal risk decay.

---

## 1. Core Architectural Pipeline

```
                ┌───────────────────────────────────────────┐
                │ Camera Frame Ingestion & AI Detections    │
                └─────────────────────┬─────────────────────┘
                                      │
                                      ▼
                ┌───────────────────────────────────────────┐
                │ Multi-Frame Tracking & Kinematic Features │
                │ (Speed, Dwell, Stop-Go, Direction Change) │
                └─────────────────────┬─────────────────────┘
                                      │
                                      ▼
                ┌───────────────────────────────────────────┐
                │      Statistical Activity Baseline        │
                │     (Hourly Normal Density Baseline)      │
                └─────────────────────┬─────────────────────┘
                                      │
                                      ▼
                ┌───────────────────────────────────────────┐
                │      Multi-Signal Threat Correlator       │
                │  - Probing / Repeated Approach            │
                │  - Fence-Edge Movement                    │
                │  - Route Anomalies (Phase 7)              │
                │  - Restricted Night Hours (22:00–05:00)   │
                │  - Watchlist Intelligence (Phase 4)       │
                └─────────────────────┬─────────────────────┘
                                      │
                                      ▼
                ┌───────────────────────────────────────────┐
                │   Explainable Threat & Risk Assessment    │
                │  + Positive Contributing Factors (+25)    │
                │  - Mitigating Counter-Signals (-15)       │
                │  = Net Score & Graceful Temporal Decay    │
                └─────────────────────┬─────────────────────┘
                                      │
                                      ▼
                ┌───────────────────────────────────────────┐
                │       Alert & Incident Pipeline           │
                │  - "Why This Alert?" Explainable UI       │
                │  - Operator Feedback & Audit Logging      │
                └───────────────────────────────────────────┘
```

---

## 2. Explainable Threat & Risk Scoring

### Positive Contributing Factors:
- **Restricted Zone Breach / Intrusion**: `+30 to +40 PTS`
- **Perimeter Proximity**: `+15 PTS`
- **Repeated Approach / Probing**: `+25 PTS`
- **Fence-Edge Movement**: `+20 PTS`
- **Route Anomaly**: `+20 PTS`
- **Rapid Direction Changes**: `+15 PTS`
- **Stop-and-Go Patterns**: `+15 PTS`
- **Sudden Speed Change / Running**: `+18 PTS`
- **Activity Density Anomaly**: `+18 PTS`
- **Vehicle Dwell Anomaly**: `+20 PTS`
- **After-Hours / Night Activity**: `+15 PTS`
- **Security Watchlist Match**: `+30 PTS`

### Mitigating Counter-Signals:
- **Authorized Personnel / Patrol Match**: `-30 PTS`
- **Absence of Zone Breach (Safe Distance)**: `-10 PTS`
- **Normal Daylight Operating Hours**: `-5 PTS`

### Temporal Risk Decay:
As time elapses without new anomalies, active threat level decays gracefully over 10 minutes:
$$\text{Decayed Score} = \text{Peak Score} \times \max\left(0.35, 1.0 - \frac{t_{\text{elapsed}}}{600}\right)$$

---

## 3. Objective & Non-Judgmental Language Policy
The platform avoids unsupported labels (e.g. "terrorist", "criminal", "infiltrator") and uses evidence-based classifications:
- `POTENTIAL_PERIMETER_PROBING_PATTERN`
- `FENCE_EDGE_MOVEMENT`
- `SUDDEN_SPEED_CHANGE`
- `VEHICLE_DWELL_ANOMALY`
- `ACTIVITY_DENSITY_ANOMALY`
- `BEHAVIOUR_ANOMALY`

---

## 4. REST API Endpoints

- `GET /api/v1/behaviour/events`: Search and list behaviour events with server-side pagination and filters.
- `GET /api/v1/behaviour/events/{event_id}`: Full detail with factor and counter-factor breakdown.
- `GET /api/v1/behaviour/assessments/{track_id}`: Real-time explainable risk assessment for any track.
- `GET /api/v1/behaviour/rules` & `PUT /api/v1/behaviour/rules/{rule_id}`: Rule management with automatic versioning and audit trails.
- `GET /api/v1/behaviour/baselines`: Hourly activity baselines.
- `POST /api/v1/behaviour/feedback`: Operator feedback (`CORRECT_DETECTION`, `FALSE_POSITIVE`, `NEEDS_REVIEW`).
- `GET /api/v1/behaviour/analytics/summary`: Metrics summary (total events, elevated risk count, false positive rate %).
