from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.federation_models import BOP, Site
from app.models.camera import Camera
from app.models.incident import Incident
from app.models.alert import Alert
from app.models.edge_node import EdgeNode
from app.models.zone import SecurityZone
from app.schemas.federation_schemas import (
    BOPCreate,
    BOPUpdate,
    BOPResponse,
    BOPOverviewResponse
)
from app.services.federation.scope_service import ScopeService
from app.services.federation.federation_service import FederationService
from app.models.audit_log import SecurityAuditLog

router = APIRouter(prefix="/bops", tags=["BOP Management (Phase 12)"])

@router.get("", response_model=List[BOPResponse])
def list_bops(
    site_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists accessible BOPs respecting user scope and optional site filter."""
    query = db.query(BOP)
    if site_id:
        query = query.filter(BOP.site_id == site_id)
    if status:
        query = query.filter(BOP.status == status)

    auth_bops = ScopeService.get_authorized_bop_identifiers(current_user, db)
    if auth_bops is not None:
        query = query.filter((BOP.bop_id.in_(auth_bops)) | (BOP.name.in_(auth_bops)))

    return query.order_by(BOP.name.asc()).all()

@router.post("", response_model=BOPResponse, status_code=status.HTTP_201_CREATED)
def create_bop(
    payload: BOPCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Creates a new Border Outpost (BOP) under a Site (Admin only)."""
    # Verify site exists
    site = db.query(Site).filter(Site.site_id == payload.site_id).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parent Site '{payload.site_id}' does not exist."
        )

    existing = db.query(BOP).filter(
        (BOP.bop_id == payload.bop_id) | (BOP.name == payload.name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"BOP with ID '{payload.bop_id}' or Name '{payload.name}' already exists."
        )

    bop = BOP(
        bop_id=payload.bop_id.strip(),
        site_id=payload.site_id.strip(),
        name=payload.name.strip(),
        code=payload.code.strip().upper(),
        description=payload.description,
        location=payload.location,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status=payload.status,
        operational_priority=payload.operational_priority
    )
    db.add(bop)
    db.commit()
    db.refresh(bop)

    db.add(SecurityAuditLog(
        action="BOP_CREATED",
        username=current_user.username,
        resource_type="BOP",
        resource_id=bop.bop_id,
        details=f"Created BOP '{bop.bop_id}' ({bop.name}) under site '{bop.site_id}'"
    ))
    db.commit()
    return bop

@router.get("/{bop_id}", response_model=BOPResponse)
def get_bop_details(
    bop_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves BOP metadata, enforcing scope authorization."""
    ScopeService.require_bop_access(current_user, bop_id, db)
    bop = db.query(BOP).filter((BOP.bop_id == bop_id) | (BOP.name == bop_id)).first()
    if not bop:
        raise HTTPException(status_code=404, detail=f"BOP '{bop_id}' not found.")
    return bop

@router.put("/{bop_id}", response_model=BOPResponse)
def update_bop(
    bop_id: str,
    payload: BOPUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Updates BOP metadata (Admin only)."""
    bop = db.query(BOP).filter((BOP.bop_id == bop_id) | (BOP.name == bop_id)).first()
    if not bop:
        raise HTTPException(status_code=404, detail=f"BOP '{bop_id}' not found.")

    if payload.name is not None:
        bop.name = payload.name.strip()
    if payload.code is not None:
        bop.code = payload.code.strip().upper()
    if payload.description is not None:
        bop.description = payload.description
    if payload.location is not None:
        bop.location = payload.location
    if payload.latitude is not None:
        bop.latitude = payload.latitude
    if payload.longitude is not None:
        bop.longitude = payload.longitude
    if payload.status is not None:
        bop.status = payload.status
    if payload.operational_priority is not None:
        bop.operational_priority = payload.operational_priority

    db.commit()
    db.refresh(bop)

    db.add(SecurityAuditLog(
        action="BOP_UPDATED",
        username=current_user.username,
        resource_type="BOP",
        resource_id=bop.bop_id,
        details=f"Updated BOP '{bop.bop_id}'"
    ))
    db.commit()
    return bop

@router.delete("/{bop_id}")
def delete_bop(
    bop_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Permanently deletes a BOP (Admin only)."""
    bop = db.query(BOP).filter((BOP.bop_id == bop_id) | (BOP.name == bop_id)).first()
    if not bop:
        raise HTTPException(status_code=404, detail=f"BOP '{bop_id}' not found.")

    actual_id = bop.bop_id
    db.delete(bop)
    db.add(SecurityAuditLog(
        action="BOP_DELETED",
        username=current_user.username,
        resource_type="BOP",
        resource_id=actual_id,
        details=f"Deleted BOP '{actual_id}'"
    ))
    db.commit()
    return {"message": f"BOP '{actual_id}' deleted successfully.", "status": "DELETED"}

@router.get("/{bop_id}/overview", response_model=BOPOverviewResponse)
def get_bop_overview(
    bop_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Section 8: When operator opens a BOP, show:
    Cameras, Edge Nodes, Zones, Active Incidents, Alerts, Current Risk,
    Forecast, System Health, Recent Events.
    """
    ScopeService.require_bop_access(current_user, bop_id, db)
    bop = db.query(BOP).filter((BOP.bop_id == bop_id) | (BOP.name == bop_id)).first()
    if not bop:
        raise HTTPException(status_code=404, detail=f"BOP '{bop_id}' not found.")

    bop_name = bop.name
    bh = FederationService.get_bop_health(bop.bop_id, db)
    br = FederationService.get_bop_risk(bop.bop_id, db)

    edges_count = db.query(EdgeNode).filter(
        (EdgeNode.bop_site == bop_name) | (EdgeNode.bop_id == bop.bop_id)
    ).count()

    cams = db.query(Camera).filter(
        (Camera.bop_site == bop_name) | (Camera.bop_id == bop.bop_id)
    ).all()
    cam_ids = [c.camera_id for c in cams]

    zones_count = db.query(SecurityZone).filter(SecurityZone.camera_id.in_(cam_ids)).count() if cam_ids else 0

    active_incidents = db.query(Incident).filter(
        (Incident.bop_site == bop_name) | (Incident.bop_id == bop.bop_id),
        Incident.status.in_(["ACTIVE", "UNDER_INVESTIGATION", "ESCALATED"])
    ).count()

    critical_alerts = db.query(Alert).filter(
        Alert.bop_site == bop_name,
        Alert.priority == "CRITICAL",
        Alert.status.in_(["NEW", "ACKNOWLEDGED", "ESCALATED"])
    ).count()

    forecast = "NORMAL" if br < 40 else ("ELEVATED" if br < 70 else "HIGH")

    return BOPOverviewResponse(
        bop_id=bop.bop_id,
        site_id=bop.site_id,
        name=bop.name,
        code=bop.code,
        status=bop.status,
        operational_priority=bop.operational_priority,
        total_cameras=bh["total_cameras"],
        online_cameras=bh["online_cameras"],
        offline_cameras=bh["offline_cameras"],
        edge_nodes_count=edges_count,
        zones_count=zones_count,
        active_incidents=active_incidents,
        critical_alerts=critical_alerts,
        current_risk=br,
        forecast=forecast,
        system_health=bh["health_score"],
        system_health_status=bh["health_status"],
        recent_events_count=active_incidents + critical_alerts
    )

@router.get("/{bop_id}/cameras")
def get_bop_cameras(
    bop_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Section 35: BOP camera grid.
    Returns cameras for selected BOP with status, FPS, health, current event, risk.
    """
    ScopeService.require_bop_access(current_user, bop_id, db)
    bop = db.query(BOP).filter((BOP.bop_id == bop_id) | (BOP.name == bop_id)).first()
    if not bop:
        raise HTTPException(status_code=404, detail=f"BOP '{bop_id}' not found.")

    query = db.query(Camera).filter(
        (Camera.bop_site == bop.name) | (Camera.bop_id == bop.bop_id)
    )
    query = ScopeService.filter_query_by_scope(query, Camera, current_user, db)
    cameras = query.all()

    # Format camera wall card data
    wall = []
    for c in cameras:
        # Check active incident on this camera
        active_inc = db.query(Incident).filter(
            Incident.camera_id == c.camera_id,
            Incident.status.in_(["ACTIVE", "UNDER_INVESTIGATION", "ESCALATED"])
        ).first()

        wall.append({
            "camera_id": c.camera_id,
            "camera_name": c.camera_name,
            "status": c.status,
            "fps": c.fps,
            "expected_fps": c.expected_fps,
            "priority": c.priority,
            "image_quality_score": c.image_quality_score,
            "is_maintenance": c.is_maintenance,
            "current_event": active_inc.title if active_inc else "NORMAL_SURVEILLANCE",
            "current_incident_id": active_inc.incident_id if active_inc else None,
            "risk_score": active_inc.risk_score if active_inc else 15,
            "last_seen_at": c.last_seen_at.isoformat() if c.last_seen_at else None
        })
    return wall

@router.get("/{bop_id}/incidents")
def get_bop_incidents(
    bop_id: str,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves incidents scoped to this BOP."""
    ScopeService.require_bop_access(current_user, bop_id, db)
    bop = db.query(BOP).filter((BOP.bop_id == bop_id) | (BOP.name == bop_id)).first()
    if not bop:
        raise HTTPException(status_code=404, detail=f"BOP '{bop_id}' not found.")

    query = db.query(Incident).filter(
        (Incident.bop_site == bop.name) | (Incident.bop_id == bop.bop_id)
    )
    if status:
        query = query.filter(Incident.status == status)
    query = ScopeService.filter_query_by_scope(query, Incident, current_user, db)
    return query.order_by(Incident.created_at.desc()).all()

@router.delete("/{bop_id}", status_code=status.HTTP_200_OK)
def delete_bop(
    bop_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Deletes a Border Outpost (BOP) and updates associated scopes/cameras (Admin only)."""
    bop = db.query(BOP).filter((BOP.bop_id == bop_id) | (BOP.name == bop_id)).first()
    if not bop:
        raise HTTPException(status_code=404, detail=f"BOP '{bop_id}' not found.")

    bid = bop.bop_id
    bop_name = bop.name

    # Clean user scopes
    from app.models.federation_models import SiteUserScope
    db.query(SiteUserScope).filter(
        (SiteUserScope.scope_type == "BOP") & (SiteUserScope.scope_id == bid)
    ).delete(synchronize_session=False)

    db.delete(bop)

    audit = SecurityAuditLog(
        username=current_user.username,
        action="BOP_DELETED",
        resource_type="BOP",
        resource_id=bid,
        details=f'{{"bop_id": "{bid}", "name": "{bop_name}"}}'
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"BOP '{bop_name}' ({bid}) successfully deleted."}

