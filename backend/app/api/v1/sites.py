from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user, require_admin, require_border_provisioner
from app.models.user import User
from app.models.federation_models import Site, BOP
from app.models.camera import Camera
from app.models.incident import Incident
from app.models.alert import Alert
from app.models.edge_node import EdgeNode
from app.schemas.federation_schemas import (
    SiteCreate,
    SiteUpdate,
    SiteResponse,
    SiteOverviewResponse
)
from app.services.federation.scope_service import ScopeService
from app.services.federation.federation_service import FederationService
from app.models.audit_log import SecurityAuditLog

router = APIRouter(prefix="/sites", tags=["Sites Management (Phase 12)"])

@router.get("", response_model=List[SiteResponse])
def list_sites(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all accessible sites respecting user scope."""
    query = db.query(Site)
    if status:
        query = query.filter(Site.status == status)

    auth_sites = ScopeService.get_authorized_site_ids(current_user, db)
    if auth_sites is not None:
        query = query.filter(Site.site_id.in_(auth_sites))

    return query.order_by(Site.name.asc()).all()

@router.post("", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
def create_site(
    payload: SiteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_border_provisioner)
):
    """Creates a new operational border Site (Border Officers & Commanders)."""
    site_id = (payload.site_id.strip() if payload.site_id else f"SITE-{payload.code.strip().upper()}").replace(" ", "-")
    existing = db.query(Site).filter(Site.site_id == site_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Site with ID '{site_id}' already exists."
        )

    site = Site(
        site_id=site_id,
        region_id=(payload.region_id or "REG-INDIA-BORDER").strip(),
        name=payload.name.strip(),
        code=payload.code.strip().upper(),
        description=payload.description or f"Operational Frontier Sector: {payload.name.strip()}",
        location=payload.location or payload.name.strip(),
        latitude=payload.latitude if payload.latitude is not None else 28.6139,
        longitude=payload.longitude if payload.longitude is not None else 77.2090,
        timezone=payload.timezone or "Asia/Kolkata",
        status=payload.status or "ACTIVE"
    )
    db.add(site)
    db.commit()
    db.refresh(site)

    db.add(SecurityAuditLog(
        action="SITE_CREATED",
        username=current_user.username,
        resource_type="SITE",
        resource_id=site.site_id,
        details=f"Created site '{site.site_id}' ({site.name})"
    ))
    db.commit()
    return site

@router.get("/{site_id}", response_model=SiteResponse)
def get_site_details(
    site_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves metadata for a specific site, enforcing scope authorization."""
    ScopeService.require_site_access(current_user, site_id, db)
    site = db.query(Site).filter(Site.site_id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site '{site_id}' not found.")
    return site

@router.put("/{site_id}", response_model=SiteResponse)
def update_site(
    site_id: str,
    payload: SiteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_border_provisioner)
):
    """Updates site metadata (Border Officers & Commanders)."""
    site = db.query(Site).filter(Site.site_id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site '{site_id}' not found.")

    if payload.name is not None:
        site.name = payload.name.strip()
    if payload.code is not None:
        site.code = payload.code.strip().upper()
    if payload.description is not None:
        site.description = payload.description
    if payload.location is not None:
        site.location = payload.location
    if payload.latitude is not None:
        site.latitude = payload.latitude
    if payload.longitude is not None:
        site.longitude = payload.longitude
    if payload.timezone is not None:
        site.timezone = payload.timezone
    if payload.status is not None:
        site.status = payload.status

    db.commit()
    db.refresh(site)

    db.add(SecurityAuditLog(
        action="SITE_UPDATED",
        username=current_user.username,
        resource_type="SITE",
        resource_id=site.site_id,
        details=f"Updated site '{site.site_id}'"
    ))
    db.commit()
    return site

@router.delete("/{site_id}")
def delete_site(
    site_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_border_provisioner)
):
    """Permanently deletes a site and cascades to its BOPs (Admin only)."""
    site = db.query(Site).filter(Site.site_id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site '{site_id}' not found.")

    # Cascade delete subordinate BOPs
    bops = db.query(BOP).filter(BOP.site_id == site_id).all()
    for b in bops:
        db.delete(b)

    db.delete(site)
    db.add(SecurityAuditLog(
        action="SITE_DELETED",
        username=current_user.username,
        resource_type="SITE",
        resource_id=site_id,
        details=f"Deleted site '{site_id}'"
    ))
    db.commit()
    return {"message": f"Site '{site_id}' deleted successfully.", "status": "DELETED"}

@router.get("/{site_id}/overview", response_model=SiteOverviewResponse)
def get_site_overview(
    site_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Section 7: Returns unified site telemetry:
    Total BOPs, Cameras, Online/Offline, Active Incidents, Critical Alerts,
    Current Risk, Forecast Risk, System Health, Edge Nodes.
    """
    ScopeService.require_site_access(current_user, site_id, db)
    site = db.query(Site).filter(Site.site_id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site '{site_id}' not found.")

    bops = db.query(BOP).filter(BOP.site_id == site_id).all()
    bop_data = []
    total_cams = 0
    online_cams = 0
    offline_cams = 0
    degraded_cams = 0

    for b in bops:
        bh = FederationService.get_bop_health(b.bop_id, db)
        br = FederationService.get_bop_risk(b.bop_id, db)
        bop_data.append({
            "bop_id": b.bop_id,
            "name": b.name,
            "code": b.code,
            "status": b.status,
            "priority": b.operational_priority,
            "total_cameras": bh["total_cameras"],
            "online_cameras": bh["online_cameras"],
            "health_score": bh["health_score"],
            "current_risk": br
        })
        total_cams += bh["total_cameras"]
        online_cams += bh["online_cameras"]
        offline_cams += bh["offline_cameras"]
        degraded_cams += bh["degraded_cameras"]

    # Incidents & Alerts
    bop_names = [b.name for b in bops] + [b.bop_id for b in bops]
    active_incidents = db.query(Incident).filter(
        (Incident.site_id == site_id) | (Incident.bop_site.in_(bop_names)),
        Incident.status.in_(["ACTIVE", "UNDER_INVESTIGATION", "ESCALATED"])
    ).count()

    critical_alerts = db.query(Alert).filter(
        Alert.bop_site.in_(bop_names),
        Alert.priority == "CRITICAL",
        Alert.status.in_(["NEW", "ACKNOWLEDGED", "ESCALATED"])
    ).count()

    edges_count = db.query(EdgeNode).filter(
        (EdgeNode.site_id == site_id) | (EdgeNode.bop_site.in_(bop_names))
    ).count()

    site_health = FederationService.get_site_health(site_id, db)
    site_risk = FederationService.get_site_risk(site_id, db)
    forecast = "MODERATE" if site_risk < 60 else "ELEVATED"

    return SiteOverviewResponse(
        site_id=site.site_id,
        name=site.name,
        code=site.code,
        status=site.status,
        total_bops=len(bops),
        total_cameras=total_cams,
        online_cameras=online_cams,
        offline_cameras=offline_cams,
        degraded_cameras=degraded_cams,
        active_incidents=active_incidents,
        critical_alerts=critical_alerts,
        current_risk=site_risk,
        forecast_risk=forecast,
        system_health=site_health["health_score"],
        system_health_status=site_health["health_status"],
        edge_nodes_count=edges_count,
        recent_events_count=active_incidents + critical_alerts,
        bops=bop_data
    )

@router.get("/{site_id}/cameras")
def get_site_cameras(
    site_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all cameras assigned to this site."""
    ScopeService.require_site_access(current_user, site_id, db)
    bops = db.query(BOP).filter(BOP.site_id == site_id).all()
    bop_names = [b.name for b in bops] + [b.bop_id for b in bops]

    query = db.query(Camera).filter(
        (Camera.site_id == site_id) | (Camera.bop_site.in_(bop_names))
    )
    query = ScopeService.filter_query_by_scope(query, Camera, current_user, db)
    return query.all()

@router.get("/{site_id}/incidents")
def get_site_incidents(
    site_id: str,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves incidents in this site."""
    ScopeService.require_site_access(current_user, site_id, db)
    bops = db.query(BOP).filter(BOP.site_id == site_id).all()
    bop_names = [b.name for b in bops] + [b.bop_id for b in bops]

    query = db.query(Incident).filter(
        (Incident.site_id == site_id) | (Incident.bop_site.in_(bop_names))
    )
    if status:
        query = query.filter(Incident.status == status)
    query = ScopeService.filter_query_by_scope(query, Incident, current_user, db)
    return query.order_by(Incident.created_at.desc()).all()

@router.delete("/{site_id}", status_code=status.HTTP_200_OK)
def delete_site(
    site_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Deletes a Tactical Site and cleans up associated scopes/hierarchy (Admin only)."""
    site = db.query(Site).filter((Site.site_id == site_id) | (Site.name == site_id)).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Site '{site_id}' not found.")

    sid = site.site_id
    site_name = site.name

    # Cascade unassign or delete subordinate BOPs
    bops = db.query(BOP).filter(BOP.site_id == sid).all()
    for b in bops:
        db.delete(b)

    # Clean user scopes
    from app.models.federation_models import SiteUserScope
    db.query(SiteUserScope).filter(
        (SiteUserScope.scope_type == "SITE") & (SiteUserScope.scope_id == sid)
    ).delete(synchronize_session=False)

    db.delete(site)

    audit = SecurityAuditLog(
        username=current_user.username,
        action="SITE_DELETED",
        resource_type="SITE",
        resource_id=sid,
        details=f'{{"site_id": "{sid}", "name": "{site_name}"}}'
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"Site '{site_name}' ({sid}) successfully deleted."}

