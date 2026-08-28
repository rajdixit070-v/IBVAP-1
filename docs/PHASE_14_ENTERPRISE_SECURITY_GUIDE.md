# IBVAP Phase 14 — Enterprise Security, Cybersecurity & Zero-Trust Architecture

## 1. Executive Summary & Zero-Trust Mandate

The Intelligent Border Video Analytics Platform (IBVAP) Phase 14 establishes a hardened, defense-in-depth cybersecurity posture across tactical border posts, regional command centers, distributed edge nodes, AI workloads, and central cloud federation.

Under the Zero-Trust Architecture (ZTA) principle:
> **"Never trust, always verify."**
No request is trusted based on network origin (LAN, VPN, internal subnet, or edge node). Every interaction is explicitly **authenticated**, **authorized**, **validated**, and **audited**.

---

## 2. Architecture & Defense Layers

```
                     +---------------------------------------+
                     |         Web / Mobile Client           |
                     +---------------------------------------+
                                         │ (HTTPS / WSS)
                                         ▼
                     +---------------------------------------+
                     |      SecurityHeadersMiddleware        |
                     |  • CSP • HSTS • X-Frame • Nosniff    |
                     +---------------------------------------+
                                         │
                                         ▼
                     +---------------------------------------+
                     |         AuthRateLimiter Guard         |
                     |  • IP Sliding Window • Brute Force    |
                     |  • Account Lockout (5 fails/15min)    |
                     +---------------------------------------+
                                         │
                                         ▼
                     +---------------------------------------+
                     |         JWT & Session Blacklist       |
                     |  • Immediate Logout Invalidation      |
                     +---------------------------------------+
                                         │
                                         ▼
                     +---------------------------------------+
                     |       Scoped RBAC & IDOR Guard        |
                     |  • Object-Level Site/BOP Verification |
                     +---------------------------------------+
                                         │
                       ┌─────────────────┴─────────────────┐
                       ▼                                   ▼
+-------------------------------+ +-------------------------------+
|      SSRF & Destination       | |     Input Sanitizer Engine    |
| • Cloud IMDS (169.254.169.254)| | • Path Traversal / Null Byte  |
| • Loopback & Port Allowlist   | | • Multipart Upload 25MB Limit |
+-------------------------------+ | • NoSQL Injection Operator Strip|
                                  +-------------------------------+
                                                   │
                                                   ▼
                                  +-------------------------------+
                                  |    Edge Cryptographic Auth    |
                                  | • 256-bit SHA-256 Per Node Key|
                                  | • Instant Revocation Registry |
                                  +-------------------------------+
                                                   │
                                                   ▼
                                  +-------------------------------+
                                  |  Security Correlation Engine  |
                                  | • Threat Correlation Patterns |
                                  | • Explainable Posture (0-100) |
                                  +-------------------------------+
```

---

## 3. Core Capabilities Implemented

### 3.1 Authentication Hardening & Password Policy
- **Password Policy (`PasswordPolicyService`)**:
  - Minimum 8 characters.
  - At least 1 uppercase, 1 lowercase, 1 number, and 1 special symbol (`!@#$%^&*()_+-=[]{}|;:,.<>?`).
  - Username / email substring prohibition.
  - Returns explainable score (0–100) and actionable requirement violations.
- **Brute-Force & Lockout (`AuthRateLimiter`)**:
  - Sliding-window tracking of failed login attempts per username and client IP.
  - Progressive delay and automatic temporary account lockout (15 minutes) upon 5 consecutive failures.
  - Automated generation of `BRUTE_FORCE_ATTEMPT` security threat alerts with source IP and user agent.
  - Administrative instant unlock endpoint: `POST /api/v1/security/accounts/{username}/unlock`.
- **Session Token Revocation (`SessionTokenBlacklist`)**:
  - Immediate JWT invalidation on `POST /api/v1/auth/logout`.
  - Blacklisted tokens are rejected across all protected endpoints with `HTTP 401 Unauthorized`.

### 3.2 Scoped Authorization & IDOR Protection
- **Object-Level Authorization (`verify_camera_access`)**:
  - Intercepts all camera requests and verifies operator/analyst site assignment using `ScopeService.can_access_site`.
  - Unauthorized cross-site requests fail closed with `HTTP 403 Forbidden`.
  - Automatically records an `IDOR_ATTEMPT` event in the threat telemetry log with target camera ID, actor, and source IP.

### 3.3 RTSP Credential Encryption & Masking
- **Fernet AES-256 Encryption**:
  - Camera RTSP credentials are encrypted at rest using system-level cryptographic keys.
