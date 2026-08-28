from typing import List, Optional, Dict, Any
from datetime import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.federation_models import Site, BOP, SiteUserScope, ConfigurationScope
from app.models.camera import Camera
from app.models.incident import Incident
from app.models.alert import Alert
from app.models.edge_node import EdgeNode
from app.schemas.federation_schemas import (
    GlobalOverviewResponse,
    SiteHealthMatrixRow,
    BOPHealthMatrixRow,
    UserScopeCreate,
    UserScopeResponse,
    ConfigOverrideCreate,
    EffectiveConfigResponse,
    GlobalSearchResponse,
    GlobalSearchResultItem,
    MultiSiteReportResponse
)
from app.services.federation.scope_service import ScopeService
from app.services.federation.federation_service import FederationService
from app.models.audit_log import SecurityAuditLog

router = APIRouter(prefix="/federation", tags=["Federation & Central Command (Phase 12)"])

@router.get("/global/overview", response_model=GlobalOverviewResponse)
def get_global_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Section 21: GLOBAL COMMAND CENTER overview cards:
    Sites, BOPs, Cameras, Active Incidents, Critical Alerts, System Health, Forecast Warnings.
    """
    auth_sites = ScopeService.get_authorized_site_ids(current_user, db)
    sites_q = db.query(Site)
    if auth_sites is not None:
        sites_q = sites_q.filter(Site.site_id.in_(auth_sites))
    sites = sites_q.all()

    total_sites = len(sites)
    active_sites = sum(1 for s in sites if s.status == "ACTIVE")

    # BOPs
    bops_q = db.query(BOP)
    if auth_sites is not None:
        bops_q = bops_q.filter(BOP.site_id.in_(auth_sites))
    bops = bops_q.all()
    total_bops = len(bops)

    # Cameras
    cams_q = ScopeService.filter_query_by_scope(db.query(Camera), Camera, current_user, db)
    cameras = cams_q.all()
    total_cams = len(cameras)
    online_cams = sum(1 for c in cameras if c.status in ["HEALTHY", "ONLINE"] and not c.is_maintenance)
    degraded_cams = sum(1 for c in cameras if c.status == "DEGRADED" and not c.is_maintenance)
    offline_cams = sum(1 for c in cameras if c.status in ["OFFLINE", "ERROR"] and not c.is_maintenance)

    # Incidents
    inc_q = ScopeService.filter_query_by_scope(db.query(Incident), Incident, current_user, db)
    active_incidents = inc_q.filter(Incident.status.in_(["ACTIVE", "UNDER_INVESTIGATION", "ESCALATED"])).count()

    # Alerts
    alt_q = ScopeService.filter_query_by_scope(db.query(Alert), Alert, current_user, db)
    critical_alerts = alt_q.filter(Alert.priority == "CRITICAL", Alert.status.in_(["NEW", "ACKNOWLEDGED", "ESCALATED"])).count()

    # Health & Risk calculations
    site_health_scores = [FederationService.get_site_health(s.site_id, db)["health_score"] for s in sites]
    overall_health = round(sum(site_health_scores) / len(site_health_scores), 1) if site_health_scores else 100.0

    if overall_health >= 85.0:
        health_status = "HEALTHY"
    elif overall_health >= 70.0:
        health_status = "DEGRADED"
    elif overall_health >= 50.0:
        health_status = "WARNING"
    else:
        health_status = "CRITICAL"

    high_risk_bops = sum(1 for b in bops if FederationService.get_bop_risk(b.bop_id, db) >= 60)
    forecast_warnings = high_risk_bops + (1 if degraded_cams > 0 else 0)

    return GlobalOverviewResponse(
        total_sites=total_sites,
        active_sites=active_sites,
        total_bops=total_bops,
        total_cameras=total_cams,
        online_cameras=online_cams,
        offline_cameras=offline_cams,
        degraded_cameras=degraded_cams,
        active_incidents=active_incidents,
        critical_alerts=critical_alerts,
        overall_health_score=overall_health,
        overall_health_status=health_status,
        forecast_warnings_count=forecast_warnings,
        high_risk_bops_count=high_risk_bops,
        timestamp=datetime.utcnow().isoformat()
    )

@router.get("/sites/matrix", response_model=List[SiteHealthMatrixRow])
def get_site_health_matrix(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Section 22: SITE HEALTH MATRIX:
    Site | BOPs | Cameras | Online | Offline | Incidents | Risk | Health
    """
    auth_sites = ScopeService.get_authorized_site_ids(current_user, db)
    sites_q = db.query(Site)
    if auth_sites is not None:
        sites_q = sites_q.filter(Site.site_id.in_(auth_sites))
    sites = sites_q.all()

    matrix = []
    for s in sites:
        sh = FederationService.get_site_health(s.site_id, db)
        sr = FederationService.get_site_risk(s.site_id, db)
        
        # Count active incidents for site
        bops = db.query(BOP).filter(BOP.site_id == s.site_id).all()
        bop_names = [b.name for b in bops] + [b.bop_id for b in bops]
        active_inc = db.query(Incident).filter(
            (Incident.site_id == s.site_id) | (Incident.bop_site.in_(bop_names)),
            Incident.status.in_(["ACTIVE", "UNDER_INVESTIGATION", "ESCALATED"])
        ).count()

        matrix.append(SiteHealthMatrixRow(
            site_id=s.site_id,
            site_name=s.name,
            status=s.status,
            bops_count=sh["bops_count"],
            total_cameras=sh["total_cameras"],
            online_cameras=sh["online_cameras"],
            offline_cameras=sh["offline_cameras"],
            degraded_cameras=sh["degraded_cameras"],
            active_incidents=active_inc,
            current_risk=sr,
            health_score=sh["health_score"],
            health_status=sh["health_status"]
        ))
    return matrix

