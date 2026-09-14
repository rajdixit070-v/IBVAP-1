from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.federation_models import SiteUserScope, BOP, Site
from app.models.audit_log import SecurityAuditLog
from app.models.enterprise_security_models import SecurityAuditLogEntry
from app.core.security import get_password_hash

router = APIRouter(prefix="/users", tags=["Officer Management"])

# Pydantic Schemas
class OfficerCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[str] = None
    password: str = Field(..., min_length=4, max_length=100)
    role: str = Field("COMMANDER", description="ADMIN or COMMANDER only")
    post_scope_id: Optional[str] = Field("BOP-WAGAH", description="Assigned BOP or Site ID")
    post_scope_type: Optional[str] = Field("BOP", description="BOP, SITE, or GLOBAL")
    post_name: Optional[str] = Field(None, description="Friendly Name of the Checkpost")
    full_name: Optional[str] = None
    sector: Optional[str] = Field(None, description="Frontier Sector e.g. Punjab Frontier, Rajasthan Frontier, etc.")
    latitude: Optional[float] = Field(None, description="GPS Latitude coordinate")
    longitude: Optional[float] = Field(None, description="GPS Longitude coordinate")
    operational_priority: Optional[str] = Field("NORMAL", description="NORMAL, HIGH, or CRITICAL")

class OfficerUpdateRequest(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    post_scope_id: Optional[str] = None
    post_scope_type: Optional[str] = None
    sector: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=100)

class OfficerResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    locked_until: Optional[datetime] = None
    failed_login_attempts: int = 0
    # Scoped Assignment
    scope_type: str = "BOP"
    scope_id: str = "BOP-ALPHA"
    post_name: str = "BOP Alpha"
    sector: Optional[str] = "Punjab Frontier"
    scope_role: str = "BOP_OPERATOR"
    assigned_by: Optional[str] = "admin"

SECTOR_DEFAULT_COORDS: Dict[str, tuple[float, float]] = {
    "SITE-PUNJAB": (31.6048, 74.5731),
    "SITE-RAJASTHAN": (27.5255, 70.1558),
    "SITE-JAMMU": (32.6105, 74.6980),
    "SITE-LADAKH": (34.7578, 78.2241),
    "SITE-GUJARAT": (23.8560, 68.6740),
    "SITE-EASTERN": (25.1873, 92.0197),
    "SITE-CENTRAL": (28.6139, 77.2090),
}

