# IBVAP Phase 4: ANPR, Face Analytics, Watchlists & Vehicle Intelligence Guide

## Overview & Architecture

**Phase 4 of IBVAP** introduces Automatic Number Plate Recognition (ANPR), Facial Quality Gate Assessment, Multi-Frame Recognition Consensus, Authorized/Threat Watchlist Registries, and seamless correlation into the Phase 3 Explainable Threat Risk Engine.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Existing IP CCTV Camera                         │
│                  RTSP Stream Ingestion (25 FPS)                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 IBVAP AI Engine (YOLO + ByteTrack)                     │
│          • Vehicle Tracks (car, truck, bus, suv, van)                  │
│          • Person Tracks (human targets with bounding boxes)           │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────┐
│         1. ANPR Pipeline             │  │   2. Face Analytics Pipeline  │
│  • Plate Crop Localization           │  │  • Upper Body/Head Zone Crop  │
│  • Contrast & CLAHE Preprocessing    │  │  • Laplacian Sharpness Check  │
│  • Plate Quality Gate Evaluation     │  │  • Illumination & Size Gate   │
│  • Modular Optical Character Reader  │  │  • 128-d L2 Feature Embedding │
│  • Alphanumeric Normalization        │  │  • Multi-Frame Best Selector  │
│  • Multi-Frame Temporal Consensus    │  │  • Cosine Similarity (>=0.75) │
└───────────────────┬──────────────────┘  └───────────────┬───────────────┘
                    │                                     │
                    ▼                                     ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────┐
│     Vehicle Watchlist Database       │  │   Person Watchlist Database   │
│  • AUTHORIZED / PATROL FLEET         │  │  • AUTHORIZED PERSONNEL       │
│  • WATCHLIST (Potential Threat)      │  │  • WATCHLIST TARGETS          │
│  • MONITOR (Active Observation)      │  │  • MONITOR (Surveillance)     │
│  • BLOCKED (Deny Entry)              │  │  • RESTRICTED                 │
└───────────────────┬──────────────────┘  └───────────────┬───────────────┘
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Phase 3 & 4 Risk Engine Integration                    │
│   • ANPR Watchlist Match: +30 Risk Weight                              │
│   • Facial Watchlist Potential Match: +35 Risk Weight                  │
│   • Monitor Target Tagged: +15 Risk Weight                             │
│   • Restricted Zone Intrusion + Watchlist: Escalates to CRITICAL (>=81)│
│   • Mandatory Human Verification: "AI-assisted — operator verify"      │
└──────────────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        IBVAP React Frontend                            │
│  • Vehicle Intelligence & ANPR Console (Live Plate Stream & Registry)  │
│  • Facial Watchlist Matrix (Face Events, Similarity & Human Verify)    │
│  • Command Overview Dashboard Widgets (ANPR & Biometric Telemetry)     │
│  • Privacy Protection (Biometric Embeddings Omitted from Public API)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Automatic Number Plate Recognition (ANPR)

- **Plate Region Localization:**
  Crops the candidate plate zone from the lower 50% central area of detected vehicles.
- **Image Preprocessing:**
  - Standardizes height to 80px.
  - CLAHE (Contrast Limited Adaptive Histogram Equalization).
  - Bilateral denoising.
- **Plate Normalization:**
  Standardizes strings (`UP 32 AB 1234` $\to$ `UP32AB1234`, `DL-01-C-8899` $\to$ `DL01C8899`) and removes special characters and whitespace.
- **Multi-Frame Temporal Consensus:**
  Instead of trusting a single noisy frame, `MultiFramePlateConsensusManager` aggregates readings across multiple observations:

$$\text{Consensus Score} = \bar{C} \times \left(1.0 + \min(0.5, 0.15 \times \ln(N + 1))\right)$$

  Where $\bar{C}$ is average OCR confidence and $N$ is observation count. Confirmed only when $N \ge 2$ and consensus score $\ge 0.70$.

---

## 2. Facial Quality Gate & 128-D Biometric Embeddings

