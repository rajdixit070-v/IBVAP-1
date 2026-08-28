import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Tuple, Optional
from sqlalchemy.orm import Session
from app.models.enterprise_security_models import EdgeNodeCredential, SecurityThreatEvent

class EdgeAuthService:
    """
    Manages cryptographic API keys, authentication, rotation, and revocation for edge nodes.
    """

    KEY_PREFIX = "edg_live_"

    @classmethod
    def issue_edge_key(
        cls,
        node_id: str,
        site_id: str = "SITE-BORDER-NORTH",
        bop_id: Optional[str] = None,
        expires_in_days: int = 90,
        actor: str = "SYSTEM",
        db: Session = None
    ) -> Tuple[str, EdgeNodeCredential]:
        """
        Generates a secure random 256-bit API key for an edge node.
        Stores the SHA-256 hash in database and returns (plaintext_api_key, credential_record).
        """
        raw_secret = secrets.token_urlsafe(32)
        plaintext_key = f"{cls.KEY_PREFIX}{raw_secret}"
        key_hash = hashlib.sha256(plaintext_key.encode('utf-8')).hexdigest()
        key_prefix_display = plaintext_key[:16]

        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

        # Check for existing credential and update/rotate
        cred = db.query(EdgeNodeCredential).filter(EdgeNodeCredential.node_id == node_id).first()
        if cred:
            cred.key_prefix = key_prefix_display
            cred.api_key_hash = key_hash
            cred.status = "ACTIVE"
            cred.site_id = site_id
            cred.bop_id = bop_id
            cred.expires_at = expires_at
            cred.revoked_at = None
            cred.revoked_by = None
            cred.revocation_reason = None
            cred.created_by = actor
            cred.updated_at = datetime.utcnow()
        else:
            cred = EdgeNodeCredential(
                node_id=node_id,
                key_prefix=key_prefix_display,
                api_key_hash=key_hash,
                status="ACTIVE",
                site_id=site_id,
                bop_id=bop_id,
                expires_at=expires_at,
                created_by=actor
            )
            db.add(cred)

        db.commit()
        db.refresh(cred)
        return plaintext_key, cred

    @classmethod
    def verify_edge_key(
        cls,
        node_id: str,
        api_key: str,
        source_ip: str,
        db: Session
    ) -> Tuple[bool, Optional[str], Optional[EdgeNodeCredential]]:
        """
        Verifies edge node key hash, status, and expiration.
        Returns (is_valid, error_reason, credential_record).
        """
        if not api_key:
            return False, "Missing edge API key.", None

        cred = db.query(EdgeNodeCredential).filter(EdgeNodeCredential.node_id == node_id).first()
        if not cred:
            # Generate threat event for unrecognized node credentials
            cls._log_edge_threat(node_id, source_ip, "UNAUTHORIZED_NODE_ATTEMPT", "Node ID not recognized.", db)
            return False, f"Edge node '{node_id}' is not registered with central security.", None

        # Check revocation
        if cred.status == "REVOKED":
            cls._log_edge_threat(node_id, source_ip, "REVOKED_NODE_ATTEMPT", f"Revocation reason: {cred.revocation_reason}", db)
            return False, f"Edge node '{node_id}' credential has been revoked.", cred

        # Check expiration
        if cred.expires_at and cred.expires_at < datetime.utcnow():
            cred.status = "EXPIRED"
            db.commit()
            return False, f"Edge node '{node_id}' credential has expired.", cred

        # Hash check
        candidate_hash = hashlib.sha256(api_key.encode('utf-8')).hexdigest()
        if not secrets.compare_digest(candidate_hash, cred.api_key_hash):
            cls._log_edge_threat(node_id, source_ip, "INVALID_TOKEN", "Key signature mismatch.", db)
            return False, "Invalid edge API key signature.", cred

        # Update last used timestamp
        cred.last_used_at = datetime.utcnow()
        db.commit()
        return True, None, cred

    @classmethod
    def revoke_edge_key(
        cls,
        node_id: str,
        reason: str,
        revoked_by: str,
        db: Session
    ) -> bool:
        """Revokes an edge node's credentials immediately."""
        cred = db.query(EdgeNodeCredential).filter(EdgeNodeCredential.node_id == node_id).first()
        if not cred:
            return False

        cred.status = "REVOKED"
        cred.revoked_at = datetime.utcnow()
        cred.revoked_by = revoked_by
        cred.revocation_reason = reason
        db.commit()
        return True

    @classmethod
    def _log_edge_threat(cls, node_id: str, source_ip: str, event_type: str, reason: str, db: Session):
        """Internal helper to record edge node authentication failures."""
        threat = SecurityThreatEvent(
            event_id=f"SEC-EDGE-{int(datetime.utcnow().timestamp() * 1000)}",
            timestamp=datetime.utcnow(),
            event_type=event_type,
            severity="CRITICAL" if event_type == "REVOKED_NODE_ATTEMPT" else "HIGH",
            source_ip=source_ip,
            target_resource=node_id,
            endpoint="/api/v1/edge/sync",
            details_json=f'{{"node_id": "{node_id}", "reason": "{reason}"}}',
            mitigation_action="CONNECTION_REJECTED",
            status="NEW"
        )
        db.add(threat)
        db.commit()
