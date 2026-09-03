import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.camera import Camera
from app.models.zone import SecurityZone
from app.models.audit_log import SecurityAuditLog
from app.schemas.zone import SecurityZoneCreate, SecurityZoneUpdate, SecurityZoneResponse, NormalizedPoint

router = APIRouter(prefix="/zones", tags=["Security Zones & Virtual Fences"])

def serialize_zone(zone: SecurityZone) -> SecurityZoneResponse:
    return SecurityZoneResponse(
        id=zone.id,
        zone_id=zone.zone_id,
        camera_id=zone.camera_id,
        name=zone.name,
        zone_type=zone.zone_type,
        polygon=[NormalizedPoint(**pt) for pt in json.loads(zone.polygon_json)],
        monitored_classes=json.loads(zone.monitored_classes_json or '[]'),
        direction_rule=zone.direction_rule,
        severity=zone.severity,
        enabled=zone.enabled,
        created_at=zone.created_at,
        updated_at=zone.updated_at
    )

@router.get("", response_model=List[SecurityZoneResponse])
@router.get("/", response_model=List[SecurityZoneResponse])
def get_zones(

    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled state"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetches list of virtual security zones with optional camera filtering."""
    query = db.query(SecurityZone)
    if camera_id:
        query = query.filter(SecurityZone.camera_id == camera_id)
    if enabled is not None:
        query = query.filter(SecurityZone.enabled == enabled)
    
    zones = query.all()
    return [serialize_zone(z) for z in zones]

@router.get("/{zone_id}", response_model=SecurityZoneResponse)
def get_zone(
    zone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves a single security zone configuration."""
    zone = db.query(SecurityZone).filter(SecurityZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Security zone not found.")
    return serialize_zone(zone)

@router.post("/", response_model=SecurityZoneResponse, status_code=status.HTTP_201_CREATED)
def create_zone(
    zone_in: SecurityZoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new virtual perimeter zone with normalized polygon coordinates."""
    # Verify camera exists
    camera = db.query(Camera).filter(Camera.camera_id == zone_in.camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera '{zone_in.camera_id}' not found.")

    new_zone_id = f"ZONE-{uuid.uuid4().hex[:8].upper()}"
    
    polygon_data = [{"x": pt.x, "y": pt.y} for pt in zone_in.polygon]

    zone = SecurityZone(
        zone_id=new_zone_id,
        camera_id=zone_in.camera_id,
        name=zone_in.name,
        zone_type=zone_in.zone_type,
        polygon_json=json.dumps(polygon_data),
        monitored_classes_json=json.dumps(zone_in.monitored_classes),
        direction_rule=zone_in.direction_rule,
        severity=zone_in.severity,
        enabled=zone_in.enabled
    )
    db.add(zone)

    # Audit log
    audit = SecurityAuditLog(
        username=current_user.username,
        action="ZONE_CREATED",
        resource_type="ZONE",
        resource_id=new_zone_id,
        details=f"Created {zone_in.zone_type} zone '{zone_in.name}' for {zone_in.camera_id}"
    )
    db.add(audit)

    db.commit()
    db.refresh(zone)
    return serialize_zone(zone)

@router.put("/{zone_id}", response_model=SecurityZoneResponse)
def update_zone(
    zone_id: str,
    zone_in: SecurityZoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates an existing virtual security zone."""
    zone = db.query(SecurityZone).filter(SecurityZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Security zone not found.")

    if zone_in.name is not None:
        zone.name = zone_in.name
    if zone_in.zone_type is not None:
        zone.zone_type = zone_in.zone_type
    if zone_in.polygon is not None:
        polygon_data = [{"x": pt.x, "y": pt.y} for pt in zone_in.polygon]
        zone.polygon_json = json.dumps(polygon_data)
    if zone_in.monitored_classes is not None:
        zone.monitored_classes_json = json.dumps(zone_in.monitored_classes)
    if zone_in.direction_rule is not None:
        zone.direction_rule = zone_in.direction_rule
    if zone_in.severity is not None:
        zone.severity = zone_in.severity
    if zone_in.enabled is not None:
        zone.enabled = zone_in.enabled

    # Audit log
    audit = SecurityAuditLog(
        username=current_user.username,
        action="ZONE_UPDATED",
        resource_type="ZONE",
        resource_id=zone_id,
        details=f"Updated zone '{zone.name}'"
    )
    db.add(audit)

    db.commit()
    db.refresh(zone)
    return serialize_zone(zone)

@router.delete("/{zone_id}")
def delete_zone(
    zone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a virtual security zone."""
    zone = db.query(SecurityZone).filter(SecurityZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Security zone not found.")

    zone_name = zone.name
    db.delete(zone)

    audit = SecurityAuditLog(
        username=current_user.username,
        action="ZONE_DELETED",
        resource_type="ZONE",
        resource_id=zone_id,
        details=f"Deleted zone '{zone_name}'"
    )
    db.add(audit)

    db.commit()
    return {"message": f"Security zone '{zone_name}' successfully removed."}