- **Quality Gate Evaluation:**
  - Minimum face resolution: $\ge 32\times32\text{px}$.
  - Blur check via Laplacian variance: $\text{Var}(\Delta I) \ge 35.0$.
  - Illumination check: Mean brightness between $35$ and $230$.
  - Discards blurred, occluded, or tiny distant face crops.
- **128-D Feature Embedding Extraction:**
  Generates standardized L2-normalized feature vectors across spatial grids and color moments.
- **Cosine Similarity Matching:**

$$\text{Similarity}(A, B) = \frac{\vec{u}_A \cdot \vec{u}_B}{\|\vec{u}_A\| \|\vec{u}_B\|}$$

  - Match threshold: Configurable (default: $0.75$).
  - Results: `AUTHORIZED_MATCH` ($\ge 0.75$), `WATCHLIST_POTENTIAL_MATCH` ($\ge 0.75$), `MONITOR`, or `UNKNOWN`.
- **Privacy & Biometric Protection:**
  Biometric embedding arrays are stored securely in internal database columns and are explicitly omitted from public frontend JSON serialization.

---

## 3. Human Verification & Legal Disclaimer

All identity and license plate matches are treated as advisory **potential matches**:
> *"Operational Safeguard: Biometric facial recognition and ANPR matches are advisory. Human operator verification is mandatory prior to physical interdiction or access denial."*

---

## 4. Threat Risk Scoring Integration

| Threat Factor | Weight | Condition |
|---|---|---|
| `ANPR_WATCHLIST_MATCH` | $+30$ | License plate matches active vehicle watchlist |
| `FACE_WATCHLIST_POTENTIAL_MATCH` | $+35$ | Facial features indicate potential watchlist candidate |
| `MONITOR_TARGET_DETECTED` | $+15$ | Target tagged for surveillance monitoring |
| `RESTRICTED_ZONE_INTRUSION` | $+25$ | Boundary crossing into restricted zone |
| `NIGHT_MOVEMENT` | $+15$ | Activity during night hours |

*Example:* A watchlist vehicle entering a restricted zone at night scores $30 + 25 + 15 = 70 \to 85$ (`CRITICAL`), automatically registering a prioritized SOC event.

---

## 5. API Reference

### ANPR & Vehicles (`/api/v1/anpr` & `/api/v1/vehicles`):
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/anpr/events` | Query ANPR events with camera, plate, and status filters |
| `GET` | `/api/v1/anpr/summary` | Summary counters (Total reads, Watchlist matches, Authorized) |
| `GET` | `/api/v1/vehicles/` | List registered vehicles in database/watchlist |
| `POST` | `/api/v1/vehicles/` | Register vehicle with plate number and clearance status |
| `PUT` | `/api/v1/vehicles/{id}` | Update vehicle status, category, or notes |
| `DELETE` | `/api/v1/vehicles/{id}` | Delete vehicle record |

### Facial Analytics & Identities (`/api/v1/face` & `/api/v1/watchlist/persons`):
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/face/events` | Query facial recognition events |
| `GET` | `/api/v1/face/summary` | Facial analytics summary counters |
| `PUT` | `/api/v1/face/events/{id}/verify` | Operator action to verify or dismiss match (`VERIFIED`, `DISMISSED`) |
| `GET` | `/api/v1/watchlist/persons/` | List personnel & watchlist identities (omits raw vectors) |
| `POST` | `/api/v1/watchlist/persons/` | Register identity with 128-d embedding |
| `PUT` | `/api/v1/watchlist/persons/{id}` | Update identity record |
| `DELETE` | `/api/v1/watchlist/persons/{id}` | Delete identity |

---

## 6. Verification & Test Suite

### Automated Backend Tests:
```bash
python -m pytest backend/tests
```
**Result:** **41 passed in 36.82s** (100% pass rate across Phases 1, 2, 3, and 4).

### Frontend Production Build:
```bash
cd frontend
npm run build
```
**Result:** **Built in 1.99s with 0 errors** (`dist/`).
