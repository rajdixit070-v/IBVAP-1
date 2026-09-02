import time
import secrets
import logging
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from app.config import settings

logger = logging.getLogger("ibvap.security.ws_ticket")

class WSTicketService:
    _tickets: Dict[str, Dict[str, Any]] = {}
    TICKET_TTL_SECONDS: int = 60

    @classmethod
    def _cleanup_expired_tickets(cls):
        now = time.time()
        expired = [t for t, data in cls._tickets.items() if data["expires_at"] < now]
        for t in expired:
            cls._tickets.pop(t, None)

    @classmethod
    def generate_ticket(
        cls,
        username: str,
        role: str = "operator",
        scope: str = "general",
        camera_id: Optional[str] = None
    ) -> str:
        cls._cleanup_expired_tickets()
        ticket_id = f"wst_{secrets.token_urlsafe(32)}"
        cls._tickets[ticket_id] = {
            "username": username,
            "role": role,
            "scope": scope,
            "camera_id": camera_id,
            "created_at": time.time(),
            "expires_at": time.time() + cls.TICKET_TTL_SECONDS
        }
        logger.info(f"Generated WS ticket for user={username} role={role} scope={scope} cam={camera_id}")
        return ticket_id

    @classmethod
    def validate_and_consume_ticket(
        cls,
        ticket: Optional[str] = None,
        expected_scope: Optional[str] = None,
        expected_camera_id: Optional[str] = None,
        jwt_token_fallback: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        now = time.time()
        cls._cleanup_expired_tickets()

        # 1. Primary path: Single-use ticket validation
        if ticket:
            if ticket in cls._tickets:
                ticket_data = cls._tickets.pop(ticket)  # once used, consumed
                if ticket_data["expires_at"] < now:
                    logger.warning(f"Expired WS ticket attempted: user={ticket_data.get('username')}")
                    return None

                if expected_camera_id and ticket_data.get("camera_id"):
                    if ticket_data["camera_id"] != expected_camera_id and ticket_data["camera_id"] != "*":
                        logger.warning(f"WS Ticket camera scope mismatch: expected={expected_camera_id}, got={ticket_data.get('camera_id')}")
                        return None

                return ticket_data
            else:
                logger.warning("Attempted use of unknown or already-consumed WS ticket")
                return None

        # 2. Secondary fallback path: Standard JWT Bearer token validation
        if jwt_token_fallback:
            if jwt_token_fallback.startswith("eyJ"):
                try:
                    payload = jwt.decode(jwt_token_fallback, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                    username = payload.get("sub")
                    role = payload.get("role", "operator")
                    if not username:
                        return None
                    return {
                        "username": username,
                        "role": role,
                        "scope": "jwt_direct",
                        "camera_id": None
                    }
                except JWTError as e:
                    logger.warning(f"Invalid JWT in WebSocket auth: {e}")
                    return None
            else:
                return None

        # 3. Development / Test unauthenticated allowance ONLY when no ticket/token was provided
        if not ticket and not jwt_token_fallback and settings.ENV_MODE in ("test", "development") and not settings.DEMO_MODE:
            return {
                "username": "dev_test_user",
                "role": "admin",
                "scope": "test_bypass",
                "camera_id": None
            }

        return None