def resolve_sector_and_site(sector_input: Optional[str], bop_id: str) -> tuple[str, str]:
    if sector_input and sector_input.strip():
        user_sec = sector_input.strip()
        sec_lower = user_sec.lower()
        
        # Canonical standard matches
        if sec_lower in ["punjab frontier", "punjab"]:
            return ("SITE-PUNJAB", "Punjab Frontier")
        elif sec_lower in ["rajasthan frontier", "rajasthan"]:
            return ("SITE-RAJASTHAN", "Rajasthan Frontier")
        elif sec_lower in ["jammu & kashmir", "jammu and kashmir", "jammu", "kashmir"]:
            return ("SITE-JAMMU", "Jammu & Kashmir")
        elif sec_lower in ["ladakh sector", "ladakh"]:
            return ("SITE-LADAKH", "Ladakh Sector")
        elif sec_lower in ["gujarat / kutch", "gujarat", "kutch"]:
            return ("SITE-GUJARAT", "Gujarat / Kutch")
        elif sec_lower in ["eastern frontier", "eastern"]:
            return ("SITE-EASTERN", "Eastern Frontier")
        elif sec_lower in ["all frontiers (national hq)", "central hq", "national hq"]:
            return ("SITE-CENTRAL", "All Frontiers (National HQ)")
            
        # Custom sector: preserve exact user string and assign parent site
        if any(k in sec_lower for k in ["punjab", "wagah", "attari", "hussaini", "fazilka", "khemkaran", "dbn", "gurdaspur"]):
            return ("SITE-PUNJAB", user_sec)
        elif any(k in sec_lower for k in ["rajasthan", "jaisalmer", "longewala", "tanot", "munabao", "barmer", "bikaner", "ramgarh", "thar"]):
            return ("SITE-RAJASTHAN", user_sec)
        elif any(k in sec_lower for k in ["jammu", "kashmir", "rs pura", "suchetgarh", "samba", "hiranagar", "akhnoor", "poonch", "uri", "baramulla", "kupwara", "loc"]):
            return ("SITE-JAMMU", user_sec)
        elif any(k in sec_lower for k in ["ladakh", "dbo", "galwan", "pangong", "chushul", "nyoma", "demchok", "kargil", "leh", "lac"]):
            return ("SITE-LADAKH", user_sec)
        elif any(k in sec_lower for k in ["gujarat", "kutch", "harami", "sir creek", "khavda", "lakhpat", "creek"]):
            return ("SITE-GUJARAT", user_sec)
        elif any(k in sec_lower for k in ["east", "bengal", "assam", "meghalaya", "tripura", "mizoram", "sikkim", "arunachal", "nagaland", "manipur", "petrapole", "dawki", "hili", "moreh"]):
            return ("SITE-EASTERN", user_sec)
        elif any(k in sec_lower for k in ["delhi", "hq", "central", "*"]):
            return ("SITE-CENTRAL", user_sec)
        else:
            import re
            clean_code = re.sub(r'[^A-Z0-9]', '', user_sec.upper())[:24] or "FRONTIER"
            return (f"SITE-{clean_code}", user_sec)

    # Inferred fallback from bop_id
    bop_raw = (bop_id or "").lower()
    if any(k in bop_raw for k in ["punjab", "wagah", "attari", "hussaini", "fazilka", "khemkaran", "dbn"]):
        return ("SITE-PUNJAB", "Punjab Frontier")
    elif any(k in bop_raw for k in ["rajasthan", "jaisalmer", "longewala", "tanot", "munabao", "barmer", "bikaner", "ramgarh", "thar"]):
        return ("SITE-RAJASTHAN", "Rajasthan Frontier")
    elif any(k in bop_raw for k in ["jammu", "kashmir", "rs pura", "suchetgarh", "samba", "hiranagar", "akhnoor", "poonch", "uri"]):
        return ("SITE-JAMMU", "Jammu & Kashmir")
    elif any(k in bop_raw for k in ["ladakh", "dbo", "galwan", "pangong", "chushul", "nyoma", "demchok"]):
        return ("SITE-LADAKH", "Ladakh Sector")
    elif any(k in bop_raw for k in ["gujarat", "kutch", "harami", "sir creek", "khavda", "lakhpat"]):
        return ("SITE-GUJARAT", "Gujarat / Kutch")
    elif any(k in bop_raw for k in ["east", "bengal", "assam", "meghalaya", "petrapole", "dawki", "hili", "moreh"]):
        return ("SITE-EASTERN", "Eastern Frontier")
    elif any(k in bop_raw for k in ["delhi", "hq", "central", "*"]):
        return ("SITE-CENTRAL", "All Frontiers (National HQ)")
    
    return ("SITE-PUNJAB", "Punjab Frontier")

