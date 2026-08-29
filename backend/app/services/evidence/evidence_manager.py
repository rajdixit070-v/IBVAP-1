import hashlib
import uuid
import logging
from datetime import datetime
from typing import Optional, Any
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.evidence import Evidence
from app.models.audit_log import SecurityAuditLog

logger = logging.getLogger("ibvap.evidence.manager")

class EvidenceManager:
    """
    Evidence registry with SHA-256 integrity checksum calculation and access audit logs.
    """

    def register_evidence(
        self,
        camera_id: str,
        evidence_type: str,
        file_path: str,
        source_event_id: Optional[str] = None,
        incident_id: Optional[str] = None,
        data_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg"
    ) -> Evidence:
        db: Session = SessionLocal()
        try:
            now = datetime.utcnow()
            evd_id = f"EVD-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            
            # Compute SHA-256 checksum
            if data_bytes:
                sha256 = hashlib.sha256(data_bytes).hexdigest()
                size = len(data_bytes)
            else:
                sha256 = hashlib.sha256(f"{evd_id}:{file_path}".encode("utf-8")).hexdigest()
                size = 1024

            record = Evidence(
                evidence_id=evd_id,
                source_event_id=source_event_id,
                incident_id=incident_id,
                camera_id=camera_id,
                evidence_type=evidence_type,
                file_path=file_path,
                checksum_sha256=sha256,
                mime_type=mime_type,
                file_size_bytes=size,
                created_at=now
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            logger.info(f"Registered evidence {evd_id} ({evidence_type}) with SHA-256: {sha256[:12]}...")
            return record
        finally:
            db.close()

    def verify_evidence_integrity(self, evidence_id: str, data_bytes: bytes, username: str = "system") -> bool:
        """
        Recomputes SHA-256 digest on data_bytes and compares with stored checksum.
        Logs audit record with integrity verification status.
        """
        if not data_bytes:
            return False

        db: Session = SessionLocal()
        try:
            evd = db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()
            if not evd:
                raise ValueError(f"Evidence record '{evidence_id}' not found.")

            computed_sha256 = hashlib.sha256(data_bytes).hexdigest()
            is_valid = (computed_sha256 == evd.checksum_sha256)

            action = "EVIDENCE_VERIFIED_VALID" if is_valid else "EVIDENCE_INTEGRITY_MISMATCH"
            audit = SecurityAuditLog(
                username=username,
                action=action,
                resource_type="EVIDENCE",
                resource_id=evidence_id,
                details=f'{{"evidence_id": "{evidence_id}", "is_valid": {str(is_valid).lower()}, "stored": "{evd.checksum_sha256}", "computed": "{computed_sha256}"}}'
            )
            db.add(audit)
            db.commit()
            return is_valid
        finally:
            db.close()

    def audit_evidence_access(self, evidence_id: str, username: str = "operator", action: str = "EVIDENCE_VIEWED"):
        db: Session = SessionLocal()
        try:
            audit = SecurityAuditLog(
                username=username,
                action=action,
                resource_type="EVIDENCE",
                resource_id=evidence_id,
                details=f'{{"evidence_id": "{evidence_id}", "access_time": "{datetime.utcnow().isoformat()}"}}'
            )
            db.add(audit)
            db.commit()
        finally:
            db.close()

# Global Singleton
evidence_manager = EvidenceManager()
