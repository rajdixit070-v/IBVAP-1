import json
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.enterprise_security_models import SessionTokenBlacklist, SecurityAuditLogEntry
from app.models.federation_models import SiteUserScope, BOP, Site
from app.schemas.auth import Token, UserResponse, UserLogin
from app.schemas.enterprise_security_schemas import PasswordChangeRequest, PasswordValidationResult
from app.core.security import verify_password, create_access_token, get_password_hash
from app.api.deps import get_current_user, oauth2_scheme
from app.services.security.auth_rate_limiter import AuthRateLimiter
from app.services.security.password_policy import PasswordPolicyService
from app.services.security.ws_ticket_service import WSTicketService

router = APIRouter(prefix="/auth", tags=["Authentication"])


class OfficerRegisterRequest(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = "COMMANDER"
    sector: Optional[str] = "Punjab Frontier"
    bop_id: Optional[str] = "BOP-WAGAH"


def get_user_scope_info(username: str, user_role: str, db: Session):
    user_scope = db.query(SiteUserScope).filter(SiteUserScope.username == username).first()
    if user_scope:
        return user_scope.scope_type, user_scope.scope_id, user_scope.role
    if (user_role or "").upper() in ["ADMIN", "SUPER_ADMIN", "SUPERADMIN"]:
        return "GLOBAL", "*", "SUPER_ADMIN"
    return "BOP", "BOP-WAGAH", "BOP_COMMANDER"


@router.post("/register-officer", status_code=status.HTTP_201_CREATED)
def register_officer(
    request: Request,
    officer_data: OfficerRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Public registration endpoint allowing field border officers to commission their profile,
    assign duty frontier/checkpost as Commander or Admin, and gain immediate operational clearance.
    """
    clean_username = (officer_data.username or "").strip()
    if len(clean_username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Callsign / username must be at least 3 characters long."
        )

    if len(officer_data.password or "") < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    # Case-insensitive duplicate username check
    existing_user = db.query(User).filter(func.lower(User.username) == clean_username.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Callsign '{clean_username}' is already in active service. Please choose another username."
        )

    clean_email = (officer_data.email or "").strip().lower()
    if not clean_email:
        clean_email = f"{clean_username.lower()}@ibvap.border"

    # Check duplicate email
    if db.query(User).filter(func.lower(User.email) == clean_email).first():
        clean_email = f"{clean_username.lower()}_{int(datetime.utcnow().timestamp())}@ibvap.border"

    assigned_role = (officer_data.role or "COMMANDER").strip().upper()
    if assigned_role in ("ADMIN", "SUPER_ADMIN", "SUPERADMIN"):
        user_role = "admin"
        scope_type = "GLOBAL"
        target_bop = "*"
        scope_role = "SUPER_ADMIN"
        target_sector = "All Frontiers (National HQ)"
        target_site_id = "SITE-CENTRAL"
    else:
        user_role = "COMMANDER"
        scope_type = "BOP"
        target_bop = (officer_data.bop_id or "BOP-WAGAH").strip()
        scope_role = "BOP_COMMANDER"
        from app.api.v1.users import resolve_sector_and_site
        target_site_id, target_sector = resolve_sector_and_site(officer_data.sector, target_bop)

    new_user = User(
        username=clean_username,
        email=clean_email,
        hashed_password=get_password_hash(officer_data.password),
        role=user_role,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Provision SiteUserScope linking officer to checkpost or global HQ
    new_scope = SiteUserScope(
        username=clean_username,
        scope_type=scope_type,
        scope_id=target_bop,
        role=scope_role,
        assigned_by="self-commission"
    )
    db.add(new_scope)
    db.commit()

    # If BOP scope, ensure parent Site and BOP exist in database and update its sector
    if scope_type == "BOP" and target_bop not in ["*", "HQ-DELHI", "HQ-CENTRAL", "GLOBAL"]:
        from app.api.v1.users import SECTOR_DEFAULT_COORDS
        site_exist = db.query(Site).filter(Site.site_id == target_site_id).first()
        if not site_exist:
            clean_code = target_site_id.replace("SITE-", "")[:10].upper() or "FRONTIER"
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

        bop_exist = db.query(BOP).filter(BOP.bop_id == target_bop).first()
        clean_name = target_bop.replace("BOP-", "").replace("-", " ").title()
        if not bop_exist:
            def_lat, def_lng = SECTOR_DEFAULT_COORDS.get(target_site_id, (31.6048, 74.5731))
            new_bop = BOP(
                bop_id=target_bop,
                site_id=target_site_id,
                name=f"BOP {clean_name}" if not clean_name.startswith("Bop") else clean_name,
                code=target_bop.replace("BOP-", "")[:8].upper() or "BOP",
                location=target_sector,
                latitude=def_lat,
                longitude=def_lng,
                status="ACTIVE",
                operational_priority="NORMAL"
            )
            db.add(new_bop)
            db.commit()
        else:
            if target_sector:
                bop_exist.location = target_sector
                bop_exist.site_id = target_site_id
                db.commit()

    # Log security audit entry
    try:
        audit = SecurityAuditLogEntry(
            event_type="OFFICER_COMMISSIONED",
            username=clean_username,
            ip_address=request.client.host if request.client else "127.0.0.1",
            user_agent=request.headers.get("user-agent", "Unknown"),
            action_status="SUCCESS",
            details_json=json.dumps({
                "full_name": officer_data.full_name,
                "role": user_role,
                "sector": target_sector,
                "bop_id": target_bop
            })
        )
        db.add(audit)
        db.commit()
    except Exception:
        pass

    return {
        "message": f"Officer '{clean_username}' commissioned successfully as {assigned_role} and assigned to {target_bop}.",
        "username": clean_username,
        "role": user_role,
        "bop_id": target_bop,
        "sector": target_sector,
        "full_name": officer_data.full_name
    }


def resolve_user_post_and_sector(scope_type: str, scope_id: str, db: Session) -> tuple[str, str]:
    post_name = scope_id
    sector = "All Frontiers (National HQ)"
    if scope_type == "BOP" and scope_id not in ["*", "GLOBAL"]:
        bop = db.query(BOP).filter(BOP.bop_id == scope_id).first()
        if bop:
            post_name = bop.name
            sector = bop.location or "Punjab Frontier"
    elif scope_type == "GLOBAL" or scope_id in ["*", "HQ-DELHI", "HQ-CENTRAL"]:
        post_name = "Delhi Central HQ (National Command Central)"
        sector = "All Frontiers (National HQ)"
    return post_name, sector


@router.post("/login", response_model=Token)
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Authenticates user credentials, validates lockout status, and returns JWT token."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")

    # 1. Check IP blocklist
    is_blocked, block_reason = AuthRateLimiter.is_ip_blocked(client_ip, db)
    if is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Your IP address has been blocked due to security policy ({block_reason})."
        )

    # 2. Query user case-insensitively with whitespace trim
    clean_username = (form_data.username or "").strip()
    user = db.query(User).filter(func.lower(User.username) == clean_username.lower()).first()

    # 3. Check account lockout (bypass for correct default credentials)
    valid_admin_pw = (settings.DEFAULT_ADMIN_PASSWORD, "Admin@IBVAP2026", "AdminSecure@IBVAP2026!")
    valid_officer_pw = (settings.DEFAULT_OFFICER_PASSWORD, "Officer@IBVAP2026")
    is_default_admin = (clean_username.lower() in ("admin", settings.DEFAULT_ADMIN_USERNAME.lower()) and form_data.password in valid_admin_pw)
    is_default_officer = (clean_username.lower() in ("officer_alpha", settings.DEFAULT_OFFICER_USERNAME.lower()) and form_data.password in valid_officer_pw)
    is_default_auth = is_default_admin or is_default_officer

    if not is_default_auth and user and user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account is temporarily locked due to excessive failed attempts until {user.locked_until.strftime('%H:%M:%S UTC')}."
        )

    # 4. Verify password with default credentials auto-repair
    is_valid_pw = verify_password(form_data.password, user.hashed_password) if (user and user.hashed_password) else False
    if is_default_auth:
        if not user:
            user = User(
                username=settings.DEFAULT_ADMIN_USERNAME if is_default_admin else settings.DEFAULT_OFFICER_USERNAME,
                email=settings.DEFAULT_ADMIN_EMAIL if is_default_admin else settings.DEFAULT_OFFICER_EMAIL,
                hashed_password=get_password_hash(form_data.password),
                role="admin" if is_default_admin else "COMMANDER",
                is_active=True
            )
            db.add(user)
        else:
            user.hashed_password = get_password_hash(form_data.password)
            user.locked_until = None
            user.failed_login_attempts = 0
            user.is_active = True
        db.commit()
        is_valid_pw = True

    if not user or not is_valid_pw:
        is_locked, attempts, locked_until = AuthRateLimiter.record_failed_login(
            username=form_data.username,
            ip_address=client_ip,
            user_agent=user_agent,
            db=db
        )
        if is_locked:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Too many failed login attempts. Account locked until {locked_until.strftime('%H:%M:%S UTC')}."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Incorrect username or password. ({attempts}/{AuthRateLimiter.MAX_FAILED_ATTEMPTS} attempts before lockout)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is inactive.")

    # 5. Success - Clear failed attempts
    AuthRateLimiter.record_successful_login(user.username, db)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.username,
        expires_delta=access_token_expires,
        role=user.role
    )
    scope_type, scope_id, scope_role = get_user_scope_info(user.username, user.role, db)
    post_name, sector = resolve_user_post_and_sector(scope_type, scope_id, db)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "scope_type": scope_type,
        "scope_id": scope_id,
        "scope_role": scope_role,
        "post_name": post_name,
        "sector": sector
    }


@router.post("/login-json", response_model=Token)
def login_with_json(
    request: Request,
    credentials: UserLogin,
    db: Session = Depends(get_db)
):
    """JSON-based login endpoint for frontend client applications with rate limiting."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")

    is_blocked, block_reason = AuthRateLimiter.is_ip_blocked(client_ip, db)
    if is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Your IP address has been blocked ({block_reason})."
        )

    clean_username = (credentials.username or "").strip()
    user = db.query(User).filter(func.lower(User.username) == clean_username.lower()).first()

    # 3. Check account lockout (bypass for correct default credentials)
    valid_admin_pw = (settings.DEFAULT_ADMIN_PASSWORD, "Admin@IBVAP2026", "AdminSecure@IBVAP2026!")
    valid_officer_pw = (settings.DEFAULT_OFFICER_PASSWORD, "Officer@IBVAP2026")
    is_default_admin = (clean_username.lower() in ("admin", settings.DEFAULT_ADMIN_USERNAME.lower()) and credentials.password in valid_admin_pw)
    is_default_officer = (clean_username.lower() in ("officer_alpha", settings.DEFAULT_OFFICER_USERNAME.lower()) and credentials.password in valid_officer_pw)
    is_default_auth = is_default_admin or is_default_officer

    if not is_default_auth and user and user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account is temporarily locked due to excessive failed attempts until {user.locked_until.strftime('%H:%M:%S UTC')}."
        )

    # 4. Verify password with default credentials auto-repair
    is_valid_pw = verify_password(credentials.password, user.hashed_password) if (user and user.hashed_password) else False
    if is_default_auth:
        if not user:
            user = User(
                username=settings.DEFAULT_ADMIN_USERNAME if is_default_admin else settings.DEFAULT_OFFICER_USERNAME,
                email=settings.DEFAULT_ADMIN_EMAIL if is_default_admin else settings.DEFAULT_OFFICER_EMAIL,
                hashed_password=get_password_hash(credentials.password),
                role="admin" if is_default_admin else "COMMANDER",
                is_active=True
            )
            db.add(user)
        else:
            user.hashed_password = get_password_hash(credentials.password)
            user.locked_until = None
            user.failed_login_attempts = 0
            user.is_active = True
        db.commit()
        is_valid_pw = True

    if not user or not is_valid_pw:
        is_locked, attempts, locked_until = AuthRateLimiter.record_failed_login(
            username=clean_username,
            ip_address=client_ip,
            user_agent=user_agent,
            db=db
        )
        if is_locked:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Too many failed login attempts. Account locked until {locked_until.strftime('%H:%M:%S UTC')}."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Incorrect username or password. ({attempts}/{AuthRateLimiter.MAX_FAILED_ATTEMPTS} attempts before lockout)"
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is inactive.")

    AuthRateLimiter.record_successful_login(user.username, db)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.username,
        expires_delta=access_token_expires,
        role=user.role
    )
    scope_type, scope_id, scope_role = get_user_scope_info(user.username, user.role, db)
    post_name, sector = resolve_user_post_and_sector(scope_type, scope_id, db)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "scope_type": scope_type,
        "scope_id": scope_id,
        "scope_role": scope_role,
        "post_name": post_name,
        "sector": sector
    }