@router.get("", response_model=List[OfficerResponse])
def list_officers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all officers and personnel with their assigned duty posts (BOP/Site), sectors, and status.
    """
    users = db.query(User).order_by(User.id.asc()).all()
    
    # Preload BOP and Site friendly names & sectors
    bops = db.query(BOP).all()
    sites = db.query(Site).all()
    bop_map = {b.bop_id: (b.name, b.location or "Punjab Frontier") for b in bops}
    site_map = {s.site_id: (s.name, s.location or "Frontier Sector") for s in sites}
    
    result = []
    for u in users:
        scope = db.query(SiteUserScope).filter(SiteUserScope.username == u.username).first()
        stype = scope.scope_type if scope else ("GLOBAL" if u.role in ["admin", "SUPER_ADMIN"] else "BOP")
        sid = scope.scope_id if scope else ("*" if u.role in ["admin", "SUPER_ADMIN"] else "BOP-ALPHA")
        srole = scope.role if scope else u.role
        assigned_by = scope.assigned_by if scope else "system"

        # Friendly post name & sector
        if sid in bop_map:
            post_name, sector = bop_map[sid]
        elif sid in site_map:
            post_name, sector = site_map[sid]
        elif sid in ["*", "HQ-DELHI", "HQ-CENTRAL", "GLOBAL"]:
            post_name = "Delhi Central HQ (National Command Central)"
            sector = "All Frontiers (National HQ)"
        else:
            post_name = sid
            _, sector = resolve_sector_and_site(None, sid)

        result.append(OfficerResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at or datetime.utcnow(),
            last_login_at=u.last_login_at,
            locked_until=u.locked_until,
            failed_login_attempts=u.failed_login_attempts or 0,
            scope_type=stype,
            scope_id=sid,
            post_name=post_name,
            sector=sector,
            scope_role=srole,
            assigned_by=assigned_by
        ))

    return result

@router.post("", response_model=OfficerResponse, status_code=status.HTTP_201_CREATED)
def register_officer(
    req: OfficerCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Register a new Duty Officer, set their password, and assign to a Border Outpost / Post and Frontier Sector (Admin only).
    """
    uname = req.username.strip().lower()
    if not uname:
        raise HTTPException(status_code=400, detail="Username is required.")

    # Email handling: ensure no clash blocks registration
    base_email = req.email.strip().lower() if req.email and req.email.strip() else f"{uname}@ibvap.mil"
    existing_user_email = db.query(User).filter(User.email == base_email, User.username != uname).first()
    if existing_user_email:
        base_email = f"{uname}.{int(datetime.utcnow().timestamp()) % 10000}@ibvap.mil"

    # Role and scope normalization - strictly COMMANDER or ADMIN
    role_raw = (req.role or "COMMANDER").strip().upper()
    scope_id = (req.post_scope_id or "").strip()
    if role_raw in ("ADMIN", "SUPER_ADMIN", "SUPERADMIN"):
        role_upper = "ADMIN"
        user_db_role = "admin"
        scope_type = "GLOBAL"
        if not scope_id or scope_id in ["BOP-WAGAH", "BOP-ALPHA"]:
            scope_id = "*"
        target_site_id = "SITE-CENTRAL"
        target_sector = "All Frontiers (National HQ)"
        scope_role = "SUPER_ADMIN"
    else:
        role_upper = "COMMANDER"
        user_db_role = "COMMANDER"
        scope_type = "BOP"
        if not scope_id or scope_id in ["*", "HQ-DELHI", "HQ-CENTRAL"]:
            scope_id = "BOP-WAGAH"
        target_site_id, target_sector = resolve_sector_and_site(req.sector, scope_id)
        scope_role = "BOP_COMMANDER"

    # Auto-provision Site (Frontier Sector) and BOP if not existing
    if scope_type == "BOP" and scope_id not in ["*", "HQ-DELHI", "HQ-CENTRAL", "GLOBAL"]:
        site_exist = db.query(Site).filter(Site.site_id == target_site_id).first()
        if not site_exist:
            clean_code = target_site_id.replace("SITE-", "")[:16].upper() or "FRONTIER"
            def_lat, def_lng = SECTOR_DEFAULT_COORDS.get(target_site_id, (28.6139, 77.2090))
            new_site = Site(
                site_id=target_site_id,
                region_id="REG-INDIA-BORDER",
                name=target_sector,
                code=clean_code,
                description=f"Operational Frontier Sector: {target_sector}",
                location=target_sector,
                latitude=def_lat,
                longitude=def_lng,
                timezone="Asia/Kolkata",
                status="ACTIVE"
            )
            db.add(new_site)
            db.commit()
        else:
            if target_sector and site_exist.name != target_sector:
                site_exist.name = target_sector
                site_exist.location = target_sector
                db.commit()

        bop_exist = db.query(BOP).filter(BOP.bop_id == scope_id).first()
        raw_bop_name = (req.post_name or "").strip()
        clean_name = raw_bop_name or scope_id.replace("BOP-", "").replace("-", " ").title()
        prio = (req.operational_priority or "NORMAL").upper()
        if prio not in ["NORMAL", "HIGH", "CRITICAL"]:
            prio = "NORMAL"

        if not bop_exist:
            def_lat, def_lng = SECTOR_DEFAULT_COORDS.get(target_site_id, (31.6048, 74.5731))
            final_lat = req.latitude if req.latitude is not None else def_lat
            final_lng = req.longitude if req.longitude is not None else def_lng
            final_name = clean_name if clean_name.upper().startswith("BOP") else f"BOP {clean_name}"
            new_bop = BOP(
                bop_id=scope_id,
                site_id=target_site_id,
                name=final_name,
                code=scope_id.replace("BOP-", "")[:8].upper() or "BOP",
                location=target_sector,
                latitude=final_lat,
                longitude=final_lng,
                status="ACTIVE",
                operational_priority=prio
            )
            db.add(new_bop)
            db.commit()
        else:
            if req.latitude is not None:
                bop_exist.latitude = req.latitude
            if req.longitude is not None:
                bop_exist.longitude = req.longitude
            if req.operational_priority:
                bop_exist.operational_priority = prio
            if req.sector:
                bop_exist.location = target_sector
                bop_exist.site_id = target_site_id
            db.commit()

    # 1. Create or Update User (idempotent so duplicate click updates password/post gracefully)
    hashed_pwd = get_password_hash(req.password)
    existing_user = db.query(User).filter(User.username == uname).first()
    if existing_user:
        existing_user.hashed_password = hashed_pwd
        existing_user.role = user_db_role
        existing_user.is_active = True
        existing_user.updated_at = datetime.utcnow()
        user = existing_user
    else:
        user = User(
            username=uname,
            email=base_email,
            hashed_password=hashed_pwd,
            role=user_db_role,
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.add(user)
    db.commit()
    db.refresh(user)

    # 2. Assign Duty Post / BOP Scope (upsert)
    scope = db.query(SiteUserScope).filter(SiteUserScope.username == uname).first()
    assigned_by = current_user.username if current_user else "admin"
    if scope:
        scope.scope_type = scope_type
        scope.scope_id = scope_id
        scope.role = scope_role
        scope.assigned_by = assigned_by
        scope.updated_at = datetime.utcnow()
    else:
        scope = SiteUserScope(
            username=uname,
            scope_type=scope_type,
            scope_id=scope_id,
            role=scope_role,
            assigned_by=assigned_by,
            created_at=datetime.utcnow()
        )
        db.add(scope)
    db.commit()

    # 3. Dual Security Audit Logs (Core and Enterprise)
    try:
        db.add(SecurityAuditLog(
            username=assigned_by,
            action="OFFICER_REGISTERED",
            resource_type="USER",
            resource_id=uname,
            details=f'{{"username": "{uname}", "role": "{role_upper}", "assigned_post": "{scope_id}", "sector": "{target_sector}"}}'
        ))
        db.add(SecurityAuditLogEntry(
            audit_id=f"AUD-{int(datetime.utcnow().timestamp()*1000)}",
            actor_username=assigned_by,
            action_type="OFFICER_APPOINTED",
            resource_type="PERSONNEL",
            resource_id=uname,
            ip_address="127.0.0.1",
            status="SUCCESS",
            new_value_json=f'{{"username": "{uname}", "role": "{role_upper}", "assigned_post": "{scope_id}", "sector": "{target_sector}"}}'
        ))
        db.commit()
    except Exception:
        # Prevent secondary audit logging exception from failing the primary officer registration
        pass

    # Friendly post name and sector
    bop = db.query(BOP).filter(BOP.bop_id == scope_id).first()
    site = db.query(Site).filter(Site.site_id == scope_id).first()
    post_name = bop.name if bop else (site.name if site else ("Delhi Central HQ (National Command Central)" if scope_id in ["*", "HQ-DELHI", "HQ-CENTRAL", "GLOBAL"] else scope_id))
    final_sector = bop.location if bop and bop.location else (site.location if site and site.location else target_sector)

    return OfficerResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login_at=None,
        locked_until=None,
        failed_login_attempts=0,
        scope_type=scope.scope_type,
        scope_id=scope.scope_id,
        post_name=post_name,
        sector=final_sector,
        scope_role=scope.role,
        assigned_by=assigned_by
    )

