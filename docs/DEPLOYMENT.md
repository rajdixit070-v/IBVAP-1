# IBVAP — Production Deployment & Operations Guide

## 1. Prerequisites & System Requirements

| Component | Minimum Specification | Recommended Production |
|---|---|---|
| **CPU** | 4 Cores (x86_64 or ARM64) | 16+ Cores |
| **RAM** | 8 GB | 32 GB |
| **GPU** | Optional (CPU fallback supported) | NVIDIA RTX 4000 / T4 / Jetson Orin |
| **Storage** | 50 GB SSD | 1 TB NVMe SSD (RAID-10) |
| **OS** | Ubuntu 22.04 LTS / Windows Server 2022 | Ubuntu 22.04 LTS Server |
| **Python** | Python 3.10+ | Python 3.10.x |
| **Node.js** | Node.js 18+ | Node.js 20 LTS |

---

## 2. Local & Server Startup

### 2.1 Backend Setup
```bash
# 1. Clone repository and navigate to root
cd IBVAP-1

# 2. Setup Python environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# 3. Install dependencies
pip install -r backend/requirements.txt

# 4. Copy environment configuration
cp .env.example .env

# 5. Start Backend API Server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 2.2 Frontend Setup
```bash
cd frontend
npm install
npm run build   # Production bundle in dist/
npm run preview # Or serve with Nginx
```

---

## 3. Health & Probes Configuration

| Probe Type | Endpoint | Expected Status | Purpose |
|---|---|---|---|
| **Liveness** | `GET /health` | `HTTP 200 OK` (`{"status": "ALIVE"}`) | Process viability |
| **Readiness** | `GET /ready` | `HTTP 200 OK` (`{"status": "READY"}`) | DB, storage, AI readiness |
| **Subsystem Health** | `GET /api/v1/health/system` | `HTTP 200 OK` (Score 0-100) | Explainable 5-pillar health score |
| **Live Metrics** | `GET /api/v1/system/metrics` | `HTTP 200 OK` | CPU, RAM, active streamers, queues |

---

## 4. Docker Deployment Configuration (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  ibvap-backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "8000:8000"
    environment:
      - ENV_MODE=production
      - DATABASE_URL=postgresql://ibvap:secret@postgres:5432/ibvap_prod
      - SECRET_KEY=your-production-secret-key-64-chars
      - CREDENTIAL_ENCRYPTION_KEY=b3B2YaaAYm9yZGVyLWVuY3J5cHVpaW9uLWkuLTI0MjY=
    volumes:
      - ibvap_storage:/app/storage
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/ready"]
      interval: 15s
      timeout: 5s
      retries: 3

  ibvap-frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - ibvap-backend

volumes:
  ibvap_storage:
```