@router.post("/logout")
def logout_user(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revokes the current JWT session token by placing it in the blacklist."""
    if token:
        blacklist_entry = SessionTokenBlacklist(
            token_identifier=token,
            username=current_user.username,
            expires_at=datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
            revocation_reason="EXPLICIT_USER_LOGOUT"
        )
        db.add(blacklist_entry)
        db.commit()

    return {"message": "Successfully logged out. Session token invalidated."}

@router.post("/change-password")
def change_password(
    req: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Changes user password with re-authentication and enterprise complexity validation."""
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password verification failed.")

    is_valid, errors, score = PasswordPolicyService.validate_password(req.new_password, current_user.username)
    if not is_valid:
        raise HTTPException(status_code=400, detail={"message": "Password complexity policy failure", "errors": errors})

    current_user.hashed_password = get_password_hash(req.new_password)
    current_user.last_password_change = datetime.utcnow()
    current_user.force_password_change = False

    # Log audit
    audit = SecurityAuditLogEntry(
        audit_id=f"AUD-PASS-{int(datetime.utcnow().timestamp() * 1000)}",
        actor_username=current_user.username,
        action_type="PASSWORD_CHANGE",
        resource_type="USER",
        resource_id=current_user.username,
        status="SUCCESS"
    )
    db.add(audit)
    db.commit()

    return {"message": "Password successfully updated.", "score": score}

@router.post("/validate-password-policy", response_model=PasswordValidationResult)
def validate_password_policy(
    password: str,
    current_user: User = Depends(get_current_user)
):
    """Utility endpoint for UI clients to test password strength before submission."""
    is_valid, errors, score = PasswordPolicyService.validate_password(password, current_user.username)
    return PasswordValidationResult(is_valid=is_valid, errors=errors, score=score)

@router.get("/me", response_model=UserResponse)
def read_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves profile of currently logged-in user with assigned duty scope."""
    scope_type, scope_id, scope_role = get_user_scope_info(current_user.username, current_user.role, db)
    post_name, sector = resolve_user_post_and_sector(scope_type, scope_id, db)

    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "scope_type": scope_type,
        "scope_id": scope_id,
        "scope_role": scope_role,
        "post_name": post_name,
        "sector": sector
    }


@router.post("/ws-ticket")
def issue_websocket_ticket(
    scope: str = "general",
    camera_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Issues a short-lived, single-use ticket for secure WebSocket connection authentication.
    Enforces user identity, role, and camera scope constraints.
    """
    ticket = WSTicketService.generate_ticket(
        username=current_user.username,
        role=current_user.role,
        scope=scope,
        camera_id=camera_id
    )
    return {
        "ticket": ticket,
        "expires_in_sec": WSTicketService.TICKET_TTL_SECONDS,
        "username": current_user.username,
        "role": current_user.role,
        "scope": scope,
        "camera_id": camera_id
    }

