from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.evidence import Evidence
from app.schemas.evidence import EvidenceResponse
from app.services.evidence.evidence_manager import evidence_manager

router = APIRouter()

@router.get("/{evidence_id}", response_model=EvidenceResponse)
def get_evidence_detail(evidence_id: str, db: Session = Depends(get_db)):
    """
    Retrieve evidence metadata and integrity hash. Audits access in SecurityAuditLog.
    """
    evd = db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()
    if not evd:
        raise HTTPException(status_code=404, detail="Evidence record not found.")

    evidence_manager.audit_evidence_access(evidence_id=evidence_id, username="operator", action="EVIDENCE_VIEWED")
    return evd

@router.get("/incident/{incident_id}", response_model=List[EvidenceResponse])
def get_incident_evidence(incident_id: str, db: Session = Depends(get_db)):
    """
    List all evidence records attached to an incident.
    """
    return db.query(Evidence).filter(Evidence.incident_id == incident_id).all()
