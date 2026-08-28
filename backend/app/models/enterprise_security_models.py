from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Text
from app.database import Base

class SecurityThreatEvent(Base):
    """Logs cybersecurity, authentication, authorization, and API threat events."""
    __tablename__ = "security_threat_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    event_type = Column(String(64), index=True, nullable=False)  # BRUTE_FORCE_ATTEMPT, IDOR_ATTEMPT, etc.
    severity = Column(String(16), default="MEDIUM", index=True, nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    source_ip = Column(String(64), default="127.0.0.1", index=True)
    user_agent = Column(String(255), default="Unknown")
    username = Column(String(64), index=True, nullable=True)
    target_resource = Column(String(128), nullable=True)
    endpoint = Column(String(255), nullable=True)
    details_json = Column(Text, default="{}")
    mitigation_action = Column(String(255), default="LOGGED")
    status = Column(String(32), default="NEW", index=True)  # NEW, INVESTIGATING, CONTAINED, RESOLVED, FALSE_POSITIVE
    resolved_by = Column(String(64), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class EdgeNodeCredential(Base):
    """Cryptographic API keys and tokens for distributed edge node authentication."""
    __tablename__ = "edge_node_credentials"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(String(64), unique=True, index=True, nullable=False)
    key_prefix = Column(String(32), nullable=False)  # e.g. edg_live_a1b2
    api_key_hash = Column(String(255), nullable=False)  # SHA-256 hash of API key
    status = Column(String(20), default="ACTIVE", index=True)  # ACTIVE, REVOKED, EXPIRED, ROTATED
    site_id = Column(String(64), default="SITE-BORDER-NORTH")
    bop_id = Column(String(64), nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    revoked_by = Column(String(64), nullable=True)
    revocation_reason = Column(String(255), nullable=True)
    created_by = Column(String(64), default="SYSTEM")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BlockedIPEntry(Base):
    """Temporarily or permanently blocked IPs due to repeated malicious attacks."""
    __tablename__ = "blocked_ip_entries"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String(64), unique=True, index=True, nullable=False)
    reason = Column(String(255), nullable=False)
    attack_count = Column(Integer, default=1)
    is_active = Column(Boolean, default=True, index=True)
    blocked_until = Column(DateTime, nullable=True)
    created_by = Column(String(64), default="SYSTEM_RATE_LIMITER")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SessionTokenBlacklist(Base):
    """Tracks revoked JWT token identifiers (JTI or signatures) on logout."""
    __tablename__ = "session_token_blacklist"

    id = Column(Integer, primary_key=True, index=True)
    token_identifier = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(64), index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revocation_reason = Column(String(255), default="USER_LOGOUT")
    created_at = Column(DateTime, default=datetime.utcnow)

class SecurityPostureSetting(Base):
    """Configurable security settings, password rules, and Zero-Trust enforcement toggles."""
    __tablename__ = "security_posture_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(64), unique=True, index=True, nullable=False)
    value = Column(String(255), nullable=False)
    category = Column(String(64), default="GENERAL")  # AUTH, API, NETWORK, DATA, EDGE
    description = Column(String(255), nullable=True)
    is_enforced = Column(Boolean, default=True)
    updated_by = Column(String(64), default="SYSTEM")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SecurityAuditLogEntry(Base):
    """Tamper-evident audit log of privileged administrative actions."""
    __tablename__ = "security_audit_log_entries"

    id = Column(Integer, primary_key=True, index=True)
    audit_id = Column(String(64), unique=True, index=True, nullable=False)
    actor_username = Column(String(64), index=True, nullable=False)
    action_type = Column(String(64), index=True, nullable=False)  # ROLE_CHANGE, CREDENTIAL_ROTATION, etc.
    resource_type = Column(String(64), index=True, nullable=False)  # USER, CAMERA, EDGE, SETTING
    resource_id = Column(String(128), nullable=True)
    old_value_json = Column(Text, nullable=True)
    new_value_json = Column(Text, nullable=True)
    ip_address = Column(String(64), default="127.0.0.1")
    status = Column(String(20), default="SUCCESS")  # SUCCESS, FAILED, DENIED
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
