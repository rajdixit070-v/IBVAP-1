# PHASE 13 — ADVANCED AI/ML + MULTIMODAL SECURITY INTELLIGENCE

## Overview

Phase 13 elevates the IBVAP platform from individual, isolated AI detections to **Context-Aware Multimodal Security Intelligence**. Rather than emitting disconnected alerts for every bounding box or OCR read, the platform correlates video detections, object tracking trajectories, optical license plate readings, facial recognition embeddings, zone boundaries, temporal dwell times, and environmental lighting into cohesive, explainable security events.

---

## 1. Unified AI Intelligence Architecture

```
VIDEO STREAM (RTSP)
       │
       ├── Object Detection (YOLOv8)
       ├── Object Tracking (ByteTrack)
       ├── Optical Character Recognition (CRNN ANPR)
       ├── Facial Analytics (MobileFaceNet)
       ├── Zone & Virtual Fence Topology
       └── Environmental Lighting & Image Quality
                │
                ▼
   MULTIMODAL AI INTELLIGENCE ENGINE
   ┌────────────────────────────────────────────────────────┐
   │ • Detection & Multi-Signal Fusion                     │
   │ • Temporal Trajectory Analytics (Duration, Dwell)      │
   │ • Multi-Frame OCR Voting & Plate Consensus             │
   │ • Privacy-Preserving Facial Verification               │
   │ • Deduplication & Anti-Jitter Cooldown                 │
   │ • Explainable Non-Linear Risk & Confidence Scoring     │
   │ • Causal AI Event Relationship Graph & 7-Stage Timeline│
   └────────────────────────────────────────────────────────┘
                │
                ▼
   EXPLAINABLE MULTIMODAL SECURITY EVENT
                │
                ├── Fused Threat Level & Breakdown
                ├── 7-Stage Chronological Timeline
                ├── Multimodal Signal Graph
                ├── Tamper-Evident Evidence Bundle
                └── Human-in-the-Loop Feedback Loop
```

---

## 2. Key Capabilities Delivered

### A. Atomic AI Signal Model (`ai_observations`)
Every raw sensory detection is recorded as a structured, attributable observation:
- `observation_id`, `camera_id`, `site_id`, `bop_id`, `zone_id`, `track_id`, `global_track_id`
- `observation_type`: `PERSON`, `VEHICLE`, `PLATE`, `FACE`, `BEHAVIOUR`, `AUDIO`, `ZONE_TRANSITION`, `SPEED`, `ROUTE`
- `confidence`: Calibrated score (0.00 to 1.00) with categorical level (`HIGH`, `MEDIUM`, `LOW`)
- `model_name` & `model_version`: Complete model lineage tracking
- `environmental_context`: Lighting condition (`DAY`, `NIGHT`, `LOW_LIGHT`) & image quality modulation

### B. Detection Fusion & Deduplication
- **Single Correlated Event**: Fuses person detection, continuous track, restricted zone breach, night-time lighting, and movement pattern into one event instead of duplicate alert storms.
- **Anti-Jitter Cooldown**: In-memory temporal cache suppresses duplicate alerts within 25–30 seconds for the same track/zone/camera.
- **Loitering & Prolonged Presence**: Detects when an entity remains inside a sensitive zone beyond the configured threshold (`PROLONGED_PRESENCE`).

### C. Multi-Frame ANPR Plate Voting & Consensus
- Combines sequential OCR readings over a temporal track window.
- Eliminates transitory OCR noise through character frequency voting without inventing unsupported characters.
- Computes composite confidence based on winning consensus and reading consistency.

### D. Privacy-Preserving Facial Analytics
- Categorizes face observations strictly into:
  - `FACE_MATCHED`: Verified watchlist match meeting the $\ge 0.85$ confidence threshold.
  - `FACE_DETECTED`: Facial bounding box located but below watchlist threshold.
  - `UNKNOWN_FACE`: No biometric match in database.
- **Privacy Redaction**: Operators and Analysts see masked identities (e.g. `REDACTED-JO***`) unless authorized with `SUPER_ADMIN` or `SITE_ADMIN` role.

### E. Explainable AI Event Relationship Graph & 7-Stage Timeline
Every multimodal event generates:
1. **7-Stage Timeline**:
   - `DETECTION` ➔ `TRACKING` ➔ `CONTEXT` ➔ `CORRELATION` ➔ `RISK` ➔ `ALERT` ➔ `INCIDENT`
2. **Signal Relationship Graph**:
   - Graph nodes representing Camera, Track, Zone, Environmental Context, Anomaly, and Threat Risk, connected by directed causal edges (`OBSERVED_ON`, `ENTERED`, `ENVIRONMENTAL_CONTEXT`, `TRIGGERS`, `ESCALATES_TO`).
3. **Structured "WHY WAS THIS FLAGGED?" Breakdown**:
   - Explicit list of contributing factors and non-linear fusion methodology.