@router.put("/{user_id}", response_model=OfficerResponse)
def update_officer(
    user_id: int,
    req: OfficerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Update officer rank, role, active status, or reassign duty post / BOP / Sector (Admin only).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Officer not found.")

    if req.email is not None:
        user.email = req.email.strip()
    if req.role is not None:
        role_clean = req.role.strip().upper()
        if role_clean in ("ADMIN", "SUPER_ADMIN", "SUPERADMIN"):
            user.role = "admin"
        else:
            user.role = "COMMANDER"
    if req.is_active is not None:
        user.is_active = req.is_active

    user.updated_at = datetime.utcnow()

    # Update or create post scope
    scope = db.query(SiteUserScope).filter(SiteUserScope.username == user.username).first()
    is_admin_user = (user.role or "").lower() == "admin" or (user.role or "").upper() in ("ADMIN", "SUPER_ADMIN")
    target_scope_role = "SUPER_ADMIN" if is_admin_user else "BOP_COMMANDER"
    target_scope_type = "GLOBAL" if is_admin_user else "BOP"

    if req.post_scope_id is not None or req.role is not None:
        sid_clean = "*" if is_admin_user else (req.post_scope_id.strip() if req.post_scope_id else "BOP-WAGAH")
        stype_clean = target_scope_type
        if not scope:
            scope = SiteUserScope(
                username=user.username,
                scope_type=stype_clean,
                scope_id=sid_clean,
                role=target_scope_role,
                assigned_by=current_user.username
            )
            db.add(scope)
        else:
            scope.scope_id = sid_clean
            scope.scope_type = stype_clean
            scope.role = target_scope_role
            scope.assigned_by = current_user.username
            scope.updated_at = datetime.utcnow()

    # Update BOP sector if provided
    sid = scope.scope_id if scope else (req.post_scope_id or "BOP-WAGAH")
    bop = db.query(BOP).filter(BOP.bop_id == sid).first()
    target_site_id, target_sector = resolve_sector_and_site(req.sector, sid)
    if bop and req.sector:
        bop.location = target_sector
        bop.site_id = target_site_id
        db.commit()
    elif not bop and sid not in ["*", "HQ-DELHI", "HQ-CENTRAL", "GLOBAL"]:
        clean_name = sid.replace("BOP-", "").replace("-", " ").title()
        def_lat, def_lng = SECTOR_DEFAULT_COORDS.get(target_site_id, (31.6048, 74.5731))
        bop = BOP(
            bop_id=sid,
            site_id=target_site_id,
            name=f"BOP {clean_name}" if not clean_name.startswith("Bop") else clean_name,
            code=sid.replace("BOP-", "")[:8].upper() or "BOP",
            location=target_sector,
            latitude=def_lat,
            longitude=def_lng,
            status="ACTIVE",
            operational_priority="NORMAL"
        )
        db.add(bop)
        db.commit()

    db.add(SecurityAuditLog(
        username=current_user.username,
        action="OFFICER_UPDATED",
        resource_type="USER",
        resource_id=user.username,
        details=f'{{"user_id": {user_id}, "role": "{user.role}", "active": {user.is_active}, "post": "{sid}", "sector": "{target_sector}"}}'
    ))
    db.commit()
    db.refresh(user)

    stype = scope.scope_type if scope else "BOP"
    srole = scope.role if scope else user.role

    site = db.query(Site).filter(Site.site_id == sid).first()
    post_name = bop.name if bop else (site.name if site else ("Delhi Central HQ (National Command Central)" if sid in ["*", "HQ-DELHI", "HQ-CENTRAL", "GLOBAL"] else sid))
    final_sector = bop.location if bop and bop.location else (site.location if site and site.location else target_sector)

    return OfficerResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        locked_until=user.locked_until,
        failed_login_attempts=user.failed_login_attempts or 0,
        scope_type=stype,
        scope_id=sid,
        post_name=post_name,
        sector=final_sector,
        scope_role=srole,
        assigned_by=scope.assigned_by if scope else current_user.username
    )

