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
from app.core.security import get_password_hash

router = APIRouter(prefix="/users", tags=["Officer Management"])

# Pydantic Schemas
class OfficerCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[str] = None
    password: str = Field(..., min_length=6, max_length=100)
    role: str = Field("OFFICER", description="ADMIN, COMMANDER, OFFICER, BOP_OPERATOR, OPERATOR")
    post_scope_id: str = Field("BOP-ALPHA", description="Assigned BOP or Site ID")
    post_scope_type: str = Field("BOP", description="BOP, SITE, or GLOBAL")
    full_name: Optional[str] = None

class OfficerUpdateRequest(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    post_scope_id: Optional[str] = None
    post_scope_type: Optional[str] = None

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
    scope_role: str = "BOP_OPERATOR"
    assigned_by: Optional[str] = "admin"

    class Config:
        from_attributes = True

@router.get("", response_model=List[OfficerResponse])
def list_officers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all officers and personnel with their assigned duty posts (BOP/Site) and status.
    """
    users = db.query(User).order_by(User.id.asc()).all()
    
    # Preload BOP and Site friendly names
    bop_map = {b.bop_id: b.name for b in db.query(BOP).all()}
    site_map = {s.site_id: s.name for s in db.query(Site).all()}
    
    result = []
    for u in users:
        scope = db.query(SiteUserScope).filter(SiteUserScope.username == u.username).first()
        stype = scope.scope_type if scope else ("GLOBAL" if u.role in ["admin", "SUPER_ADMIN"] else "BOP")
        sid = scope.scope_id if scope else ("*" if u.role in ["admin", "SUPER_ADMIN"] else "BOP-ALPHA")
        srole = scope.role if scope else u.role
        assigned_by = scope.assigned_by if scope else "system"

        # Friendly post name
        if sid in bop_map:
            post_name = bop_map[sid]
        elif sid in site_map:
            post_name = site_map[sid]
        elif sid == "*":
            post_name = "All National Sectors (HQ Central)"
        else:
            post_name = sid

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
    Register a new Duty Officer, set their password, and assign to a Border Outpost / Post (Admin only).
    """
    uname = req.username.strip().lower()
    existing_user = db.query(User).filter(User.username == uname).first()
    if existing_user:
        raise HTTPException(status_code=400, detail=f"Username '{uname}' is already registered.")

    email = req.email.strip() if req.email else f"{uname}@ibvap.mil"
    existing_email = db.query(User).filter(User.email == email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail=f"Email '{email}' is already in use.")

    # 1. Create User with hashed password
    hashed_pwd = get_password_hash(req.password)
    user = User(
        username=uname,
        email=email,
        hashed_password=hashed_pwd,
        role=req.role.strip().upper(),
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 2. Assign Duty Post / BOP Scope
    scope_type = req.post_scope_type.strip().upper()
    scope_id = req.post_scope_id.strip()
    scope = SiteUserScope(
        username=uname,
        scope_type=scope_type,
        scope_id=scope_id,
        role=req.role.strip().upper(),
        assigned_by=current_user.username,
        created_at=datetime.utcnow()
    )
    db.add(scope)

    # 3. Security Audit Log
    db.add(SecurityAuditLog(
        username=current_user.username,
        action="OFFICER_REGISTERED",
        resource_type="USER",
        resource_id=uname,
        details=f'{{"username": "{uname}", "role": "{req.role}", "assigned_post": "{scope_id}"}}'
    ))
    db.commit()

    # Friendly post name
    bop = db.query(BOP).filter(BOP.bop_id == scope_id).first()
    site = db.query(Site).filter(Site.site_id == scope_id).first()
    post_name = bop.name if bop else (site.name if site else scope_id)

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
        scope_role=scope.role,
        assigned_by=current_user.username
    )

@router.put("/{user_id}", response_model=OfficerResponse)
def update_officer(
    user_id: int,
    req: OfficerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Update officer rank, role, active status, or reassign duty post / BOP (Admin only).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Officer not found.")

    if req.email is not None:
        user.email = req.email.strip()
    if req.role is not None:
        user.role = req.role.strip().upper()
    if req.is_active is not None:
        user.is_active = req.is_active

    user.updated_at = datetime.utcnow()

    # Update or create post scope
    scope = db.query(SiteUserScope).filter(SiteUserScope.username == user.username).first()
    if req.post_scope_id is not None:
        if not scope:
            scope = SiteUserScope(
                username=user.username,
                scope_type=req.post_scope_type or "BOP",
                scope_id=req.post_scope_id.strip(),
                role=user.role,
                assigned_by=current_user.username
            )
            db.add(scope)
        else:
            scope.scope_id = req.post_scope_id.strip()
            if req.post_scope_type:
                scope.scope_type = req.post_scope_type.strip().upper()
            scope.role = user.role
            scope.assigned_by = current_user.username
            scope.updated_at = datetime.utcnow()

    db.add(SecurityAuditLog(
        username=current_user.username,
        action="OFFICER_UPDATED",
        resource_type="USER",
        resource_id=user.username,
        details=f'{{"user_id": {user_id}, "role": "{user.role}", "active": {user.is_active}}}'
    ))
    db.commit()
    db.refresh(user)

    sid = scope.scope_id if scope else "BOP-ALPHA"
    stype = scope.scope_type if scope else "BOP"
    srole = scope.role if scope else user.role

    bop = db.query(BOP).filter(BOP.bop_id == sid).first()
    site = db.query(Site).filter(Site.site_id == sid).first()
    post_name = bop.name if bop else (site.name if site else sid)

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
