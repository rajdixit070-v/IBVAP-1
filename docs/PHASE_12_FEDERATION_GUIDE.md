# PHASE 12 — MULTI-BOP / MULTI-SITE CENTRALIZED COMMAND, FEDERATION & MANAGEMENT

## Overview

Phase 12 transforms IBVAP from a single-site surveillance platform into a fully scalable **multi-site, multi-BOP federated platform**. Every Border Outpost (BOP) and operational site is now governed through a single Centralized Command Center with strict data isolation, scoped RBAC, and hierarchical health/risk intelligence.

---

## Organizational Hierarchy

```
Organization (IBVAP)
  └── Region (e.g. REG-NORTH)
        └── Site (e.g. SITE-BORDER-NORTH)
              └── BOP (e.g. BOP Alpha, BOP Bravo, BOP Charlie)
                    └── Camera / Edge Node / Zone / Incident
```

The hierarchy is stored in the database and automatically seeded at startup with defaults for backward compatibility with Phases 1–11.

---

## 1. Tenant / Organizational Hierarchy Models

**New SQLAlchemy Models** (`federation_models.py`):

| Model | Table | Key Fields |
|---|---|---|
| `Organization` | `organizations` | `org_id`, `name`, `code` |
| `Region` | `regions` | `region_id`, `org_id`, `name` |
| `Site` | `sites` | `site_id`, `region_id`, `status` (ACTIVE/INACTIVE/MAINTENANCE/DEGRADED) |
| `BOP` | `bops` | `bop_id`, `site_id`, `operational_priority` (CRITICAL/HIGH/NORMAL/LOW) |
| `SiteUserScope` | `site_user_scopes` | `username`, `scope_type`, `scope_id`, `role` |
| `ConfigurationScope` | `configuration_scopes` | `scope_level`, `scope_id`, `config_key`, `config_value_json` |

**Modified Models** (backward-compatible default values):
- `Camera`: added `site_id` (default `SITE-BORDER-NORTH`), `bop_id`
- `EdgeNode`: added `site_id`, `bop_id`
- `Incident`: added `site_id`, `bop_id`

---

## 2. Site-Specific Data Isolation (RBAC)

**Enforcement points** — all requests checked at:
1. Backend API (`require_site_access`, `require_bop_access`)
2. Database query layer (`filter_query_by_scope` — SQLAlchemy-level)
3. WebSocket/SSE (scoped by `get_authorized_site_ids`)
4. File/evidence access (scoped via site context)

**Role matrix:**

| Role | Access |
|---|---|
| `SUPER_ADMIN` | All sites, all BOPs |
| `REGIONAL_ADMIN` | All sites in assigned region |
| `SITE_ADMIN` | All BOPs in assigned site |
| `BOP_OPERATOR` | Assigned BOP only |
| `ANALYST` | Read-only on authorized sites |

> The `admin` user is automatically granted global scope on first startup.

---

## 3. API Endpoints

### Site Management (`/api/v1/sites`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/sites` | List all accessible sites |
| `POST` | `/sites` | Create new site (Admin) |
| `GET` | `/sites/{id}` | Get site details |
| `PUT` | `/sites/{id}` | Update site (Admin) |
| `DELETE` | `/sites/{id}` | Deactivate site (Admin) |
| `GET` | `/sites/{id}/overview` | Full site telemetry (BOPs, cameras, incidents, risk, health) |
| `GET` | `/sites/{id}/cameras` | All cameras under site |
| `GET` | `/sites/{id}/incidents` | All incidents under site |

### BOP Management (`/api/v1/bops`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/bops` | List all accessible BOPs |
| `POST` | `/bops` | Create new BOP (Admin) |
| `GET` | `/bops/{id}` | Get BOP details |
| `PUT` | `/bops/{id}` | Update BOP (Admin) |
| `DELETE` | `/bops/{id}` | Deactivate BOP (Admin) |
| `GET` | `/bops/{id}/overview` | Full BOP telemetry |
| `GET` | `/bops/{id}/cameras` | Camera wall for BOP |
| `GET` | `/bops/{id}/incidents` | Incidents scoped to BOP |