@router.post("/{user_id}/reset-password")
def reset_officer_password(
    user_id: int,
    req: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Set or reset password for an officer, unlock account, and update security credentials (Admin only).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Officer not found.")

    user.hashed_password = get_password_hash(req.new_password)
    user.last_password_change = datetime.utcnow()
    user.locked_until = None
    user.failed_login_attempts = 0
    user.updated_at = datetime.utcnow()

    db.add(SecurityAuditLog(
        username=current_user.username,
        action="OFFICER_PASSWORD_RESET",
        resource_type="USER",
        resource_id=user.username,
        details=f"Admin '{current_user.username}' reset password for officer '{user.username}'"
    ))
    db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Password successfully reset for officer '{user.username}'. Account is unlocked and active.",
        "username": user.username
    }

@router.delete("/{user_id}")
def delete_officer(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Decommission and remove an officer account (Admin only).
    Prevents deleting own account or the master admin.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Officer not found.")

    if user.username.lower() == "admin" or user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete master administrator account or current active session.")

    uname = user.username
    # Remove user scopes
    db.query(SiteUserScope).filter(SiteUserScope.username == uname).delete()
    # Remove user
    db.delete(user)

    db.add(SecurityAuditLog(
        username=current_user.username,
        action="OFFICER_DECOMMISSIONED",
        resource_type="USER",
        resource_id=uname,
        details=f"Admin '{current_user.username}' decommissioned officer '{uname}'"
    ))
    db.commit()

    return {
        "status": "DELETED",
        "message": f"Officer account '{uname}' has been decommissioned.",
        "username": uname
    }
