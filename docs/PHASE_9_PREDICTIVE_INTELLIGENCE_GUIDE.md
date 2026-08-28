# IBVAP Phase 9: Predictive Security Intelligence, Anomaly Forecasting & Early Warning

## Overview
Phase 9 extends the **IBVAP (Intelligent Border Video Analytics Platform)** from reactive alert triggering into a **predictive decision-support system**. The engine correlates historical data, statistical time-of-day baselines, cross-camera journeys (Phase 7), multi-signal behaviour indicators (Phase 8), and edge infrastructure telemetry (Phase 5) to generate short-term activity anomaly forecasts, early warnings, and smart monitoring recommendations.

---

## 1. Core Architectural Flow

```
   ┌──────────────────────────────────────────────────────────┐
   │ Historical Data + Time-Series Activity Aggregation       │
   │ (5m, 15m, 30m, 1h, 6h, 24h Aggregation Windows)          │
   └────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
   ┌──────────────────────────────────────────────────────────┐
   │         Statistical Baseline & Trend Analyzer            │
   │  - Expected hourly normal profiles                       │
   │  - Linear regression slope & variance estimation         │
   │  - Trends: INCREASING, STABLE, DECREASING, VOLATILE      │
   └────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
   ┌──────────────────────────────────────────────────────────┐
   │      Data Quality & Infrastructure Telemetry Engine      │
   │  - Edge node latency, stream FPS, sync status            │
   │  - Distinguishes CAMERA_OFFLINE vs true activity drop    │
   │  - Data Quality Score (0.0 to 1.0)                       │
   └────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
   ┌──────────────────────────────────────────────────────────┐
   │        Short-Term Anomaly Forecasting Engine             │
   │  - Exponential smoothing + uncertainty intervals [min,max│
   │  - Minimum sample threshold enforcement (N >= 4)         │
   │  - Output: LOW, NORMAL, ELEVATED, HIGH Forecast Levels   │
   └────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
   ┌──────────────────────────────────────────────────────────┐
   │           Early Warning & Governance Layer               │
   │  - Lifecycle: NEW -> ACTIVE -> ACKNOWLEDGED / DISMISSED  │
   │  - Early warning deduplication on active sectors         │
   │  - Baseline Shift Detection & Administrative Review      │
   │  - Smart Camera Monitoring Prioritization                │
   └──────────────────────────────────────────────────────────┘
```

---

## 2. Strict Objective Language Policy

The platform strictly avoids deterministic claims and prejudicial language:
- ✅ *Predicted activity anomaly*
- ✅ *Elevated activity probability*
- ✅ *Unusual pattern forecast*
- ✅ *Early warning*
- ✅ *Risk trend*
- ✅ *Area activity forecast*
- ✅ *AI-assisted prediction*

The platform does **NOT** use:
- ❌ "Future attack"
- ❌ "Guaranteed intrusion"
- ❌ "Confirmed threat"
- ❌ "Predicted terrorist"
- ❌ "Predicted criminal"

---

## 3. REST API Endpoints

- `GET /api/v1/predictive/activity`: Time-series query with window aggregation and baseline comparison.
- `GET /api/v1/predictive/forecast`: Short-term horizon forecast with confidence, range, risk drivers, and counter-signals.
- `GET /api/v1/predictive/warnings`: Early warning list with level and lifecycle status filters.
- `POST /api/v1/predictive/warnings/{warning_id}/acknowledge`: Acknowledge early warning.
- `POST /api/v1/predictive/warnings/{warning_id}/dismiss`: Dismiss early warning with operator notes.
- `GET /api/v1/predictive/hotspots`: Spatial security activity hotspots with coordinates and density levels.
- `GET /api/v1/predictive/recommended-attention`: Prioritized camera recommendations for operator proactive focus.
- `GET /api/v1/predictive/baseline-shifts`: Pending baseline shifts requiring administrative review.
- `POST /api/v1/predictive/baseline-shifts/{shift_id}/approve`: Administrator approval/rejection of baseline shift.
- `GET /api/v1/predictive/model-health`: Predictive model health, telemetry, data quality, and error metrics (MAE/RMSE).
- `POST /api/v1/predictive/feedback`: Record operator feedback for continuous evaluation.