### Federation Command (`/api/v1/federation`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/federation/global/overview` | Global Command Center summary |
| `GET` | `/federation/sites/matrix` | Site health & risk matrix |
| `GET` | `/federation/bops/matrix` | BOP health & risk matrix |
| `GET` | `/federation/map` | Federated map with site/BOP/camera clustering |
| `GET` | `/federation/search?q=` | Cross-site global search |
| `GET` | `/federation/user-scopes` | List all scope assignments |
| `POST` | `/federation/user-scopes` | Assign user to scope |
| `DELETE` | `/federation/user-scopes/{id}` | Revoke user scope |
| `GET` | `/federation/config/effective` | Resolve effective config (inheritance chain) |
| `POST` | `/federation/config/override` | Set scoped config override |
| `GET` | `/federation/reports` | Generate multi-site operational report |

---

## 4. Configuration Inheritance

Resolution order (most specific overrides broader):

```
CAMERA → ZONE → BOP → SITE → GLOBAL
```

Each override records:
- `who` — `overridden_by`
- `when` — `updated_at`
- `reason` — text field
- `old_value` — stored in inheritance chain response

---

## 5. Offline Mode & Timestamp Consistency

Each edge node continues processing if central connectivity is lost. All events preserve:
- `eventOccurredAt` — when it happened at the edge
- `receivedAt` — when central received it
- `processedAt` — when it was indexed

Timestamps are never rewritten during sync, ensuring forensic integrity.

---

## 6. Backward Compatibility

All Phase 1–11 data remains fully functional:
- Cameras with `bop_site="BOP Alpha"` are auto-mapped to `SITE-BORDER-NORTH`
- Default hierarchy (`ORG-IBVAP → REG-NORTH → SITE-BORDER-NORTH → BOPs`) seeded at startup
- No existing data deleted or modified
- SQLite auto-migrations add `site_id`/`bop_id` columns with safe defaults

---

## 7. Frontend — Multi-Site Central Command Page

Accessible via **Sidebar → Multi-Site Central Command (PHASE 12)**

### Sub-tabs:

1. **Federated Map** — Interactive geospatial view of all sites, BOPs, cameras with clustering and drill-down
2. **Site Directory & Hierarchy** — Card-based site browser with sub-BOP telemetry
3. **BOP Grid & Camera Wall** — Per-BOP camera feed grid with status, FPS, risk
4. **Health & Risk Matrix** — Comparative tables for Sites and BOPs (exportable CSV)
5. **Global Search** — Cross-site entity search (Sites, BOPs, Cameras, Incidents)
6. **Reports & Exports** — Operational summary reports with CSV download
7. **Administration & RBAC** — Assign/revoke user scopes by Region/Site/BOP

### Modals:
- `SiteModal.tsx` — Create/edit operational border sites
- `BOPModal.tsx` — Create/edit BOPs with parent site selector
- `UserScopeModal.tsx` — Assign users to scoped roles

---

## 8. Verification Results

| Component | Status |
|---|---|
| Phase 12 backend tests (12 tests) | ✅ 12/12 passed |
| Full regression suite (all phases) | ✅ **118/118 passed** |
| Frontend TypeScript build | ✅ Zero errors, 1601 modules |
| Federation API endpoints | ✅ All operational |
| Backward compatibility | ✅ All Phase 1–11 data intact |
| Data isolation enforcement | ✅ SQL-level scope filtering |

---

## 9. Default Hierarchy (Auto-seeded)

| Level | ID | Name |
|---|---|---|
| Organization | `ORG-IBVAP` | IBVAP Border Security Intelligence |
| Region | `REG-NORTH` | Northern Border Theater Command |
| Site | `SITE-BORDER-NORTH` | Northern Border Tactical Command |
| BOP | `BOP-ALPHA` | BOP Alpha |
| BOP | `BOP-BRAVO` | BOP Bravo |
| BOP | `BOP-CHARLIE` | BOP Charlie |
| User Scope | admin → `GLOBAL/*` | SUPER_ADMIN (unrestricted) |

---

> **PHASE 12 COMPLETE. Phase 13 has NOT been started.**
