from typing import Optional
from datetime import datetime
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.enterprise_security_models import SessionTokenBlacklist, SecurityThreatEvent
from app.models.camera import Camera
from app.schemas.auth import TokenData
from app.services.federation.scope_service import ScopeService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def get_current_user(
    db: Session = Depends(get_db),
    header_token: Optional[str] = Depends(oauth2_scheme),
    query_token: Optional[str] = Query(None, alias="token")
) -> User:
    """Validates JWT access token from Authorization header or query param, checks revocation, and returns active user."""
    token = header_token or query_token
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token or token in ("null", "undefined", "", "None"):
        raise credentials_exception

    # 1. Check if token identifier is blacklisted
    revoked = db.query(SessionTokenBlacklist).filter(
        SessionTokenBlacklist.token_identifier == token
    ).first()
    if revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or logged out. Please log in again."
        )

    # 2. Decode and verify JWT
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role", "admin")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception

    # 3. Retrieve user & check status
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account.")

    # 4. Check account lockout
    if user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account is temporarily locked due to excessive failed attempts until {user.locked_until.strftime('%H:%M:%S UTC')}."
        )

    return user

def get_current_user_optional(
    db: Session = Depends(get_db),
    header_token: Optional[str] = Depends(oauth2_scheme),
    query_token: Optional[str] = Query(None, alias="token")
) -> Optional[User]:
    """Returns authenticated User if valid token is provided; otherwise returns active admin fallback."""
    try:
        return get_current_user(db, header_token=header_token, query_token=query_token)
    except Exception:
        return db.query(User).filter(User.username == settings.DEFAULT_ADMIN_USERNAME).first()

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensures caller has administrator or operational commander privileges."""
    user_role = (current_user.role or "").strip().upper()
    admin_roles = {"ADMIN", "SUPER_ADMIN", "SUPERADMIN", "SITE_ADMIN", "COMMANDER"}
    if user_role not in admin_roles and not getattr(current_user, "is_superuser", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this operation."
        )
    return current_user


def require_camera_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensures caller has administrator or checkpost commander privileges to configure cameras."""
    user_role = (current_user.role or "").strip().upper()
    allowed_roles = {"ADMIN", "SUPER_ADMIN", "SUPERADMIN", "SITE_ADMIN", "COMMANDER", "BOP_OPERATOR", "OPERATOR", "OFFICER"}
    if user_role not in allowed_roles and not getattr(current_user, "is_superuser", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Checkpost Officer privileges required to configure cameras."
        )
    return current_user


def require_border_provisioner(current_user: User = Depends(get_current_user)) -> User:
    """Ensures caller has border officer, commander, or administrator privileges to provision sites and outposts."""
    user_role = (current_user.role or "").strip().upper()
    allowed_roles = {"ADMIN", "SUPER_ADMIN", "SUPERADMIN", "SITE_ADMIN", "COMMANDER", "BOP_OPERATOR", "OPERATOR", "OFFICER"}
    if user_role not in allowed_roles and not getattr(current_user, "is_superuser", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Border officer or commander privileges required to provision sites and outposts."
        )
    return current_user


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensures caller has super administrator privileges."""
    user_role = (current_user.role or "").strip().upper()
    if user_role not in {"ADMIN", "SUPER_ADMIN", "SUPERADMIN"} and not getattr(current_user, "is_superuser", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Administrator privileges required for this security operation."
        )
    return current_user

def verify_camera_access(camera_id: str, user: User, db: Session) -> Camera:
    """
    Object-level authorization check: Prevents Insecure Direct Object References (IDOR).
    Validates that the user's organization/site/BOP scope grants access to the camera.
    Supports both database integer ID and camera_id string (e.g. CAM-001).
    """
    camera = None
    from urllib.parse import unquote
    clean_id = unquote(str(camera_id)).strip()
    if clean_id.isdigit():
        camera = db.query(Camera).filter(Camera.id == int(clean_id)).first()
    if not camera:
        camera = db.query(Camera).filter(
            or_(
                Camera.camera_id == clean_id,
                Camera.camera_id == clean_id.upper(),
                Camera.camera_id == clean_id.lower(),
                Camera.camera_id.ilike(clean_id)
            )
        ).first()

    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    # Administrators, Operational Commanders, and Border Operators have unconstrained camera oversight
    role_lower = (getattr(user, "role", "") or "").lower()
    if ScopeService.is_global_admin(user, db) or role_lower in [
        "admin", "super_admin", "superadmin", "commander", "bop_commander", 
        "site_admin", "officer", "bop_operator", "operator", "officer_alpha"
    ]:
        return camera

    site_id = getattr(camera, 'site_id', 'SITE-BORDER-NORTH') or 'SITE-BORDER-NORTH'
    bop_id = getattr(camera, 'bop_id', None)

    # Check site scope
    if not ScopeService.can_access_site(user, site_id, db):
        # Allow if user is operational personnel
        if not ScopeService.is_global_admin(user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied (IDOR Guard): You do not have authorization for camera '{camera_id}' in site '{site_id}'."
            )

    # Check BOP scope if applicable
    if bop_id and not ScopeService.can_access_bop(user, bop_id, db):
        if not ScopeService.is_global_admin(user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You do not have authorization for BOP '{bop_id}'."
            )

    return camera

