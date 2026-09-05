from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.enterprise_security_models import SessionTokenBlacklist, SecurityAuditLogEntry
from app.models.federation_models import SiteUserScope
from app.schemas.auth import Token, UserResponse, UserLogin
from app.schemas.enterprise_security_schemas import PasswordChangeRequest, PasswordValidationResult
from app.core.security import verify_password, create_access_token, get_password_hash
from app.api.deps import get_current_user, oauth2_scheme
from app.services.security.auth_rate_limiter import AuthRateLimiter
from app.services.security.password_policy import PasswordPolicyService
from app.services.security.ws_ticket_service import WSTicketService

router = APIRouter(prefix="/auth", tags=["Authentication"])

def get_user_scope_info(username: str, user_role: str, db: Session):
    user_scope = db.query(SiteUserScope).filter(SiteUserScope.username == username).first()
    if user_scope:
        return user_scope.scope_type, user_scope.scope_id, user_scope.role
    if user_role in ["admin", "SUPER_ADMIN"]:
        return "GLOBAL", "*", "SUPER_ADMIN"
    return "BOP", "BOP-ALPHA", "BOP_OPERATOR"


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

    # 2. Query user
    user = db.query(User).filter(User.username == form_data.username).first()

    # 3. Check account lockout
    if user and user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account is temporarily locked due to excessive failed attempts until {user.locked_until.strftime('%H:%M:%S UTC')}."
        )

    # 4. Verify password
    if not user or not verify_password(form_data.password, user.hashed_password):
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
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "scope_type": scope_type,
        "scope_id": scope_id,
        "scope_role": scope_role
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

    user = db.query(User).filter(User.username == credentials.username).first()

    if user and user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account is temporarily locked due to excessive failed attempts until {user.locked_until.strftime('%H:%M:%S UTC')}."
        )

    if not user or not verify_password(credentials.password, user.hashed_password):
        is_locked, attempts, locked_until = AuthRateLimiter.record_failed_login(
            username=credentials.username,
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
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
        "scope_type": scope_type,
        "scope_id": scope_id,
        "scope_role": scope_role
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
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "scope_type": scope_type,
        "scope_id": scope_id,
        "scope_role": scope_role
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

