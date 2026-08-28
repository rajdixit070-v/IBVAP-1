# IBVAP — Production Security, Zero-Trust & Compliance Specification

## 1. Security Architecture Principles

IBVAP implements a strict Zero-Trust Architecture (ZTA):
1. **Never Trust, Always Verify**: Every API request must carry a valid, unrevoked JWT token with authorized claims.
2. **Deny-by-Default Authorization**: Access to camera streams, events, and administrative controls is denied unless explicitly allowed by role and Site/BOP scope.
3. **Defense in Depth**: Security headers, rate limiters, IDOR guards, SSRF filters, path traversal sanitizers, and token blacklists operate concurrently.
4. **Tamper-Evident Accountability**: High-privilege actions (zone configuration, incident resolution, credential changes) generate immutable audit logs.

---

## 2. Implemented Defense Controls

### 2.1 Authentication & Session Protection
- **Password Complexity Policy**: Minimum 8 characters, uppercase, lowercase, numbers, special symbols, and username exclusion.
- **Brute-Force & Lockout**: 5 failed login attempts trigger progressive delays, 15-minute account lockout, and high-severity security threat alerts.
- **Session Blacklisting**: `POST /api/v1/auth/logout` revokes the active JWT immediately across all backend workers.

### 2.2 Scoped Authorization & IDOR Defense
- **Object-Level Scope Guard**: In `deps.verify_camera_access`, operators assigned to `SITE-BORDER-NORTH` cannot read or modify cameras located in `SITE-BORDER-SOUTH`.
- **Automatic Threat Telemetry**: Unauthorized cross-site attempts fail closed with `HTTP 403 Forbidden` and record an `IDOR_ATTEMPT` cybersecurity threat event.

### 2.3 Credential & Stream Target Security
- **Fernet AES-256 Storage**: RTSP camera passwords are encrypted at rest using system-level cryptographic keys.
- **Secret Masking**: Passwords are automatically redacted from API outputs, server logs, and audit trails (`rtsp://***:***@192.168.1.100:554/stream`).
- **SSRF Shield**: Outbound stream and test connections reject AWS/GCP cloud metadata (`169.254.169.254`), loopbacks, and unapproved ports.

### 2.4 File Upload & Input Sanitization
- **Path Traversal Defense**: Rejects `../`, `%2e%2e`, and null bytes (`\0`).
- **Upload Validation**: Enforces 25MB file limit and strictly validates MIME types (`image/jpeg`, `image/png`, `video/mp4`).
- **NoSQL Injection Stripper**: Sanitizes MongoDB/SQLite query objects to remove `$where`, `$regex`, and nested operator injections.
