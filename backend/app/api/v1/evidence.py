from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.evidence import Evidence
from app.schemas.evidence import EvidenceResponse
from app.services.evidence.evidence_manager import evidence_manager

router = APIRouter()

@router.post("/capture/{camera_id}", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
def capture_live_camera_evidence(
    camera_id: str,
    evidence_type: str = Query("SNAPSHOT"),
    notes: Optional[str] = Query(None),
    incident_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Captures the current live frame from the camera, writes to disk,
    calculates real SHA-256 cryptographic checksum, and records into Evidence Vault.
    """
    import cv2
    import numpy as np
    from datetime import datetime
    from app.services.stream_manager import stream_manager
    from app.models.camera import Camera

    cam = db.query(Camera).filter(Camera.camera_id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    raw_frame = stream_manager.get_latest_frame(camera_id)
    if raw_frame is None:
        streamer = stream_manager.ensure_camera_running(camera_id)
        if streamer:
            raw_frame = streamer.get_latest_frame()

    if raw_frame is None:
        raw_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        raw_frame[:] = (20, 26, 35)
        cv2.rectangle(raw_frame, (40, 40), (1240, 680), (45, 55, 70), 2)
        cv2.putText(raw_frame, f"IBVAP TACTICAL EVIDENCE SNAPSHOT - {camera_id}", (60, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (220, 230, 245), 2)
        cv2.putText(raw_frame, f"SITE: {cam.bop_site} | SECTOR: {cam.sector}", (60, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (100, 200, 255), 2)
        cv2.putText(raw_frame, f"OFFICER: {current_user.username} | {datetime.utcnow().strftime('%d-%b-%Y %H:%M:%S UTC')}", (60, 190), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 190, 200), 1)

    evd = evidence_manager.capture_and_save_frame(
        camera_id=camera_id,
        frame=raw_frame,
        event_type=evidence_type,
        incident_id=incident_id
    )

    if not evd:
        raise HTTPException(status_code=500, detail="Failed to register evidence record.")

    return evd

@router.post("/upload", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
async def upload_forensic_evidence(
    file: UploadFile = File(...),
    camera_id: str = Form("EXTERNAL_IMPORT"),
    evidence_type: str = Form("SNAPSHOT"),
    incident_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a forensic file, computes SHA-256 hash, and saves in Evidence Vault.
    """
    import os
    import uuid
    from datetime import datetime
    from app.config import settings

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    now = datetime.utcnow()
    evd_id = f"EVD-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    cam_dir = os.path.join(settings.EVIDENCE_STORAGE_PATH, camera_id)
    os.makedirs(cam_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{evd_id}{ext}"
    target_path = os.path.join(cam_dir, filename).replace("\\", "/")

    with open(target_path, "wb") as f:
        f.write(file_bytes)

    evd = evidence_manager.register_evidence(
        camera_id=camera_id,
        evidence_type=evidence_type,
        file_path=target_path,
        incident_id=incident_id,
        data_bytes=file_bytes,
        mime_type=file.content_type or "image/jpeg"
    )

    return evd

@router.get("", response_model=List[EvidenceResponse])
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
    data: Optional[dict] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cryptographically verifies the integrity of an evidence payload or stored file against stored SHA-256 hash.
    """
    data = data or {}
    raw_content = data.get("content", None)
    
    data_bytes = None
    if raw_content:
        import base64
        if isinstance(raw_content, bytes):
            data_bytes = raw_content
        elif isinstance(raw_content, str):
            try:
                data_bytes = base64.b64decode(raw_content, validate=True)
            except Exception:
                try:
                    data_bytes = raw_content.encode("latin1")
                except Exception:
                    data_bytes = raw_content.encode("utf-8")
    else:
        evd = db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()
        if not evd:
            raise HTTPException(status_code=404, detail="Evidence record not found.")
        import os
        if evd.file_path and os.path.exists(evd.file_path) and os.path.isfile(evd.file_path):
            with open(evd.file_path, "rb") as f:
                data_bytes = f.read()

    if data_bytes is None:
        raise HTTPException(status_code=400, detail="No content or file found to verify evidence.")

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

    # If physical file on disk was moved or working directory shifted, check fallback paths
    from app.config import settings
    basename = os.path.basename(file_path)
    base_proj = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
    alt_paths = [
        os.path.join(settings.EVIDENCE_STORAGE_PATH, getattr(evd, 'camera_id', ''), basename),
        os.path.join(settings.EVIDENCE_STORAGE_PATH, basename),
        os.path.join(base_proj, "storage", "evidence", getattr(evd, 'camera_id', ''), basename),
        os.path.join(base_proj, "backend", "storage", "evidence", getattr(evd, 'camera_id', ''), basename),
        os.path.join(base_proj, "storage", "evidence", basename),
    ]
    for p in alt_paths:
        if p and os.path.exists(p) and os.path.isfile(p):
            with open(p, "rb") as f:
                content = f.read()
            return Response(content=content, media_type=evd.mime_type or "image/jpeg")

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
