from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.evidence import Evidence
from app.schemas.evidence import EvidenceResponse
from app.services.evidence.evidence_manager import evidence_manager

router = APIRouter()

@router.get("/{evidence_id}", response_model=EvidenceResponse)
def get_evidence_detail(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve evidence metadata and integrity hash. Audits access in SecurityAuditLog.
    """
    evd = db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()
    if not evd:
        raise HTTPException(status_code=404, detail="Evidence record not found.")

    evidence_manager.audit_evidence_access(evidence_id=evidence_id, username=current_user.username, action="EVIDENCE_VIEWED")
    return evd

@router.get("/incident/{incident_id}", response_model=List[EvidenceResponse])
def get_incident_evidence(
    incident_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all evidence records attached to an incident.
    """
    return db.query(Evidence).filter(Evidence.incident_id == incident_id).all()

@router.post("/{evidence_id}/verify")
def verify_evidence_hash(
    evidence_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cryptographically verifies the integrity of an evidence payload against stored SHA-256 hash.
    """
    raw_content = data.get("content", "")
    data_bytes = raw_content.encode("utf-8") if isinstance(raw_content, str) else raw_content
    try:
        is_valid = evidence_manager.verify_evidence_integrity(
            evidence_id=evidence_id,
            data_bytes=data_bytes,
            username=current_user.username
        )
        return {"evidence_id": evidence_id, "is_valid": is_valid, "verified_by": current_user.username}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
