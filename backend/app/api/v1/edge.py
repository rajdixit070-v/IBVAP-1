from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.edge_node import EdgeNode
from app.models.edge_event_buffer import EdgeEventBuffer
from app.models.audit_log import SecurityAuditLog
from app.schemas.edge import (
    EdgeNodeCreate,
    EdgeNodeUpdate,
    EdgeNodeResponse,
    EdgeHeartbeatRequest,
    EdgeSyncBatchRequest,
    EdgeSyncBatchResponse,
    EdgeRemoteConfig,
    EdgeSyncStatsResponse
)
from app.services.edge.node_manager import edge_node_manager
from app.services.edge.sync_engine import edge_sync_engine

router = APIRouter()

@router.get("/nodes", response_model=List[EdgeNodeResponse])
def list_edge_nodes(
    status: Optional[str] = Query(None),
    bop_site: Optional[str] = Query(None),
    db: Session = Depends(get_db)
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
def register_edge_node(data: EdgeNodeCreate, db: Session = Depends(get_db)):
    """
    Register a new edge computing appliance.
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
        username="operator",
        action="EDGE_NODE_REGISTERED",
        resource_type="EDGE_NODE",
        resource_id=nid,
        details=f'{{"node_id": "{nid}", "bop_site": "{data.bop_site}"}}'
    )
    db.add(audit)
    db.commit()
    db.refresh(node)

    return node

@router.get("/nodes/{node_id}", response_model=EdgeNodeResponse)
def get_edge_node(node_id: str, db: Session = Depends(get_db)):
    """
    Retrieve single edge node details and health status.
    """
    node = db.query(EdgeNode).filter(EdgeNode.node_id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Edge Node not found.")
    return node

@router.put("/nodes/{node_id}", response_model=EdgeNodeResponse)
def update_edge_node(node_id: str, data: EdgeNodeUpdate, db: Session = Depends(get_db)):
    """
    Update edge node metadata.
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
def update_node_remote_config(node_id: str, config: EdgeRemoteConfig, db: Session = Depends(get_db)):
    """
    Pushes remote configuration update to edge node and increments config_version.
    """
    try:
        updated_node = edge_node_manager.update_remote_config(node_id, config)
        return updated_node
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/nodes/{node_id}")
def delete_edge_node(node_id: str, db: Session = Depends(get_db)):
    """
    De-register edge node appliance.
    """
    node = db.query(EdgeNode).filter(EdgeNode.node_id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Edge Node not found.")

    db.delete(node)
    audit = SecurityAuditLog(
        username="operator",
        action="EDGE_NODE_DELETED",
        resource_type="EDGE_NODE",
        resource_id=node_id,
        details=f'{{"node_id": "{node_id}"}}'
    )
    db.add(audit)
    db.commit()

    return {"status": "DELETED", "node_id": node_id}

@router.post("/heartbeat")
def edge_heartbeat(hb: EdgeHeartbeatRequest):
    """
    Ingests live telemetry heartbeat from an edge node.
    """
    ack = edge_node_manager.process_heartbeat(hb)
    return ack

@router.post("/sync", response_model=EdgeSyncBatchResponse)
def sync_edge_events(batch: EdgeSyncBatchRequest):
    """
    Store-and-forward batch event ingestion from edge appliances.
    Supports idempotent processing (ignores duplicate event_ids safely).
    """
    response = edge_sync_engine.ingest_sync_batch(batch)
    return response

@router.get("/sync/stats", response_model=EdgeSyncStatsResponse)
def get_sync_stats(db: Session = Depends(get_db)):
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
