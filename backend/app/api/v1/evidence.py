from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.evidence import Evidence
from app.schemas.evidence import EvidenceResponse
from app.services.evidence.evidence_manager import evidence_manager

router = APIRouter()

@router.get("/", response_model=List[EvidenceResponse])
def list_all_evidence(
    camera_id: Optional[str] = Query(None),
    evidence_type: Optional[str] = Query(None),
    limit: int = Query(60, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all cryptographic forensic evidence snapshots captured across all cameras and AI detections.
    """
    query = db.query(Evidence)
    if camera_id and isinstance(camera_id, str) and camera_id != "ALL":
        query = query.filter(Evidence.camera_id == camera_id)
    if evidence_type and isinstance(evidence_type, str) and evidence_type != "ALL":
        query = query.filter(Evidence.evidence_type == evidence_type)
    num_limit = int(limit) if isinstance(limit, (int, str)) and str(limit).isdigit() else 60
    return query.order_by(Evidence.created_at.desc()).limit(num_limit).all()

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

@router.get("/{evidence_id}/file")
@router.get("/{evidence_id}/download")
def get_evidence_file(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Streams the genuine JPEG evidence snapshot bytes directly to client image players.
    Supports query parameter ?token=... or standard Authorization header.
    """
    import os
    from fastapi import Response
    evd = db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()
    if not evd:
        raise HTTPException(status_code=404, detail="Evidence record not found.")

    username = current_user.username if current_user else "browser_viewer"

    file_path = evd.file_path
    if os.path.exists(file_path) and os.path.isfile(file_path):
        with open(file_path, "rb") as f:
            content = f.read()
        evidence_manager.audit_evidence_access(evidence_id=evidence_id, username=username, action="EVIDENCE_VIEWED")
        return Response(content=content, media_type=evd.mime_type or "image/jpeg")

    # If physical file on disk was rotated, check storage path
    from app.config import settings
    alt_path = os.path.join(settings.EVIDENCE_STORAGE_PATH, os.path.basename(file_path))
    if os.path.exists(alt_path) and os.path.isfile(alt_path):
        with open(alt_path, "rb") as f:
            content = f.read()
        return Response(content=content, media_type="image/jpeg")

    raise HTTPException(status_code=404, detail=f"Evidence binary file not found on disk for '{evidence_id}'.")

@router.get("/by-event/{event_id}", response_model=List[EvidenceResponse])
def get_event_evidence(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Returns all evidence items attached to a specific security event."""
    return db.query(Evidence).filter(Evidence.source_event_id == event_id).all()

@router.delete("/clear-all")
@router.post("/clear-all")
@router.delete("/")
def clear_all_evidence(
    camera_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Purges all or camera-filtered evidence records and removes files from disk."""
    import os
    query = db.query(Evidence)
    if camera_id and camera_id != "ALL":
        query = query.filter(Evidence.camera_id == camera_id)

    records = query.all()
    count = len(records)
    for ev in records:
        file_path = ev.file_path
        if file_path and os.path.exists(file_path) and os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        db.delete(ev)

    db.commit()
    return {"message": f"Successfully deleted {count} evidence items.", "count": count}

@router.delete("/{evidence_id}")
def delete_evidence(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Deletes an evidence record and removes its physical snapshot file from disk."""
    import os
    evd = db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()
    if not evd:
        raise HTTPException(status_code=404, detail="Evidence record not found.")

    file_path = evd.file_path
    if file_path and os.path.exists(file_path) and os.path.isfile(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    db.delete(evd)
    username = current_user.username if current_user else "operator"
    try:
        evidence_manager.audit_evidence_access(evidence_id=evidence_id, username=username, action="EVIDENCE_DELETED")
    except Exception:
        pass
    db.commit()
    return {"message": f"Evidence '{evidence_id}' successfully deleted."}
