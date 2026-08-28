# IBVAP — Production REST API Reference

## 1. Authentication & Session APIs (`/api/v1/auth`)

| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Form-encoded login returning JWT token | Public |
| `POST` | `/api/v1/auth/login-json` | JSON-encoded login returning JWT token | Public |
| `POST` | `/api/v1/auth/logout` | Revokes active JWT and adds to blacklist | Authenticated |
| `GET` | `/api/v1/auth/me` | Returns current user profile and scope | Authenticated |
| `POST` | `/api/v1/auth/validate-password-policy` | Evaluates password complexity score (0-100) | Public |
| `POST` | `/api/v1/auth/change-password` | Updates password enforcing policy rules | Authenticated |

---

## 2. Probes & Health APIs

| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/health` | Container / Kubernetes Liveness Probe | Public |
| `GET` | `/ready` | Container / Kubernetes Readiness Probe | Public |
| `GET` | `/api/v1/system/metrics` | Returns CPU, RAM, active streamers, queues | Public |
| `GET` | `/api/v1/health/system` | 5-Pillar Explainable System Health Score | Operator+ |
| `GET` | `/api/v1/health/cameras` | Real-time FPS, jitter, and tampering status | Operator+ |
| `GET` | `/api/v1/health/storage` | Storage capacity, evidence footprint & retention | Operator+ |

---

## 3. Demonstration & Hackathon APIs (`/api/v1/demo`)

| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/demo/status` | Current active demo scenario, step, and artifacts | Public |
| `GET` | `/api/v1/demo/scenarios` | List of available deterministic scenarios | Public |
| `POST` | `/api/v1/demo/run-scenario` | Executes a step or complete demonstration flow | Operator+ |
| `POST` | `/api/v1/demo/reset` | Resets demo mode state and clears ephemeral artifacts | Operator+ |

---

## 4. Multi-Site & Enterprise Security APIs (`/api/v1/security`)

| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/security/overview` | Zero-Trust posture score, active threats & findings | Operator+ |
| `GET` | `/api/v1/security/threats` | List cybersecurity threat telemetry events | Operator+ |
| `POST` | `/api/v1/security/threats/{id}/resolve` | Mitigates or resolves a security threat | Admin |
| `GET` | `/api/v1/security/edge-keys` | Lists cryptographic edge node API keys | Admin |
| `POST` | `/api/v1/security/edge-keys` | Generates new 256-bit edge node API key | Admin |
| `POST` | `/api/v1/security/edge-keys/{id}/revoke` | Revokes edge key immediately | Admin |
| `POST` | `/api/v1/security/accounts/{user}/unlock` | Clears brute-force lockout for user account | Admin |
| `GET` | `/api/v1/security/ip-blocklist` | List blocked IP addresses | Admin |
| `POST` | `/api/v1/security/ip-blocklist` | Manually block malicious IP address | Admin |
| `GET` | `/api/v1/security/export-report` | Export posture assessment report (JSON/CSV) | Admin |
