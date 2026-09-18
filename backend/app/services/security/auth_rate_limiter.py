import time
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.enterprise_security_models import BlockedIPEntry, SecurityThreatEvent
from app.models.user import User

class AuthRateLimiter:
    """
    In-memory and database-backed sliding window rate limiter and brute-force protector.
    Protects authentication endpoints and sensitive APIs against automated credential abuse.
    """

    # Max failed login attempts per username before temporary lockout
    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_DURATION_MINUTES = 15

    # Max requests per window per IP (for IP-based rate limiting)
    IP_REQUEST_LIMIT = 60
    IP_WINDOW_SECONDS = 60

    # In-memory tracking: { key: [timestamp1, timestamp2, ...] }
    _ip_request_history: Dict[str, List[float]] = {}
    _failed_login_history: Dict[str, List[float]] = {}

    @classmethod
    def check_ip_rate_limit(cls, ip_address: str, limit: int = IP_REQUEST_LIMIT, window: int = IP_WINDOW_SECONDS) -> Tuple[bool, int]:
        """
        Checks if IP has exceeded the allowed request limit within the sliding time window.
        Returns (is_allowed, remaining_requests).
        """
        now = time.time()
        if ip_address not in cls._ip_request_history:
            cls._ip_request_history[ip_address] = []

        # Retain only timestamps within the active sliding window
        cls._ip_request_history[ip_address] = [
            ts for ts in cls._ip_request_history[ip_address] if now - ts < window
        ]

        current_count = len(cls._ip_request_history[ip_address])
        if current_count >= limit:
            return False, 0

        cls._ip_request_history[ip_address].append(now)
        return True, limit - (current_count + 1)

    @classmethod
    def is_ip_blocked(cls, ip_address: str, db: Session) -> Tuple[bool, Optional[str]]:
        """Checks if the IP is currently in the active blocklist."""
        now = datetime.utcnow()
        entry = db.query(BlockedIPEntry).filter(
            BlockedIPEntry.ip_address == ip_address,
            BlockedIPEntry.is_active == True
        ).first()

        if entry:
            if entry.blocked_until and entry.blocked_until < now:
                # Expired block
                entry.is_active = False
                db.commit()
                return False, None
            return True, entry.reason
        return False, None

    @classmethod
    def record_failed_login(
        cls,
        username: str,
        ip_address: str,
        user_agent: str,
        db: Session
    ) -> Tuple[bool, int, Optional[datetime]]:
        """
        Records a failed authentication attempt.
        Returns (is_now_locked, total_failed_attempts, locked_until).
        """
        now = time.time()
        now_dt = datetime.utcnow()

        # Update in-memory sliding window for the username
        if username not in cls._failed_login_history:
            cls._failed_login_history[username] = []
        cls._failed_login_history[username] = [
            ts for ts in cls._failed_login_history[username] if now - ts < (cls.LOCKOUT_DURATION_MINUTES * 60)
        ]
        cls._failed_login_history[username].append(now)
        attempts = len(cls._failed_login_history[username])

        user = db.query(User).filter(User.username == username).first()
        is_locked = False
        locked_until = None

        if user:
            user.failed_login_attempts = attempts
            if attempts >= cls.MAX_FAILED_ATTEMPTS:
                locked_until = now_dt + timedelta(minutes=cls.LOCKOUT_DURATION_MINUTES)
                user.locked_until = locked_until
                is_locked = True
            db.commit()

        # Generate a SecurityThreatEvent if repeated attempts detected
        if attempts >= 3:
            threat_event = SecurityThreatEvent(
                event_id=f"SEC-BRUTE-{int(now * 1000)}",
                timestamp=now_dt,
                event_type="BRUTE_FORCE_ATTEMPT",
                severity="CRITICAL" if attempts >= cls.MAX_FAILED_ATTEMPTS else "HIGH",
                source_ip=ip_address,
                user_agent=user_agent[:250] if user_agent else "Unknown",
                username=username,
                endpoint="/api/v1/auth/login",
                details_json=f'{{"failed_attempts": {attempts}, "is_locked": {str(is_locked).lower()}}}',
                mitigation_action=f"ACCOUNT_LOCKED_FOR_{cls.LOCKOUT_DURATION_MINUTES}M" if is_locked else "LOGIN_THROTTLED",
                status="NEW"
            )
            db.add(threat_event)
            db.commit()

        return is_locked, attempts, locked_until

    @classmethod
    def record_successful_login(cls, username: str, db: Session):
        """Clears failed login attempt counters upon successful authentication."""
        clean = (username or "").strip().lower()
        cls._failed_login_history.pop(clean, None)
        cls._failed_login_history.pop(username, None)

        from sqlalchemy import func
        user = db.query(User).filter(func.lower(User.username) == clean).first()
        if user:
            user.failed_login_attempts = 0
            user.locked_until = None
            user.last_login_at = datetime.utcnow()
            db.commit()

    @classmethod
    def unlock_user_account(cls, username: str, db: Session) -> bool:
        """Administratively unlocks a locked account."""
        clean = (username or "").strip().lower()
        cls._failed_login_history.pop(clean, None)
        cls._failed_login_history.pop(username, None)

        from sqlalchemy import func
        user = db.query(User).filter(func.lower(User.username) == clean).first()
        if user:
            user.failed_login_attempts = 0
            user.locked_until = None
            db.commit()
            return True
        return False