- **URL & Secret Masking**:
  - `mask_rtsp_url` sanitizes all RTSP URLs before returning to client interfaces or telemetry streams (`rtsp://***:***@192.168.1.100:554/stream`).
  - Plaintext passwords never appear in API responses, server logs, or audit records.

### 3.4 SSRF & Stream Target Defense
- **Outbound Stream Target Validator (`SSRFValidator`)**:
  - Blocks cloud instance metadata services (AWS IMDS `169.254.169.254`, GCP `metadata.google.internal`).
  - Blocks loopback addresses (`127.0.0.1`, `localhost`) and link-local ranges.
  - Restricts stream connections to validated ports (`554`, `8554`, `80`, `443`, `8080`, `8000`, `1935`).

### 3.5 Input Sanitization, Path Traversal & File Uploads
- **Path Traversal Defense (`InputSanitizerService.sanitize_file_path`)**:
  - Normalizes paths and rejects `../`, `%2e%2e`, and null bytes (`\0`).
  - Ensures file operations remain strictly anchored within designated data directories.
- **Multipart Upload Validator (`InputSanitizerService.validate_file_upload`)**:
  - Enforces 25MB file size limit and strict MIME whitelist (`image/jpeg`, `image/png`, `video/mp4`).
- **NoSQL Injection Sanitizer (`InputSanitizerService.sanitize_query_filter`)**:
  - Strips MongoDB operator injections (`$where`, `$regex`, `$ne`, `$gt`).

### 3.6 Edge Node Cryptographic Key Lifecycle
- **Edge API Key Generation (`EdgeAuthService.issue_edge_key`)**:
  - Issues 256-bit cryptographically secure API keys (`edg_live_<hex>`).
  - Stores salted SHA-256 key hash in `edge_node_credentials`.
  - Configurable expiration (30, 90, 180, 365 days).
- **Instant Revocation (`EdgeAuthService.revoke_edge_key`)**:
  - One-click revocation immediately invalidates compromised edge node keys.
  - Requests from revoked keys trigger `REVOKED_NODE_ATTEMPT` security alerts.

### 3.7 Security Operations Center (SOC) & Correlation Engine
- **Threat Event Correlation (`SecurityCorrelationEngine.correlate_threat_events`)**:
  - Correlates atomic events across time windows into high-order attack patterns (`AUTHENTICATION_ATTACK_PATTERN`, `PRIVILEGE_SCANNING_PATTERN`).
- **Explainable Security Posture Score (0–100)**:
  - Dynamically evaluates authentication hygiene, IDOR resistance, edge credential health, and active threats.
  - Produces prioritized, actionable findings and recommendations.

---

## 4. API Reference Summary

| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/security/overview` | Zero-Trust posture score, active threats, and findings | Operator+ |
| `GET` | `/api/v1/security/threats` | List cybersecurity threat telemetry events | Operator+ |
| `POST` | `/api/v1/security/threats/{id}/resolve` | Mitigate or resolve a threat alert with notes | Admin |
| `POST` | `/api/v1/security/threats/correlate` | Trigger correlation engine on recent threat logs | Admin |
| `GET` | `/api/v1/security/edge-keys` | List edge node cryptographic credentials | Admin |
| `POST` | `/api/v1/security/edge-keys` | Issue new cryptographic edge API key | Admin |
| `POST` | `/api/v1/security/edge-keys/{node_id}/revoke` | Revoke edge node credential immediately | Admin |
| `GET` | `/api/v1/security/ip-blocklist` | List blocked IP addresses | Admin |
| `POST` | `/api/v1/security/ip-blocklist` | Manually block an IP address | Admin |
| `DELETE` | `/api/v1/security/ip-blocklist/{ip}` | Unblock an IP address | Admin |
| `POST` | `/api/v1/security/accounts/{user}/unlock` | Administratively unlock a brute-force locked account | Admin |
| `POST` | `/api/v1/auth/validate-password-policy` | Validate password complexity against policy | Public |
| `POST` | `/api/v1/auth/logout` | Revoke JWT session token via blacklist | Authenticated |
| `GET` | `/api/v1/security/audit-logs` | Query administrative security audit logs | Admin |
| `GET` | `/api/v1/security/export-report` | Export posture assessment report (JSON/CSV) | Admin |

---

## 5. Verification & Test Results

- **Automated Security Test Suite**: `backend/tests/test_phase14_security.py` — **15 / 15 PASSED (100%)**.
- **Full Platform Regression Suite**: `backend/tests/` — **147 / 147 PASSED (100%)**.
- **Frontend TypeScript Build**: `npm run build` in `frontend/` — **ZERO TypeScript errors (0.00s)**.
