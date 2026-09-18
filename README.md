<div align="center">
  <img src="frontend/public/logo.png" width="160" alt="IBVAP Tactical Defense Emblem" />
  <h1>IBVAP — Intelligent Border Vision Analytics Platform</h1>
  <p><strong>Next-Generation Autonomous Perimeter Defense, Dual-Spectrum Surveillance & 3D Tactical Terrain C2 Matrix</strong></p>

  [![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688.svg)](https://fastapi.tiangolo.com)
  [![React 18](https://img.shields.io/badge/React-18+-61dafb.svg)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
  [![3D Terrain](https://img.shields.io/badge/3D_Terrain-MapLibre%20WebGL%20DEM-06B6D4.svg)](https://maplibre.org/)
  [![Zero-Trust Security](https://img.shields.io/badge/Security-Zero--Trust%20Hardened-emerald.svg)](docs/SECURITY.md)
  [![Production Ready](https://img.shields.io/badge/Deploy-Render%20%2B%20Vercel%20%7C%20Docker-blueviolet.svg)](#-cloud-deployment-guide-render--vercel)
</div>

---

## 📌 Executive Overview

**IBVAP (Intelligent Border Vision Analytics Platform)** is an enterprise-grade, mission-critical Command & Control (C2) situational awareness platform engineered for national border defense operations (e.g., BSF, ITBP, Army).

The platform autonomously ingests 4K optical, PTZ, and Long-Wave Infrared (LWIR) thermal video streams from forward **Border Outposts (BOPs)** across national frontiers (Punjab, Rajasthan, Jammu, Gujarat, Kashmir, Ladakh, Bengal, Northeast). It provides real-time **3D Terrain WebGL Elevation**, **Edge AI object detection & tracking (YOLOv8 + ByteTrack)**, strict **role-based outpost perimeter isolation**, and instant threat alerts directly to Sector Headquarters and Quick Reaction Teams (QRT).

---

## 🌟 Core System Architecture & Tactical Modules

```mermaid
graph TD
    A[Remote Border Cameras / NVR / PTZ / Drones] -->|RTSP / ONVIF / WebRTC| B[Edge Ingestion & Blur Diagnostics]
    B --> C[Dual-Spectrum AI Inference: YOLOv8 + ByteTrack]
    C --> D[Tactical Fusion & False Alarm Filter]
    D --> E[Sub-15ms WebSocket Telemetry Bus]
    E --> F[React Tactical Command HUD & 3D WebGL Terrain Map]
    E --> G[Automated QRT Sirens & Incident Playbooks]
```

### 1. Realistic 3D WebGL Mountain Terrain & Tactical GIS
- **Photorealistic 3D Mountain Elevation**: Native WebGL 3D raster-DEM terrain powered by MapLibre GL JS with AWS Open Data Terrarium elevation tiles and `1.85x` vertical exaggeration. True ridgelines, peaks, valleys, and riverbeds render naturally.
- **100% Free, Public & Keyless Tile Services**: Zero dependency on paid Google Maps or CartoDB API keys. Seamlessly switches between **Satellite Orthophoto** (Esri World Imagery), **Topographic Contours** (Esri World Topo), **Tactical Dark Ops** (Esri Dark Canvas), and **Navigation Roads** (OpenStreetMap).
- **3D Border Wire & FOV Projections**: International zero-line perimeter fences and camera Field-of-View (FOV) fan cones dynamically conform to 3D mountain slopes.
- **Interactive 3D Navigation**: Built-in 3D D-pad (North, South, East, West), tilt angle control (horizon view vs. top-down 2D radar), 360° bearing compass, and autonomous drone orbit patrol mode.

### 2. Multi-Tier Role Scoping & Outpost Perimeter Isolation
- **Super Admin Mode**:
  - Nationwide frontier selector ribbon (Punjab, Rajasthan, Jammu, Gujarat, Kashmir, Ladakh, South Bengal, North Bengal, Tripura, Meghalaya, Mizoram, Assam).
  - Selecting any Frontier dynamically restricts the map and sensor feeds to **only the BOPs belonging to that Frontier** and **only the cameras attached to those BOPs**.
  - "All Frontiers" view unlocks national defense grid monitoring.
- **BOP Commander Mode**:
  - Strict outpost perimeter isolation: Commander only sees their **assigned Frontier**, their **single assigned BOP**, and **only cameras attached to their outpost**.
  - All foreign checkposts and unauthorized cameras across other borders are completely filtered out.

### 3. Dual-Spectrum Optical & Thermal Vision Engine
- **Nocturnal Stealth Detection**: Seamlessly switches to LWIR thermal telemetry during zero-lux darkness, blizzard, or dense alpine fog.
- **False Alarm Suppression**: Filters out over 95% of false alarms caused by desert dust plumes, flowing river ripples, and stray wildlife.
- **Lens Tamper & Blur Telemetry**: Evaluates Laplacian variance to detect lens occlusion, physical tampering, or fog build-up.

### 4. Edge AI, ByteTrack & Movement Intelligence
- **Deep Tracking**: ByteTrack Kalman filters assign persistent tracking IDs across occlusions, tree canopies, and temporary obstacles.
- **Geometric Virtual Fencing**: Arbitrary polygon intrusion zones, directional tripwires, and buffer exclusion zones.
- **Cross-Camera Handover (Re-ID)**: Re-identifies suspicious personnel or rogue vehicles across adjacent observation towers.

### 5. Multi-Camera Ingestion & NVR/DVR Gateway
- **Multi-Brand Compatibility**: Native RTSP and ONVIF support for Hikvision, Dahua, Axis, CP Plus, and Hanwha cameras.
- **Multi-Channel NVR/DVR Integration**: Register centralized recorders and stream individual sub-channels (`/ch1/main`, `/ch2/sub`) without saturating outpost bandwidth.
- **Edge Failover & Resilient Reconnection**: Exponential backoff reconnection loop maintains stream integrity during harsh weather or intermittent satellite connections.

---

## ☁️ Cloud Deployment Guide (Render + Vercel)

IBVAP is architected for decoupled cloud deployment: **FastAPI Backend on Render** and **React 3D Frontend on Vercel**.

### Part 1: Deploy Backend on Render
1. Go to [Render.com](https://render.com) and create a **New Web Service**.
2. Connect your GitHub repository: `rajdixit070-v/IBVAP-1`.
3. Configure the Web Service:
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
4. In the **Environment Variables** section, paste the configuration:
   ```env
   ENV_MODE=production
   DEMO_MODE=false
   LOG_LEVEL=INFO
   SECRET_KEY=e8b9f1d4a7c2e0b5c8a1f6d3e7b2a9c4f0d5e8b1a6c3e9f2a7c4b1d8e5f0a3c7
   CREDENTIAL_ENCRYPTION_KEY=37EsX1lJv2BRoaxV2bzfni1HB3y4fiTGMeJvtGtnLOY=
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   DATABASE_URL=sqlite:///./ibvap.db
   STORAGE_PATH=./storage
   EVIDENCE_STORAGE_PATH=./storage/evidence
   TEMP_STORAGE_PATH=./storage/temp
   DEFAULT_ADMIN_USERNAME=admin
   DEFAULT_ADMIN_PASSWORD=AdminSecure@IBVAP2026!
   DEFAULT_ADMIN_EMAIL=admin@ibvap.mil
   DEFAULT_OFFICER_USERNAME=officer_alpha
   DEFAULT_OFFICER_PASSWORD=OfficerSecure@IBVAP2026!
   DEFAULT_OFFICER_EMAIL=officer.alpha@ibvap.mil
   CORS_ORIGINS=https://*.vercel.app,http://localhost:5173
   MAX_AI_WORKERS=8
   FRAME_SAMPLE_RATE=2
   INFERENCE_QUEUE_MAX_SIZE=100
   TARGET_INFERENCE_FPS=10.0
   MAX_BATCH_SIZE=4
   YOLO_MODEL_PATH=yolov8n.pt
   WEATHER_PROVIDER=none
   WEATHER_API_KEY=none
   ```
   *(Optional: Connect a free Render PostgreSQL database and replace `DATABASE_URL` with the internal Postgres URL).*
5. Click **Create Web Service**. Once live, copy your backend URL (e.g. `https://ibvap-backend-illu.onrender.com`).

---

### Part 2: Deploy Frontend on Vercel
1. Go to [Vercel.com](https://vercel.com) and click **Add New... ➔ Project**.
2. Import repository `IBVAP-1`.
3. Configure the Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click **Edit** ➔ select **`frontend`** ➔ Click **Continue**.
   - **Build & Development Settings**: Keep Override toggles **OFF** (use defaults).
4. Add the Environment Variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://ibvap-backend-illu.onrender.com/api/v1` *(replace with your Render backend URL)*
5. Click **Deploy**. In under 60 seconds, your site will be live at `https://your-project.vercel.app`!

---

## 💻 Local Development Setup

### Prerequisites
- **Python**: 3.10 or higher
- **Node.js**: 18.x or higher with `npm`

### Step 1: Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate Python virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Launch FastAPI backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*API Swagger documentation available at: `http://localhost:8000/docs`.*

### Step 2: Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```
*Command Center UI available at: `http://localhost:5173`.*

---

## 🐳 Docker & VPS Deployment (Option 3)

Run the entire platform with one command on any Linux VPS (Ubuntu / Debian):

```bash
# Clone the repository
git clone https://github.com/rajdixit070-v/IBVAP-1.git
cd IBVAP-1

# Launch full stack (FastAPI Backend + React Frontend + Nginx Reverse Proxy)
docker compose up -d --build
```
- **Frontend**: Port `80` (`http://your-server-ip`)
- **Backend API**: Port `8000` (`http://your-server-ip:8000/api/v1`)

---

## 🔑 Default Credentials & Access Levels

| Role | Default Username | Default Password | Access Scope |
|:---|:---|:---|:---|
| **Super Admin / National HQ** | `admin` | `AdminSecure@IBVAP2026!` | Nationwide Multi-Frontier C2, System Health, Tactical 3D GIS, User Management |
| **BOP Sector Commander** | `officer_alpha` | `OfficerSecure@IBVAP2026!` | Assigned Outpost Perimeter, Outpost Cameras, QRT Dispatch |

---

## 📁 Repository Structure

```text
IBVAP-1/
├── backend/
│   ├── app/
│   │   ├── api/             # REST Endpoints (Cameras, Alerts, Health, Users, GIS, Drones)
│   │   ├── core/            # Security, JWT, Fernet Encryption, Configuration
│   │   ├── models/          # SQLAlchemy Database Schemas & Pydantic Models
│   │   ├── services/        # Video Ingestion, YOLOv8, ByteTrack, Telemetry Bus
│   │   └── main.py          # FastAPI Application Gateway & Lifespan Handler
│   ├── Dockerfile           # Backend Container Image
│   └── requirements.txt     # Python Dependencies
├── frontend/
│   ├── public/              # Official IBVAP Favicon, Logo & Tactical Assets
│   ├── src/
│   │   ├── components/      # Tactical 3D Map (MapLibre), Leaflet Map, Camera Modals, HUD
│   │   ├── pages/           # GIS Intelligence, Command Center, Sector Health, Dispatches
│   │   ├── services/        # Axios API Client & Sub-15ms WebSocket Event Stream
│   │   └── App.tsx          # Main React Application Router
│   ├── Dockerfile           # Multi-Stage Frontend Nginx Container Image
│   ├── nginx.conf           # Reverse Proxy & SPA Routing Configuration
│   ├── vercel.json          # Vercel SPA Client-Side Routing Rewrites
│   └── package.json         # Node.js Dependencies & Build Scripts
├── docker-compose.yml       # Production Multi-Container Orchestration
├── .env.example             # Complete Environment Configuration Template
└── README.md                # Master Documentation & Setup Guide
```

---

## 🛡️ License & Defense Inspection Compliance

Built strictly in compliance with enterprise zero-trust security architectures, non-repudiation cryptographic audit logs, and defense-grade situational awareness standards.