### F. AI Model Registry, Versioning & Observability
- Centralized registry (`ai_model_registry`) tracking model types, versions, deployment profiles (`LOW`, `BALANCED`, `HIGH`), precision, recall, latency, and error rates.
- **Rollback Readiness**: Authorized administrators can toggle/rollback model versions instantly with security audit logging.

### G. Natural Language AI Assistant with Factual Citations
- Translates natural language queries (e.g., *"Show high-risk night events in BOP Alpha"*) into structured database filters.
- Returns citations referencing verified event IDs and primary camera IDs without hallucination.

### H. Camera AI Resource Profiles & Dependency Validation
- Camera-level compute profiles:
  - `LOW`: 5.0 FPS inference, basic tracking.
  - `BALANCED`: 10.0 FPS inference, ANPR, face analytics, behaviour.
  - `HIGH`: 20.0 FPS inference, deep multimodal correlation.
- **Dependency Validation**: Prevents invalid configurations (e.g., enabling ANPR without vehicle detection throws HTTP 400).

---

## 3. REST API Endpoints (`/api/v1/multimodal`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/multimodal/overview` | Executive multimodal KPIs, health score, and event distributions |
| `POST` | `/multimodal/observations` | Ingests atomic observation and triggers real-time fusion |
| `GET` | `/multimodal/observations` | Lists observations with camera/type filters |
| `GET` | `/multimodal/events` | Lists correlated multimodal events with scope RBAC |
| `GET` | `/multimodal/events/{id}` | Retrieves specific event details |
| `GET` | `/multimodal/events/{id}/timeline` | Retrieves 7-stage chronological timeline |
| `GET` | `/multimodal/events/{id}/graph` | Retrieves causal signal relationship graph |
| `POST` | `/multimodal/events/{id}/feedback` | Submits operator review (`VALID`, `FALSE_POSITIVE`, `UNCERTAIN`) |
| `GET` | `/multimodal/feedback/analytics` | Returns aggregated operator validation statistics |
| `POST` | `/multimodal/search` | Multi-faceted structured AI search |
| `POST` | `/multimodal/assistant/query` | Natural language query with factual citations |
| `GET` | `/multimodal/analytics/flows` | Vehicle flow rate, classifications, and unique person tracking |
| `GET` | `/multimodal/analytics/heatmaps` | Spatial & temporal activity and anomaly heatmaps |
| `GET` | `/multimodal/models` | Lists registered AI models and telemetry |
| `POST` | `/multimodal/models` | Registers new AI model or version (Admin) |
| `POST` | `/multimodal/models/{id}/rollback`| Switches active model version safely |
| `GET` | `/multimodal/profiles` | Lists camera compute profiles and toggles |
| `PUT` | `/multimodal/profiles/{cam_id}` | Updates camera profile with dependency validation |
| `GET` | `/multimodal/export` | Exports events to CSV/JSON with privacy redactions |

---

## 4. Frontend UI Components

Accessible via **Sidebar ➔ Multimodal AI Intelligence (PHASE 13)**:
- **Executive KPI Strip**: Real-time counter of Active Events, High/Critical Threats, Behavioral Anomalies, Unique Tracks, ANPR Reads, and Multimodal Health Score.
- **6 Operational Sub-Tabs**:
  1. `Live Multimodal Feed`: Grid of correlated security events with risk badges, explainable factor lists, and direct links to graph and feedback modals.
  2. `Temporal & Flow Analytics`: 24h person tracking estimates, entry/exit directional counts, vehicles/hr, and vehicle class distribution cards.
  3. `Activity & Anomaly Heatmaps`: Tactical perimeter grid with live density pulses and anomaly breach clusters.
  4. `AI Model Registry & Observability`: Active model table with precision/recall, latency, error rates, and rollback actions.
  5. `Human-in-the-Loop Feedback`: Real-time false positive suppression metrics and model validation ratios.
  6. `Camera AI Profiles & Toggles`: Per-camera compute allocation controls (LOW/BALANCED/HIGH) and feature toggles.
- **Interactive Modals**:
  - `EventGraphModal.tsx`: Visual graph view and 7-stage chronological timeline.
  - `AIAssistantModal.tsx`: Natural language query dialog with quick suggestions and factual citations.
  - `FeedbackModal.tsx`: Operator feedback submission dialog with reason logging.

---

## 5. Verification Results

| Suite / Test | Status | Notes |
|---|---|---|
| **Phase 13 Test Suite** (14 tests) | ✅ **14/14 PASSED** | Detection fusion, loitering, ANPR voting, face privacy, model registry, NL search, RBAC isolation |
| **Full Regression Suite** (Phases 1–13) | ✅ **132/132 PASSED** | All 13 phases verified with zero failures |
| **Frontend Production Build** | ✅ **1606 modules** | Built cleanly with Vite & TypeScript, zero TS errors |
