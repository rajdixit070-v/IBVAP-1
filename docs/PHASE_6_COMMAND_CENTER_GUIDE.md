# IBVAP Phase 6: Command Center, Incident Management, Real-Time Alerting & Response Workflow

## Overview & Operational Philosophy

**Phase 6 of IBVAP** transforms real-time AI computer vision detections into an auditable, human-in-the-loop operational response workflow for authorized security command personnel.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI Security Event Ingestion                     │
│               (Intrusion / Loitering / ANPR / Face / Edge)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          ALERT ENGINE LAYER                            │
│  ├── Track-Based Alert Deduplication (Zero Spam)                       │
│  ├── Server-Driven SLA Escalation Deadlines                            │
│  ├── In-App Notification Drawer & Audio/Visual Beacon                  │
│  └── Operator Acknowledgement                                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     INCIDENT MANAGEMENT LIFECYCLE                      │
│  ├── Controlled State Machine Transitions:                             │
│  │   NEW ──> ACKNOWLEDGED ──> ASSIGNED ──> IN_PROGRESS ──> RESOLVED   │
│  │    │                                                      │         │
│  │    └─────────────> FALSE ALARM / ESCALATED <──────────────┘         │
│  │                                                           │         │
│  │                                                           ▼         │
│  │                                                        CLOSED       │
│  ├── Chronological Timeline & Audit Logging (`SecurityAuditLog`)       │
│  ├── Evidence Registry with SHA-256 Checksum Verification              │
│  └── False Alarm Feedback Classification (Model Evaluation)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   TACTICAL COMMAND CENTER EXPERIENCE                   │
│  ├── Live Primary Surveillance Feed with Track Focus                   │
│  ├── Real-Time Alert & Incident Triage Panels                          │
│  ├── Situational Awareness Geospatial Map (BOPs & Cameras)             │
│  └── Operational Metrics Dashboard (MTTA, MTTR, False Alarm %)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Real-Time Alert Engine & Deduplication

- **Alert Deduplication:**
  Continuing tracks inside restricted zones (e.g. Track #142 moving along the perimeter fence for 2 minutes) update the existing active `Alert` record's `risk_score` and `updated_at` timestamp rather than generating dozens of spam notifications.
- **Server-Driven SLA Escalation Timers:**
  - `CRITICAL` Alerts: $+120\text{s}$ acknowledgement window.
  - `HIGH` Alerts: $+300\text{s}$ acknowledgement window.
  - `MEDIUM` Alerts: $+600\text{s}$ acknowledgement window.
  If an operator does not acknowledge within the deadline, `alert_engine.audit_sla_escalations()` marks the alert `ESCALATED`.

---

## 2. Controlled Incident Lifecycle State Machine

Incidents adhere strictly to predefined state transitions:

| From State | Allowed Target States |
|---|---|
| `NEW` | `ACKNOWLEDGED`, `ASSIGNED`, `IN_PROGRESS`, `ESCALATED`, `FALSE_ALARM` |
| `ACKNOWLEDGED` | `ASSIGNED`, `IN_PROGRESS`, `ESCALATED`, `FALSE_ALARM` |
| `ASSIGNED` | `IN_PROGRESS`, `ESCALATED`, `FALSE_ALARM` |
| `IN_PROGRESS` | `ESCALATED`, `RESOLVED`, `FALSE_ALARM` |
| `ESCALATED` | `IN_PROGRESS`, `RESOLVED`, `FALSE_ALARM` |
| `RESOLVED` | `CLOSED`, `IN_PROGRESS` |
| `CLOSED` | Terminal state |
| `FALSE_ALARM` | Terminal state |

Attempts to bypass states (e.g. `NEW` directly to `CLOSED`) are rejected with `HTTP 400`.

---

## 3. Evidence Management & SHA-256 Integrity Verification

- For every tactical snapshot, license plate crop, facial recognition crop, or video snippet, a cryptographic SHA-256 hash is computed and stored.
- Any access or viewing of evidence is audited in `SecurityAuditLog` (`EVIDENCE_VIEWED`).

---

## 4. Operational Response Analytics

The platform computes real operational response metrics:
- **MTTA (Mean Time to Acknowledge):** Average seconds between alert generation and operator acknowledgement.
- **MTTR (Mean Time to Resolve):** Average seconds between incident creation and resolution.
- **False Alarm Rate (%):** Percentage of total incidents classified as false alarms, categorized by cause (animal, weather, shadow, maintenance, artifact).

---

## 5. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/alerts/` | List alerts with status and priority filters |
| `GET` | `/api/v1/alerts/summary` | Summary counts of active alerts |
| `POST` | `/api/v1/alerts/{id}/acknowledge` | Operator acknowledgement |
| `POST` | `/api/v1/alerts/{id}/escalate` | Manual operator escalation |
| `GET` | `/api/v1/incidents/` | Paginated search and filtered incident listing |
| `POST` | `/api/v1/incidents/` | Create a new managed incident |
| `GET` | `/api/v1/incidents/{id}` | Get full incident dossier with timeline |
| `POST` | `/api/v1/incidents/{id}/assign` | Assign incident to operator/team |
| `POST` | `/api/v1/incidents/{id}/escalate` | Escalate incident |
| `POST` | `/api/v1/incidents/{id}/resolve` | Resolve incident with notes |
| `POST` | `/api/v1/incidents/{id}/close` | Close incident |
| `POST` | `/api/v1/incidents/{id}/false-alarm` | Classify as false alarm with category |
| `GET` | `/api/v1/incidents/analytics/summary` | Operational metrics (MTTA, MTTR, False Alarm %) |
| `GET` | `/api/v1/evidence/{id}` | Get evidence record and integrity checksum |
| `GET` | `/api/v1/notifications/` | List user notifications |
| `PUT` | `/api/v1/notifications/{id}/read` | Mark single notification as read |
| `PUT` | `/api/v1/notifications/read-all` | Mark all notifications as read |

---

## 6. Test Suite Results

- **Backend Automated Tests:** 57 passed across all 6 phases.
- **Frontend Production Build:** Built in 2.12s with 0 errors.
