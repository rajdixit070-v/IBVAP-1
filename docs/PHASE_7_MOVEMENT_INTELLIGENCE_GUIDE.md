# IBVAP Phase 7: Multi-Camera Intelligence, Cross-Camera Correlation & Movement Reconstruction

## Overview
Phase 7 enables IBVAP to correlate observations across multiple border CCTV cameras, reconstruct continuous object journeys, maintain multi-camera network topology, detect impossible travel / route deviations, and empower operators with human-in-the-loop association reviews.

---

## 1. Core Architectural Pipeline

```
                ┌───────────────────────────────────────────┐
                │ Camera 1 / 2 / 3 Local AI Detections &    │
                │ Local Tracks (CAM-001, CAM-002, CAM-003)  │
                └─────────────────────┬─────────────────────┘
                                      │
                                      ▼
                ┌───────────────────────────────────────────┐
                │      Camera Network Topology Graph        │
                │     (Valid Edges & Travel Windows)        │
                └─────────────────────┬─────────────────────┘
                                      │
                                      ▼
                ┌───────────────────────────────────────────┐
                │   Multi-Signal Probabilistic Matcher      │
                │  - Topology Validity & Edge Confidence    │
                │  - Travel Time Decay Window               │
                │  - Direction Consistency Vector           │
                │  - ANPR License Plate Consensus (Vehicle) │
                │  - Visual Re-ID Appearance (Person)       │
                └─────────────────────┬─────────────────────┘
                                      │
                                      ▼
                ┌───────────────────────────────────────────┐
                │    Global Track & Movement Dossier        │
                │  - Multi-Stop Chronological Timeline      │
                │  - Anomaly Flagging (Impossible Travel)   │
                │  - Human-in-the-Loop Operator Review      │
                └───────────────────────────────────────────┘
```

---

## 2. Multi-Signal Probabilistic Scoring Formulation

$$\text{Score} = w_{\text{topo}} \cdot S_{\text{topo}} + w_{\text{time}} \cdot S_{\text{time}} + w_{\text{dir}} \cdot S_{\text{dir}} + w_{\text{plate}} \cdot S_{\text{plate}} + w_{\text{app}} \cdot S_{\text{app}}$$

- **Vehicle Scoring**: ANPR Plate Consensus anchors match confidence with $50\%$ weight. If plates conflict, score is suppressed to $0.10$ ($\text{NO\_MATCH}$).
- **Person Scoring**: Topology ($30\%$), Temporal proximity ($30\%$), Clothing/Appearance ($25\%$), and Direction ($15\%$).

### Match Categories:
- **`HIGH_CONFIDENCE_MATCH` ($\ge 80\%$)**: Automatically confirmed association.
- **`MEDIUM_CONFIDENCE_MATCH` ($50\% - 79\%$)**: Flagged for operator review (`PENDING_REVIEW`).
- **`LOW_CONFIDENCE_MATCH` ($30\% - 49\%$)**: Low confidence link, flagged for review.
- **`NO_MATCH` ($< 30\%$)**: Generates a new distinct `GlobalTrack`.

---

## 3. Movement Anomaly Engine
- **`IMPOSSIBLE_TRANSITION`**: Triggered when $t_{\text{delta}} < \text{transition.min\_travel\_time\_sec}$ (Severity: `CRITICAL`).
- **`ROUTE_DEVIATION`**: Triggered when an object moves between non-connected camera nodes.
- **`PLATE_CONFLICT`**: Retains both camera readings without destroying evidence.

---

## 4. API Endpoints

- `GET /api/v1/cross-camera/graph`: Returns active camera network topology transitions.
- `POST /api/v1/cross-camera/graph/transitions`: Adds a directed edge between two cameras.
- `GET /api/v1/cross-camera/tracks`: Returns paginated global continuous tracks.
- `GET /api/v1/cross-camera/tracks/{global_track_id}`: Reconstructs full journey dossier with stops, associations, and anomalies.
- `POST /api/v1/cross-camera/associations/{id}/review`: Operator audit review (`CONFIRM` / `REJECT`).
- `GET /api/v1/cross-camera/anomalies`: Lists detected movement anomalies.
- `GET /api/v1/cross-camera/analytics/summary`: Metrics summary.