@router.get("/bops/matrix", response_model=List[BOPHealthMatrixRow])
def get_bop_health_matrix(
    site_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Section 23: BOP HEALTH MATRIX:
    BOP | Site | Cameras | Online | Offline | Incidents | Risk | Health
    """
    bops_q = db.query(BOP)
    if site_id:
        ScopeService.require_site_access(current_user, site_id, db)
        bops_q = bops_q.filter(BOP.site_id == site_id)
    else:
        auth_sites = ScopeService.get_authorized_site_ids(current_user, db)
        if auth_sites is not None:
            bops_q = bops_q.filter(BOP.site_id.in_(auth_sites))

    bops = bops_q.all()
    matrix = []
    for b in bops:
        bh = FederationService.get_bop_health(b.bop_id, db)
        br = FederationService.get_bop_risk(b.bop_id, db)
        
        active_inc = db.query(Incident).filter(
            (Incident.bop_site == b.name) | (Incident.bop_id == b.bop_id),
            Incident.status.in_(["ACTIVE", "UNDER_INVESTIGATION", "ESCALATED"])
        ).count()

        matrix.append(BOPHealthMatrixRow(
            bop_id=b.bop_id,
            bop_name=b.name,
            site_id=b.site_id,
            status=b.status,
            priority=b.operational_priority,
            total_cameras=bh["total_cameras"],
            online_cameras=bh["online_cameras"],
            offline_cameras=bh["offline_cameras"],
            active_incidents=active_inc,
            current_risk=br,
            health_score=bh["health_score"],
            health_status=bh["health_status"]
        ))
    return matrix

@router.get("/map")
def get_federated_map_data(
    site_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Section 9 & 10: Unified federated map nodes with clustering metadata.
    Returns Sites, BOPs, and Cameras with geospatial coordinates and status.
    """
    sites_q = db.query(Site)
    if site_id:
        ScopeService.require_site_access(current_user, site_id, db)
        sites_q = sites_q.filter(Site.site_id == site_id)
    else:
        auth_sites = ScopeService.get_authorized_site_ids(current_user, db)
        if auth_sites is not None:
            sites_q = sites_q.filter(Site.site_id.in_(auth_sites))
    sites = sites_q.all()

    site_nodes = []
    bop_nodes = []
    camera_nodes = []

    for s in sites:
        sh = FederationService.get_site_health(s.site_id, db)
        sr = FederationService.get_site_risk(s.site_id, db)
        site_nodes.append({
            "type": "SITE",
            "id": s.site_id,
            "name": s.name,
            "code": s.code,
            "status": s.status,
            "latitude": s.latitude or 32.7266,
            "longitude": s.longitude or 74.8570,
            "health_score": sh["health_score"],
            "risk_score": sr,
            "total_cameras": sh["total_cameras"]
        })

        bops = db.query(BOP).filter(BOP.site_id == s.site_id).all()
        for b in bops:
            bh = FederationService.get_bop_health(b.bop_id, db)
            br = FederationService.get_bop_risk(b.bop_id, db)
            bop_nodes.append({
                "type": "BOP",
                "id": b.bop_id,
                "site_id": s.site_id,
                "name": b.name,
                "status": b.status,
                "priority": b.operational_priority,
                "latitude": b.latitude or (s.latitude or 32.7266) + 0.005,
                "longitude": b.longitude or (s.longitude or 74.8570) + 0.005,
                "health_score": bh["health_score"],
                "risk_score": br,
                "total_cameras": bh["total_cameras"]
            })

            # Cameras under this BOP
            cams = db.query(Camera).filter(
                (Camera.bop_site == b.name) | (Camera.bop_id == b.bop_id)
            ).all()
            for c in cams:
                camera_nodes.append({
                    "type": "CAMERA",
                    "id": c.camera_id,
                    "name": c.camera_name,
                    "site_id": s.site_id,
                    "bop_id": b.bop_id,
                    "bop_name": b.name,
                    "status": c.status,
                    "priority": c.priority,
                    "latitude": c.latitude or 32.7266,
                    "longitude": c.longitude or 74.8570,
                    "fps": c.fps,
                    "image_quality_score": c.image_quality_score
                })

    return {
        "sites": site_nodes,
        "bops": bop_nodes,
        "cameras": camera_nodes,
        "clusters_summary": {
            "total_sites": len(site_nodes),
            "total_bops": len(bop_nodes),
            "total_cameras": len(camera_nodes)
        }
    }

@router.get("/search", response_model=GlobalSearchResponse)
def cross_site_global_search(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Section 37 & 94: CROSS-SITE GLOBAL SEARCH
    Search across camera, BOP, site, incident, track, alert respecting user scope.
    """
    items = FederationService.global_search(q, current_user, db, limit=50)
    return GlobalSearchResponse(
        query=q,
        total_matches=len(items),
        results=[GlobalSearchResultItem(**item) for item in items]
    )

# --- Scoped RBAC User Assignments ---
@router.get("/user-scopes", response_model=List[UserScopeResponse])
def list_user_scopes(
    username: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Lists scoped access assignments (Admin only)."""
    q = db.query(SiteUserScope)
    if username:
        q = q.filter(SiteUserScope.username == username)
    return q.all()

@router.post("/user-scopes", response_model=UserScopeResponse, status_code=status.HTTP_201_CREATED)
def assign_user_scope(
    payload: UserScopeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Assigns user to a Region, Site, or BOP scope (Admin only)."""
    # Check if target user exists
    target_user = db.query(User).filter(User.username == payload.username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User '{payload.username}' not found.")

    # Remove existing assignment for same scope_type and scope_id if present
    existing = db.query(SiteUserScope).filter(
        SiteUserScope.username == payload.username,
        SiteUserScope.scope_type == payload.scope_type,
        SiteUserScope.scope_id == payload.scope_id
    ).first()
    if existing:
        existing.role = payload.role
        existing.assigned_by = current_user.username
        db.commit()
        db.refresh(existing)
        return existing

    assignment = SiteUserScope(
        username=payload.username.strip(),
        scope_type=payload.scope_type.upper(),
        scope_id=payload.scope_id.strip(),
        role=payload.role.upper(),
        assigned_by=current_user.username
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    db.add(SecurityAuditLog(
        action="USER_SCOPE_ASSIGNED",
        username=current_user.username,
        resource_type="USER_SCOPE",
        resource_id=f"{payload.scope_type}:{payload.scope_id}",
        details=f"Assigned scope '{payload.scope_type}:{payload.scope_id}' with role '{payload.role}' to user '{payload.username}'"
    ))
    db.commit()
    return assignment

@router.delete("/user-scopes/{scope_id}")
def revoke_user_scope(
    scope_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Revokes a user scope assignment."""
    scope = db.query(SiteUserScope).filter(SiteUserScope.id == scope_id).first()
    if not scope:
        raise HTTPException(status_code=404, detail=f"User scope '{scope_id}' not found.")
    
    uname = scope.username
    stype = scope.scope_type
    sid = scope.scope_id
    db.delete(scope)

    db.add(SecurityAuditLog(
        action="USER_SCOPE_REVOKED",
        username=current_user.username,
        resource_type="USER_SCOPE",
        resource_id=f"{stype}:{sid}",
        details=f"Revoked scope '{stype}:{sid}' from user '{uname}'"
    ))
    db.commit()
    return {"message": "Scope assignment revoked."}

# --- Configuration Inheritance & Overrides ---
@router.get("/config/effective", response_model=EffectiveConfigResponse)
def get_effective_config(
    key: str = Query(..., description="Configuration key"),
    site_id: Optional[str] = Query(None),
    bop_id: Optional[str] = Query(None),
    zone_id: Optional[str] = Query(None),
    camera_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Section 42: Configuration Inheritance
    Resolves effective value from Camera -> Zone -> BOP -> Site -> Global.
    """
    resolved = FederationService.resolve_effective_config(
        config_key=key,
        site_id=site_id,
        bop_id=bop_id,
        zone_id=zone_id,
        camera_id=camera_id,
        db=db
    )
    return EffectiveConfigResponse(**resolved)

@router.post("/config/override", status_code=status.HTTP_201_CREATED)
def set_config_override(
    payload: ConfigOverrideCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Section 43: Configuration Audit & Overrides
    Sets a scoped configuration override recording who, when, and justification.
    """
    cfg = db.query(ConfigurationScope).filter(
        ConfigurationScope.scope_level == payload.scope_level.upper(),
        ConfigurationScope.scope_id == payload.scope_id,
        ConfigurationScope.config_key == payload.config_key
    ).first()

    if cfg:
        cfg.config_value_json = payload.config_value_json
        cfg.overridden_by = current_user.username
        cfg.reason = payload.reason
    else:
        cfg = ConfigurationScope(
            scope_level=payload.scope_level.upper(),
            scope_id=payload.scope_id,
            config_key=payload.config_key,
            config_value_json=payload.config_value_json,
            overridden_by=current_user.username,
            reason=payload.reason
        )
        db.add(cfg)

    db.commit()
    db.refresh(cfg)

    db.add(SecurityAuditLog(
        action="CONFIG_OVERRIDE_SAVED",
        username=current_user.username,
        resource_type="CONFIGURATION",
        resource_id=f"{payload.scope_level}:{payload.scope_id}",
        details=f"Set config override for '{payload.config_key}' at level '{payload.scope_level}:{payload.scope_id}' (Reason: {payload.reason})"
    ))
    db.commit()
    return {"message": "Configuration override applied successfully.", "id": cfg.id}

@router.get("/reports", response_model=MultiSiteReportResponse)
def generate_multi_site_report(
    scope: str = Query("ALL", description="ALL, SITE, BOP"),
    scope_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Section 66: Aggregated multi-site report generator.
    """
    auth_sites = ScopeService.get_authorized_site_ids(current_user, db)
    sites_q = db.query(Site)
    if scope == "SITE" and scope_id:
        ScopeService.require_site_access(current_user, scope_id, db)
        sites_q = sites_q.filter(Site.site_id == scope_id)
    elif auth_sites is not None:
        sites_q = sites_q.filter(Site.site_id.in_(auth_sites))
    sites = sites_q.all()

    site_breakdowns = []
    bop_breakdowns = []
    total_cams = 0
    total_online = 0
    total_offline = 0
    total_incidents = 0

    for s in sites:
        sh = FederationService.get_site_health(s.site_id, db)
        sr = FederationService.get_site_risk(s.site_id, db)
        total_cams += sh["total_cameras"]
        total_online += sh["online_cameras"]
        total_offline += sh["offline_cameras"]

        bops = db.query(BOP).filter(BOP.site_id == s.site_id).all()
        for b in bops:
            bh = FederationService.get_bop_health(b.bop_id, db)
            br = FederationService.get_bop_risk(b.bop_id, db)
            inc_count = db.query(Incident).filter(
                (Incident.bop_site == b.name) | (Incident.bop_id == b.bop_id)
            ).count()
            total_incidents += inc_count

            bop_breakdowns.append({
                "bop_id": b.bop_id,
                "name": b.name,
                "site_id": s.site_id,
                "cameras": bh["total_cameras"],
                "online": bh["online_cameras"],
                "health": bh["health_score"],
                "risk": br,
                "incidents": inc_count
            })

        site_breakdowns.append({
            "site_id": s.site_id,
            "name": s.name,
            "bops_count": len(bops),
            "cameras": sh["total_cameras"],
            "online": sh["online_cameras"],
            "health": sh["health_score"],
            "risk": sr
        })

    return MultiSiteReportResponse(
        report_scope=scope,
        scope_id=scope_id or "GLOBAL",
        generated_at=datetime.utcnow().isoformat(),
        summary={
            "total_sites": len(sites),
            "total_bops": len(bop_breakdowns),
            "total_cameras": total_cams,
            "total_online": total_online,
            "total_offline": total_offline,
            "total_incidents": total_incidents
        },
        site_breakdown=site_breakdowns,
        bop_breakdown=bop_breakdowns,
        incident_statistics={
            "total_incidents": total_incidents,
            "active_investigations": db.query(Incident).filter(Incident.status == "ACTIVE").count()
        },
        health_metrics={
            "average_health_score": round(sum(s["health"] for s in site_breakdowns) / len(site_breakdowns), 1) if site_breakdowns else 100.0
        }
    )
