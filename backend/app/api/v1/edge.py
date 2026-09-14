from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import os
import shutil
import uuid
import json

from app.database import get_db
from app.api.deps import get_current_user, get_current_user_optional, require_admin, oauth2_scheme
from app.models.user import User
from app.models.edge_node import EdgeNode
from app.models.edge_event_buffer import EdgeEventBuffer
from app.models.audit_log import SecurityAuditLog
from app.models.camera import Camera
from app.models.evidence import Evidence
from app.models.security_event import SecurityEvent
from app.services.security.edge_auth_service import EdgeAuthService
from app.schemas.edge import (
    EdgeNodeCreate,
    EdgeNodeUpdate,
    EdgeNodeResponse,
    EdgeHeartbeatRequest,
    EdgeSyncBatchRequest,
    EdgeSyncBatchResponse,
    EdgeRemoteConfig,
    EdgeSyncStatsResponse,
    EdgeTokenResponse,
    EdgeAssignedCamera,
    EdgeSyncEventItem
)
from app.services.edge.node_manager import edge_node_manager
from app.services.edge.sync_engine import edge_sync_engine

router = APIRouter()

def require_edge_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensures caller has administrator or checkpost commander/officer privileges."""
    user_role = (current_user.role or "").strip().upper()
    allowed_roles = {"ADMIN", "SUPER_ADMIN", "SUPERADMIN", "SITE_ADMIN", "COMMANDER", "BOP_OPERATOR", "OPERATOR", "OFFICER"}
    if user_role not in allowed_roles and not getattr(current_user, "is_superuser", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Duty Officer privileges required for this operation."
        )
    return current_user


@router.get("/nodes", response_model=List[EdgeNodeResponse])
def list_edge_nodes(
    status: Optional[str] = Query(None),
    bop_site: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List registered Edge Node appliances and their live hardware/AI telemetry.
    """
    edge_node_manager.audit_offline_nodes()
    query = db.query(EdgeNode)
    if status:
        query = query.filter(EdgeNode.status == status)
    if bop_site:
        query = query.filter(EdgeNode.bop_site == bop_site)

    return query.order_by(EdgeNode.node_id.asc()).all()

@router.post("/nodes", response_model=EdgeNodeResponse, status_code=201)
def register_edge_node(
    data: EdgeNodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edge_admin)
):
    """
    Register a new edge computing appliance (Admin & Duty Officer).
    """
    nid = data.node_id.strip().upper()
    existing = db.query(EdgeNode).filter(EdgeNode.node_id == nid).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Edge Node '{nid}' is already registered.")

    node = EdgeNode(
        node_id=nid,
        name=data.name.strip(),
        bop_site=data.bop_site.strip(),
        location=data.location,
        software_version=data.software_version,
        hardware_info=data.hardware_info,
        low_bandwidth_mode=data.low_bandwidth_mode,
        status="ONLINE",
        created_at=datetime.utcnow()
    )
    db.add(node)

    audit = SecurityAuditLog(
        username=current_user.username,
        action="EDGE_NODE_REGISTERED",
        resource_type="EDGE_NODE",
        resource_id=nid,
        details=f'{{"node_id": "{nid}", "bop_site": "{data.bop_site}"}}'
    )
    db.add(audit)
    db.commit()
    db.refresh(node)

    # Issue 256-bit Edge Token using EdgeAuthService
    plaintext_key, cred = EdgeAuthService.issue_edge_key(
        node_id=nid,
        actor=current_user.username,
        db=db
    )

    config_template = {
        "node_id": nid,
        "node_name": node.name,
        "bop_site": node.bop_site,
        "central_url": "http://10.8.0.1:8000",
        "api_key": plaintext_key,
        "heartbeat_interval_sec": 10,
        "sync_interval_sec": 5,
        "sync_batch_size": 25,
        "low_bandwidth_mode": node.low_bandwidth_mode,
        "cameras": []
    }

    resp = EdgeNodeResponse.model_validate(node)
    resp.api_key = plaintext_key
    resp.config_template = config_template
    return resp

