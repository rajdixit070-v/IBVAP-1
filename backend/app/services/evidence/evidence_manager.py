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

    @staticmethod
    def compute_sha256(data_bytes: Optional[bytes] = None, file_path: Optional[str] = None) -> Optional[str]:
        """
        Computes genuine 64-char hexadecimal SHA-256 digest from actual bytes or physical file.
        Returns None if no actual bytes or file exists (never fabricates or hashes arbitrary metadata).
        """
        import os
        if data_bytes is not None:
            return hashlib.sha256(data_bytes).hexdigest()
        if file_path and os.path.exists(file_path) and os.path.isfile(file_path):
            with open(file_path, "rb") as f:
                return hashlib.sha256(f.read()).hexdigest()
        return None

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
            
            # Compute real SHA-256 checksum from actual bytes or file
            import os
            sha256 = self.compute_sha256(data_bytes=data_bytes, file_path=file_path)
            if data_bytes is not None:
                size = len(data_bytes)
            elif file_path and os.path.exists(file_path) and os.path.isfile(file_path):
                size = os.path.getsize(file_path)
            else:
                size = 0

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
            hash_display = f"{sha256[:12]}..." if sha256 else "NONE"
            logger.info(f"Registered evidence {evd_id} ({evidence_type}) with SHA-256: {hash_display}")
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

    def capture_and_save_frame(
        self,
        camera_id: str,
        frame: Any,
        track: Optional[Any] = None,
        event_type: str = "INTRUSION",
        source_event_id: Optional[str] = None,
        incident_id: Optional[str] = None
    ) -> Optional[Evidence]:
        """
        Annotates the frame with detection HUD & bounding box, saves to disk under
        storage/evidence/{camera_id}/, and registers a cryptographically hashed Evidence record.
        """
        import os
        import cv2
        import numpy as np
        from app.config import settings

        if frame is None or not isinstance(frame, np.ndarray):
            return None

        try:
            now = datetime.now()
            evd_id = f"EVD-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            camera_dir = os.path.join(settings.EVIDENCE_STORAGE_PATH, camera_id)
            os.makedirs(camera_dir, exist_ok=True)

            annotated = frame.copy()
            h, w = annotated.shape[:2]

            # Draw target bounding box if track provided
            if track and hasattr(track, 'bbox') and track.bbox:
                bx = track.bbox
                if isinstance(bx, (list, tuple)) and len(bx) >= 4:
                    x1, y1, x2, y2 = int(bx[0]), int(bx[1]), int(bx[2]), int(bx[3])
                elif isinstance(bx, dict):
                    x1 = int(bx.get("x", 0))
                    y1 = int(bx.get("y", 0))
                    x2 = x1 + int(bx.get("w", 50))
                    y2 = y1 + int(bx.get("h", 50))
                else:
                    x1, y1, x2, y2 = 10, 10, 100, 100

                # Bounding box bounds check
                x1, y1 = max(0, min(w - 1, x1)), max(0, min(h - 1, y1))
                x2, y2 = max(0, min(w - 1, x2)), max(0, min(h - 1, y2))

                # Color: Bright Alert Red (0, 0, 255 in BGR) for all detected targets
                color = (0, 0, 255)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)

                # Label tag
                label = f"{str(getattr(track, 'object_type', 'TARGET')).upper()} #{getattr(track, 'track_id', 1)}"
                if hasattr(track, 'confidence'):
                    label += f" ({int(track.confidence * 100)}%)"

                cv2.rectangle(annotated, (x1, max(0, y1 - 25)), (x1 + len(label) * 11, y1), color, -1)
                cv2.putText(annotated, label, (x1 + 4, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

            # Forensic HUD Top Banner with Local Time
            cv2.rectangle(annotated, (0, 0), (w, 38), (10, 14, 20), -1)
            hud_text = f"IBVAP FORENSIC EVIDENCE // {camera_id} // {event_type.upper()} // {now.strftime('%d-%b-%Y %I:%M:%S %p')}"
            cv2.putText(annotated, hud_text, (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 220, 255), 2)

            filename = f"{evd_id}.jpg"
            file_path = os.path.join(camera_dir, filename).replace("\\", "/")

            cv2.imwrite(file_path, annotated)

            # Read back bytes to compute genuine SHA-256
            with open(file_path, "rb") as f:
                data_bytes = f.read()

            return self.register_evidence(
                camera_id=camera_id,
                evidence_type="SNAPSHOT",
                file_path=file_path,
                source_event_id=source_event_id,
                incident_id=incident_id,
                data_bytes=data_bytes,
                mime_type="image/jpeg"
            )
        except Exception as e:
            logger.error(f"Failed to capture forensic evidence for camera {camera_id}: {e}", exc_info=True)
            return None

# Global Singleton
evidence_manager = EvidenceManager()
