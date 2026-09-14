import json
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.bop_dispatch import BOPDispatch
from app.models.evidence import Evidence
from app.models.notification import Notification
from app.models.federation_models import SiteUserScope
from app.schemas.dispatch_schemas import (
    BOPDispatchCreate,
    BOPDispatchAcknowledge,
    BOPDispatchResponse,
    QuickEvidenceSend
)
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/dispatches", tags=["BOP Dispatches & Daily SITREPs"])

def get_user_bop(user: User, db: Session) -> str:
    scope = db.query(SiteUserScope).filter(SiteUserScope.username == user.username).first()
    if scope and scope.scope_id and scope.scope_id != "*":
        return scope.scope_id
    return "BOP-ALPHA"

@router.get("", response_model=List[BOPDispatchResponse])
@router.get("/", response_model=List[BOPDispatchResponse])
def list_dispatches(
    bop_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists outbound/inbound outpost SITREPs and evidence dispatches.
    Central Admin sees all outposts. Scoped Officers see their assigned BOP.
    """
    query = db.query(BOPDispatch)
    
    # If not Super Admin, constrain to user's assigned BOP
    is_super = str(current_user.role or '').upper() in ["ADMIN", "SUPER_ADMIN", "SUPERADMIN", "CENTRAL_ADMIN", "SITE_ADMIN"]
    if not is_super:
        user_bop = get_user_bop(current_user, db)
        query = query.filter(BOPDispatch.bop_id == user_bop)
    elif bop_id and bop_id != "ALL":
        query = query.filter(BOPDispatch.bop_id == bop_id)
        
    if status_filter and status_filter != "ALL":
        query = query.filter(BOPDispatch.status == status_filter)
    if priority and priority != "ALL":
        query = query.filter(BOPDispatch.priority == priority)
        
    dispatches = query.order_by(BOPDispatch.created_at.desc()).limit(limit).all()
    
    # Enrich with evidence objects
    result = []
    for d in dispatches:
        d_dict = {c.name: getattr(d, c.name) for c in d.__table__.columns}
        ev_ids = []
        try:
            ev_ids = json.loads(d.evidence_ids) if d.evidence_ids else []
        except Exception:
            ev_ids = []
        
        evidence_records = db.query(Evidence).filter(Evidence.evidence_id.in_(ev_ids)).all() if ev_ids else []
        d_dict["evidence_items"] = [{c.name: getattr(ev, c.name) for c in ev.__table__.columns} for ev in evidence_records]
        result.append(d_dict)
        
    return result

@router.post("", response_model=BOPDispatchResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=BOPDispatchResponse, status_code=status.HTTP_201_CREATED)
def create_daily_sitrep_dispatch(
    dispatch_in: BOPDispatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates and submits a daily situation report (SITREP) or evidence dispatch from a Border Outpost to HQ Admin.
    """
    user_bop = dispatch_in.bop_id or get_user_bop(current_user, db)
    timestamp_str = datetime.utcnow().strftime("%Y%m%d-%H%M")
    dispatch_uid = f"DISP-{timestamp_str}-{uuid.uuid4().hex[:6].upper()}"
    
    ev_ids_json = json.dumps(dispatch_in.evidence_ids or [])
    
    new_disp = BOPDispatch(
        dispatch_id=dispatch_uid,
        bop_id=user_bop,
        site_id=dispatch_in.site_id or "SITE-BORDER-NORTH",
        officer_username=current_user.username,
        title=dispatch_in.title,
        summary=dispatch_in.summary,
        priority=dispatch_in.priority or "ROUTINE",
        status="SENT_TO_HQ",
        detected_persons_count=dispatch_in.detected_persons_count or 0,
        vehicles_scanned_count=dispatch_in.vehicles_scanned_count or 0,
        alerts_count=dispatch_in.alerts_count or 0,
        evidence_ids=ev_ids_json,
        created_at=datetime.utcnow()
    )
    db.add(new_disp)
    
    # Send High-Priority Notification to Central Admin
    admin_notif = Notification(
        user_id="all",
        title=f"📡 INBOUND SITREP: {user_bop} - {dispatch_in.title}",
        message=f"Officer {current_user.username} submitted SITREP with {dispatch_in.detected_persons_count} persons detected, {dispatch_in.vehicles_scanned_count} vehicles scanned, and {len(dispatch_in.evidence_ids or [])} attached evidence records.",
        priority="HIGH" if dispatch_in.priority in ["URGENT", "FLASH"] else "NORMAL",
        read=False,
        location_description=user_bop,
        created_at=datetime.utcnow()
    )
    db.add(admin_notif)
    db.commit()
    db.refresh(new_disp)
    
    d_dict = {c.name: getattr(new_disp, c.name) for c in new_disp.__table__.columns}
    ev_ids = dispatch_in.evidence_ids or []
    if ev_ids:
        evidence_records = db.query(Evidence).filter(Evidence.evidence_id.in_(ev_ids)).all()
        d_dict["evidence_items"] = [{c.name: getattr(ev, c.name) for c in ev.__table__.columns} for ev in evidence_records]
    else:
        d_dict["evidence_items"] = []
    return d_dict

@router.post("/quick-send-evidence", response_model=BOPDispatchResponse, status_code=status.HTTP_201_CREATED)
def quick_send_evidence_to_hq(
    req: QuickEvidenceSend,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Instantly dispatches a single forensic evidence record (photo/video) directly to Central HQ Admin.
    """
    evd = db.query(Evidence).filter(Evidence.evidence_id == req.evidence_id).first()
    if not evd:
        raise HTTPException(status_code=404, detail=f"Evidence record '{req.evidence_id}' not found.")
        
    user_bop = get_user_bop(current_user, db)
    timestamp_str = datetime.utcnow().strftime("%Y%m%d-%H%M")
    dispatch_uid = f"EVD-DISP-{timestamp_str}-{uuid.uuid4().hex[:5].upper()}"
    
    title = f"PRIORITY EVIDENCE: {evd.evidence_type} from {evd.camera_id}"
    summary = req.officer_notes or f"Officer {current_user.username} flagged evidence {evd.evidence_id} (SHA-256: {evd.checksum_sha256[:12] if evd.checksum_sha256 else 'N/A'}...) for immediate HQ scrutiny."
    
    new_disp = BOPDispatch(
        dispatch_id=dispatch_uid,
        bop_id=user_bop,
        site_id="SITE-BORDER-NORTH",
        officer_username=current_user.username,
        title=title,
        summary=summary,
        priority=req.priority or "URGENT",
        status="SENT_TO_HQ",
        detected_persons_count=1 if "FACE" in evd.evidence_type else 0,
        vehicles_scanned_count=1 if "PLATE" in evd.evidence_type else 0,
        alerts_count=1,
        evidence_ids=json.dumps([evd.evidence_id]),
        created_at=datetime.utcnow()
    )
    db.add(new_disp)
    
    admin_notif = Notification(
        user_id="all",
        title=f"🚨 EVIDENCE DISPATCH: {user_bop} - {evd.camera_id}",
        message=f"Officer {current_user.username} transmitted evidence {evd.evidence_id} ({evd.evidence_type}) to Headquarters.",
        priority="HIGH",
        read=False,
        evidence_id=evd.evidence_id,
        camera_id=evd.camera_id,
        location_description=user_bop,
        created_at=datetime.utcnow()
    )
    db.add(admin_notif)
    db.commit()
    db.refresh(new_disp)
    
    d_dict = {c.name: getattr(new_disp, c.name) for c in new_disp.__table__.columns}
    d_dict["evidence_items"] = [{c.name: getattr(evd, c.name) for c in evd.__table__.columns}]
    return d_dict

@router.get("/{dispatch_id}", response_model=BOPDispatchResponse)
def get_single_dispatch(
    dispatch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve single dispatch details including linked evidence items.
    """
    disp = db.query(BOPDispatch).filter(BOPDispatch.dispatch_id == dispatch_id).first()
    if not disp:
        raise HTTPException(status_code=404, detail=f"Dispatch '{dispatch_id}' not found.")
        
    d_dict = {c.name: getattr(disp, c.name) for c in disp.__table__.columns}
    ev_ids = []
    try:
        ev_ids = json.loads(disp.evidence_ids) if disp.evidence_ids else []
    except Exception:
        ev_ids = []
    ev_records = db.query(Evidence).filter(Evidence.evidence_id.in_(ev_ids)).all() if ev_ids else []
    d_dict["evidence_items"] = [{c.name: getattr(ev, c.name) for c in ev.__table__.columns} for ev in ev_records]
    return d_dict

@router.post("/{dispatch_id}/acknowledge", response_model=BOPDispatchResponse)
def acknowledge_dispatch(
    dispatch_id: str,
    ack: BOPDispatchAcknowledge,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Central Admin acknowledges the dispatch and issues response orders/directives back to the outpost.
    """
    disp = db.query(BOPDispatch).filter(BOPDispatch.dispatch_id == dispatch_id).first()
    if not disp:
        raise HTTPException(status_code=404, detail=f"Dispatch '{dispatch_id}' not found.")
        
    disp.status = ack.status or "ACKNOWLEDGED_BY_HQ"
    disp.hq_notes = ack.hq_notes
    disp.acknowledged_by = admin_user.username
    disp.acknowledged_at = datetime.utcnow()
    
    # Notify the sending officer
    officer_notif = Notification(
        user_id=disp.officer_username,
        title=f"📋 HQ DIRECTIVE ISSUED: {disp.dispatch_id}",
        message=f"Headquarters ({admin_user.username}) reviewed your SITREP: '{ack.hq_notes}'",
        priority="NORMAL",
        read=False,
        location_description=disp.bop_id,
        created_at=datetime.utcnow()
    )
    db.add(officer_notif)
    db.commit()
    db.refresh(disp)
    
    d_dict = {c.name: getattr(disp, c.name) for c in disp.__table__.columns}
    ev_ids = []
    try:
        ev_ids = json.loads(disp.evidence_ids) if disp.evidence_ids else []
    except Exception:
        ev_ids = []
    ev_records = db.query(Evidence).filter(Evidence.evidence_id.in_(ev_ids)).all() if ev_ids else []
    d_dict["evidence_items"] = [{c.name: getattr(ev, c.name) for c in ev.__table__.columns} for ev in ev_records]
    return d_dict
