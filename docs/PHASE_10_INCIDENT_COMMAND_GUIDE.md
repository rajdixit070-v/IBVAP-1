# IBVAP Phase 10: Intelligent Incident Command, Response Orchestration & Situational Awareness

## 1. Overview & Architecture

Phase 10 elevates IBVAP from reactive alert ingestion into a proactive **Incident Command & Response Orchestration System**. It coordinates multi-camera streams, SLA escalations, standard operating procedure (SOP) playbooks, cryptographic evidence verification, and post-incident learning.

```
AI Detection
    ↓
Behaviour / Risk Engine (Phase 8)
    ↓
Forecasting / Prediction (Phase 9)
    ↓
Alert Generation (Phase 6)
    ↓
Multi-Camera Correlation & Deduplication
    ↓
Incident Creation & Prioritization (CRITICAL / HIGH / MEDIUM / LOW)
    ↓
Operator Verification & Triage
    ↓
Standard Operating Playbook & Interactive Checklists
    ↓
Live 4-Quadrant Mission Control Workspace
    ↓
Resolution & Post-Incident Learning Review
    ↓
Cryptographically Sealed Incident Dossier Export (SHA-256)
```

---

## 2. Key Capabilities Implemented

### 2.1 Multi-Camera Incident Correlation & Deduplication
- Alerts originating from the same entity (`global_track_id`) or adjacent cameras in the same active 10-minute operational window attach to an existing master incident rather than creating duplicate notifications.
- Dynamically updates `related_cameras_json` and elevates priority when concurrent signals or route violations escalate risk.

### 2.2 Controlled 8-State Incident State Machine
- **States**: `NEW` $\to$ `TRIAGED` $\to$ `ASSIGNED` $\to$ `INVESTIGATING` $\to$ `RESPONDING` $\to$ `CONTAINED` $\to$ `RESOLVED` $\to$ `CLOSED`, with terminal states `FALSE_ALARM` and `DISMISSED`.
- **Optimistic Concurrency Control**: Every change increments `version`. Conflicting concurrent submissions trigger HTTP 400 rejection to ensure operator audit trails remain immutable.

### 2.3 SLA Monitoring & Multi-Tier Escalation Engine
- Configurable response SLAs per priority:
  - `CRITICAL`: 2-minute acknowledgment deadline.
  - `HIGH`: 5-minute acknowledgment deadline.
  - `MEDIUM`: 15-minute acknowledgment deadline.
- Unacknowledged incidents automatically advance escalation levels ($1 \to 2 \to 3$), dispatching high-priority supervisory notifications.

### 2.4 Standard Operating Playbooks & Checklists
- Pre-seeded border security playbooks:
  1. `PB-VIRTUAL-FENCE`: Virtual fence and boundary breach protocol.
  2. `PB-SUSPICIOUS-BEHAVIOUR`: Perimeter probing, loitering, and crawling response.
  3. `PB-VEHICLE-ANOMALY`: Watchlist vehicle interception and gate containment.
  4. `PB-INFRASTRUCTURE-OUTAGE`: Stream failure, edge node offline, and failover isolation.
- Interactive step-by-step checklist tracking with actor attribution and completion timestamps.

### 2.5 4-Quadrant Live Mission Control Workspace
- **Top Bar**: Incident meta, severity badge, escalation level, SLA timer, and status toolbar (`TRIAGE`, `ASSIGN`, `RESPOND`, `CONTAIN`, `RESOLVE`, `CLOSE`).
- **Quadrant 1 (Left)**: Incident telemetry, affected zones, global tracks, risk gauge, assigned unit.
- **Quadrant 2 (Center)**: Primary live camera preview + interactive linked camera wall ribbon.
- **Quadrant 3 (Right)**: Chronological event sequence and audit trail.
- **Quadrant 4 (Bottom)**: Active playbook checklist execution and SHA-256 verified evidence chain.

### 2.6 Cryptographic Dossier Export & Post-Incident Learning
- **Sealed Export**: Generates printable incident dossiers featuring SHA-256 hashes of all snapshots and the overall dossier.
- **Post-Incident Review**: Categorizes outcomes (`TRUE_EVENT`, `FALSE_ALARM`, `ENVIRONMENTAL`, `INFRASTRUCTURE`, `AUTHORIZED_ACTIVITY`) and enables camera calibration feedback flags without silent parameter modification.

---

## 3. Verification & Test Summary

- **Phase 10 Automated Pytest Suite**: 10/10 tests passed (`backend/tests/test_phase10_incident_command.py`).
- **Full Platform Regression Suite**: 95/95 tests passed across Phases 1–10.
- **Frontend Production Build**: Clean Vite/TypeScript build with zero errors.