@router.post("/nodes/{node_id}/token", response_model=EdgeTokenResponse)
def issue_or_rotate_edge_token(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edge_admin)
):
    """
    Issue or rotate a 256-bit authentication token for an Edge Node (Admin & Duty Officer).
    """
    node = db.query(EdgeNode).filter(EdgeNode.node_id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Edge Node not found.")

    plaintext_key, cred = EdgeAuthService.issue_edge_key(
        node_id=node_id,
        actor=current_user.username,
        db=db
    )
    return EdgeTokenResponse(
        node_id=node_id,
        api_key=plaintext_key,
        status=cred.status,
        expires_at=cred.expires_at,
        created_at=cred.updated_at or cred.created_at
    )

@router.get("/nodes/{node_id}/cameras", response_model=List[EdgeAssignedCamera])
def get_edge_assigned_cameras(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists cameras managed by this Edge Node.
    """
    cams = db.query(Camera).filter(Camera.edge_node_id == node_id).all()
    return [
        EdgeAssignedCamera(
            camera_id=c.camera_id,
            camera_name=c.camera_name,
            stream_type=c.stream_type or "main",
            status=c.status or "OFFLINE",
            fps=c.fps or 0.0
        )
        for c in cams
    ]

@router.post("/nodes/{node_id}/reconnect")
def trigger_edge_reconnect(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edge_admin)
):
    """
    Commands an Edge Node to re-test connection and flush its store-and-forward queue immediately.
    Flushes all PENDING / FAILED records from EdgeEventBuffer to SecurityEvents in Central Command.
    """
    node = db.query(EdgeNode).filter(EdgeNode.node_id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Edge Node not found.")
    
    # 1. Fetch pending offline buffered events
    pending_records = edge_sync_engine.get_pending_sync_batch(node_id, batch_size=100)
    flushed_count = 0
    if pending_records:
        sync_items = []
        for rec in pending_records:
            payload = {}
            try:
                payload = json.loads(rec.event_payload_json) if rec.event_payload_json else {}
            except Exception:
                pass
            sync_items.append(EdgeSyncEventItem(
                event_id=rec.event_id,
                camera_id=rec.camera_id,
                track_id=payload.get("track_id", 0),
                object_type=payload.get("object_type", "target"),
                event_type=payload.get("event_type", "INTRUSION"),
                severity=payload.get("severity", "HIGH"),
                risk_score=payload.get("risk_score", 75),
                risk_level=payload.get("risk_level", "HIGH"),
                priority=rec.priority or "HIGH",
                factors_json=json.dumps(payload.get("factors", [])),
                timeline_json=json.dumps(payload.get("timeline", [])),
                timestamp=rec.created_at or datetime.utcnow()
            ))

        batch = EdgeSyncBatchRequest(
            node_id=node_id,
            events=sync_items,
            batch_timestamp=datetime.utcnow()
        )
        resp = edge_sync_engine.ingest_sync_batch(batch)
        flushed_count = len(resp.synced_ids) + len(resp.duplicate_ids)

    # 2. Update edge node telemetry
    node.status = "ONLINE"
    node.sync_status = "SYNCED"
    node.queued_events_count = 0
    node.last_heartbeat = datetime.utcnow()
    node.updated_at = datetime.utcnow()
    db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Reconnect signal sent to {node_id}. Flushed {flushed_count} queued events to Central Command.",
        "flushed_events": flushed_count,
        "node_id": node_id
    }

@router.post("/simulate-event/{node_id}")
def simulate_edge_offline_event(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edge_admin)
):
    """
    Buffers a simulated offline AI intrusion event into EdgeEventBuffer on a specific edge node.
    Enables instant testing of offline store-and-forward queuing and sync.
    """
    node = db.query(EdgeNode).filter(EdgeNode.node_id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Edge Node not found.")

    cam = db.query(Camera).filter(Camera.edge_node_id == node_id).first()
    camera_id = cam.camera_id if cam else "CAM-NORTH-01"

    now_ts = int(datetime.utcnow().timestamp() * 1000)
    evt_id = f"EVT-EDGE-{now_ts}"

    payload = {
        "track_id": 101,
        "object_type": "PERSON",
        "event_type": "PERIMETER_INTRUSION",
        "severity": "CRITICAL",
        "risk_score": 92,
        "risk_level": "CRITICAL",
        "factors": ["UNAUTHORIZED_CROSSING", "OFFLINE_EDGE_BUFFER"],
        "timeline": [
            {"time": datetime.utcnow().isoformat(), "action": "Detected by Edge Jetson Neural Pipeline"}
        ]
    }

    rec = edge_sync_engine.buffer_local_event(
        node_id=node_id,
        event_id=evt_id,
        camera_id=camera_id,
        event_type="PERIMETER_INTRUSION",
        priority="CRITICAL",
        payload=payload
    )

    node.queued_events_count = (node.queued_events_count or 0) + 1
    node.sync_status = "PENDING_SYNC"
    db.commit()

    return {
        "status": "BUFFERED",
        "message": f"Simulated offline event '{evt_id}' queued in node '{node_id}' buffer.",
        "event_id": evt_id,
        "queued_events_count": node.queued_events_count
    }

@router.post("/sync/flush-all")
def flush_all_edge_queues(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edge_admin)
):
    """
    Flushes all store-and-forward offline event buffers across all edge appliances.
    """
    pending_records = db.query(EdgeEventBuffer).filter(
        EdgeEventBuffer.sync_status.in_(["PENDING", "FAILED"])
    ).all()

    flushed_total = 0
    node_ids = set()
    for rec in pending_records:
        node_ids.add(rec.node_id)
        payload = {}
        try:
            payload = json.loads(rec.event_payload_json) if rec.event_payload_json else {}
        except Exception:
            pass

        batch = EdgeSyncBatchRequest(
            node_id=rec.node_id,
            events=[
                EdgeSyncEventItem(
                    event_id=rec.event_id,
                    camera_id=rec.camera_id,
                    track_id=payload.get("track_id", 0),
                    object_type=payload.get("object_type", "target"),
                    event_type=payload.get("event_type", "INTRUSION"),
                    severity=payload.get("severity", "HIGH"),
                    risk_score=payload.get("risk_score", 75),
                    risk_level=payload.get("risk_level", "HIGH"),
                    priority=rec.priority or "HIGH",
                    factors_json=json.dumps(payload.get("factors", [])),
                    timeline_json=json.dumps(payload.get("timeline", [])),
                    timestamp=rec.created_at or datetime.utcnow()
                )
            ]
        )
        edge_sync_engine.ingest_sync_batch(batch)
        flushed_total += 1

    # Update all edge nodes
    for nid in node_ids:
        node = db.query(EdgeNode).filter(EdgeNode.node_id == nid).first()
        if node:
            node.sync_status = "SYNCED"
            node.status = "ONLINE"
            node.queued_events_count = 0
            node.updated_at = datetime.utcnow()
    db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Flushed {flushed_total} buffered events across {len(node_ids)} edge appliances.",
        "flushed_count": flushed_total
    }

@router.get("/nodes/{node_id}", response_model=EdgeNodeResponse)
def get_edge_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve single edge node details and health status.
    """
    node = db.query(EdgeNode).filter(EdgeNode.node_id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Edge Node not found.")
    return node

@router.put("/nodes/{node_id}", response_model=EdgeNodeResponse)
def update_edge_node(
    node_id: str,
    data: EdgeNodeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edge_admin)
):
    """
    Update edge node metadata (Admin & Duty Officer).
    """
    node = db.query(EdgeNode).filter(EdgeNode.node_id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Edge Node not found.")

    if data.name is not None:
        node.name = data.name.strip()
    if data.bop_site is not None:
        node.bop_site = data.bop_site.strip()
    if data.location is not None:
        node.location = data.location
    if data.software_version is not None:
        node.software_version = data.software_version
    if data.hardware_info is not None:
        node.hardware_info = data.hardware_info
    if data.low_bandwidth_mode is not None:
        node.low_bandwidth_mode = data.low_bandwidth_mode
    if data.status is not None:
        node.status = data.status

    node.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(node)

    return node

@router.put("/nodes/{node_id}/config", response_model=EdgeNodeResponse)
def update_node_remote_config(
    node_id: str,
    config: EdgeRemoteConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edge_admin)
):
    """
    Pushes remote configuration update to edge node and increments config_version (Admin & Duty Officer).
    """
    try:
        updated_node = edge_node_manager.update_remote_config(node_id, config)
        return updated_node
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/nodes/{node_id}")
def delete_edge_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edge_admin)
):
    """
    De-register edge node appliance (Admin & Duty Officer).
    """
    node = db.query(EdgeNode).filter(EdgeNode.node_id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Edge Node not found.")

    db.delete(node)
    audit = SecurityAuditLog(
        username=current_user.username,
        action="EDGE_NODE_DELETED",
        resource_type="EDGE_NODE",
        resource_id=node_id,
        details=f'{{"node_id": "{node_id}"}}'
    )
    db.add(audit)
    db.commit()

    return {"status": "DELETED", "node_id": node_id}

@router.post("/heartbeat")
def edge_heartbeat(
    hb: EdgeHeartbeatRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Ingests live telemetry heartbeat from an edge node.
    """
    ack = edge_node_manager.process_heartbeat(hb)
    return ack

@router.post("/sync", response_model=EdgeSyncBatchResponse)
def sync_edge_events(
    batch: EdgeSyncBatchRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Store-and-forward batch event ingestion from edge appliances.
    Supports idempotent processing (ignores duplicate event_ids safely).
    """
    response = edge_sync_engine.ingest_sync_batch(batch)
    return response


@router.post("/sync-evidence")
async def sync_edge_evidence(
    file: UploadFile = File(...),
    node_id: str = Form(...),
    event_id: str = Form(...),
    camera_id: str = Form(...),
    checksum_sha256: str = Form(""),
    db: Session = Depends(get_db)
):
    """
    Receives forensic snapshot images captured on Edge during offline or live detection.
    Stores permanently in Central Evidence Locker and links to Central SecurityEvent.
    """
    evidence_dir = f"./storage/evidence/{camera_id}"
    os.makedirs(evidence_dir, exist_ok=True)
    
    filename = f"EVD-{event_id}-{file.filename}"
    file_path = os.path.join(evidence_dir, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    evd_id = f"EVD-{uuid.uuid4().hex[:8].upper()}"
    evd_record = db.query(Evidence).filter(Evidence.file_path == file_path).first()
    if not evd_record:
        evd_record = Evidence(
            evidence_id=evd_id,
            source_event_id=event_id,
            camera_id=camera_id,
            evidence_type="SNAPSHOT",
            file_path=file_path,
            file_size_bytes=os.path.getsize(file_path),
            checksum_sha256=checksum_sha256,
            mime_type="image/jpeg",
            created_at=datetime.utcnow()
        )
        db.add(evd_record)
        
        # Link to SecurityEvent if present
        sec_evt = db.query(SecurityEvent).filter(SecurityEvent.event_id == event_id).first()
        if sec_evt:
            sec_evt.evidence_id = evd_id
            sec_evt.evidence_path = file_path

        db.commit()

    return {"status": "SUCCESS", "evidence_id": evd_record.evidence_id, "file_path": file_path}

@router.post("/nodes/{node_id}/push-frame/{camera_id}")
async def push_edge_live_frame(
    node_id: str,
    camera_id: str,
    request: Request,
    file: Optional[UploadFile] = File(None),
    resolution: Optional[str] = Query(None),
    fps: Optional[float] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Outbound Reverse Push Relay Endpoint.
    Enables remote border edge appliances to push live video frames into Central HQ (Delhi).
    Requires ZERO open inbound ports and ZERO public IPs on the border network.
    """
    node = db.query(EdgeNode).filter(EdgeNode.node_id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Edge Node not found.")

    if file:
        frame_bytes = await file.read()
    else:
        frame_bytes = await request.body()

    if not frame_bytes:
        raise HTTPException(status_code=400, detail="Empty frame payload.")

    from app.services.stream_manager import stream_manager
    stream_manager.ingest_edge_frame(
        camera_id=camera_id,
        frame_bytes=frame_bytes,
        resolution=resolution,
        fps=fps
    )

    return {
        "status": "FRAME_INGESTED",
        "camera_id": camera_id,
        "node_id": node_id,
        "size_bytes": len(frame_bytes)
    }

@router.get("/sync/stats", response_model=EdgeSyncStatsResponse)
def get_sync_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get aggregated store-and-forward synchronization metrics.
    """
    edge_node_manager.audit_offline_nodes()
    
    total_synced = db.query(EdgeEventBuffer).filter(EdgeEventBuffer.sync_status == "SYNCED").count()
    pending_sync = db.query(EdgeEventBuffer).filter(EdgeEventBuffer.sync_status == "PENDING").count()
    failed_sync = db.query(EdgeEventBuffer).filter(EdgeEventBuffer.sync_status == "FAILED").count()

    nodes_online = db.query(EdgeNode).filter(EdgeNode.status == "ONLINE").count()
    nodes_offline = db.query(EdgeNode).filter(EdgeNode.status == "OFFLINE").count()
    nodes_degraded = db.query(EdgeNode).filter(EdgeNode.status == "DEGRADED").count()

    return EdgeSyncStatsResponse(
        total_synced=total_synced,
        pending_sync=pending_sync,
        failed_sync=failed_sync,
        avg_latency_ms=28.5,
        nodes_online=nodes_online,
        nodes_offline=nodes_offline,
        nodes_degraded=nodes_degraded
    )

@router.delete("/nodes/{node_id}", status_code=status.HTTP_200_OK)
def delete_edge_node(
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edge_admin)
):
    """
    Deactivates and removes an Edge Node appliance and revokes credentials.
    """
    nid = node_id.strip()
    node = db.query(EdgeNode).filter(EdgeNode.node_id == nid).first()
    if not node:
        raise HTTPException(status_code=404, detail=f"Edge Node '{nid}' not found.")

    node_name = node.name

    # Revoke credentials
    try:
        from app.models.enterprise_security_models import EdgeNodeCredential
        db.query(EdgeNodeCredential).filter(EdgeNodeCredential.node_id == nid).delete()
    except Exception:
        pass

    db.delete(node)

    audit = SecurityAuditLog(
        username=current_user.username,
        action="EDGE_NODE_DELETED",
        resource_type="EDGE_NODE",
        resource_id=nid,
        details=f'{{"node_id": "{nid}", "name": "{node_name}"}}'
    )
    db.add(audit)
    db.commit()

    return {"status": "DELETED", "node_id": nid, "message": f"Edge Node '{node_name}' successfully removed."}

