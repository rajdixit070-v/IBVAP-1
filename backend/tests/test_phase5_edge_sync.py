import pytest
import uuid
import json
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.edge_node import EdgeNode
from app.models.edge_event_buffer import EdgeEventBuffer
from app.models.security_event import SecurityEvent
from app.schemas.edge import EdgeHeartbeatRequest, EdgeSyncBatchRequest, EdgeSyncEventItem
from app.services.edge.node_manager import edge_node_manager
from app.services.edge.sync_engine import edge_sync_engine

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    yield db
    db.close()

def test_edge_node_registration_and_list(db_session, auth_headers):
    """Test registering a new Edge Node and querying it via API."""
    unique_nid = f"EDGE-TEST-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "node_id": unique_nid,
        "name": "Test Outpost Node",
        "bop_site": "BOP Delta",
        "location": "Post 9",
        "software_version": "1.0.0",
        "hardware_info": "NVIDIA Jetson Orin Nano",
        "low_bandwidth_mode": False
    }

    res = client.post("/api/v1/edge/nodes", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["node_id"] == unique_nid
    assert data["status"] == "ONLINE"

    # List
    list_res = client.get("/api/v1/edge/nodes", headers=auth_headers)
    assert list_res.status_code == 200
    nodes = list_res.json()
    assert any(n["node_id"] == unique_nid for n in nodes)

def test_edge_heartbeat_telemetry_and_audit(db_session, auth_headers):
    """Test sending heartbeat telemetry and offline state detection."""
    hb = EdgeHeartbeatRequest(
        node_id="EDGE-BOP-001",
        status="ONLINE",
        cpu_percent=45.5,
        memory_percent=60.0,
        disk_percent=38.0,
        gpu_percent=52.0,
        active_cameras_count=2,
        total_cameras_count=2,
        queued_events_count=5,
        config_version=1,
        latency_ms=31.2,
        low_bandwidth_mode=False
    )

    res = client.post("/api/v1/edge/heartbeat", json=hb.model_dump(), headers=auth_headers)
    assert res.status_code == 200
    ack = res.json()
    assert ack["status"] == "ONLINE"
    assert ack["node_id"] == "EDGE-BOP-001"
    assert ack["sync_status"] == "SYNCING"

    # Verify database was updated
    node = db_session.query(EdgeNode).filter(EdgeNode.node_id == "EDGE-BOP-001").first()
    assert node.cpu_percent == 45.5
    assert node.latency_ms == 31.2

def test_durable_offline_store_and_forward_buffer(db_session):
    """Test buffering events in durable local storage on edge node."""
    node_id = f"EDGE-BUFFER-{uuid.uuid4().hex[:6].upper()}"
    event_id = f"EVT-OFFLINE-{uuid.uuid4().hex[:8].upper()}"

    buf = edge_sync_engine.buffer_local_event(
        node_id=node_id,
        event_id=event_id,
        camera_id="CAM-001",
        event_type="ZONE_INTRUSION",
        priority="CRITICAL",
        payload={"risk_score": 90, "details": "Border Wire breach while offline"}
    )

    assert buf.id is not None
    assert buf.sync_status == "PENDING"
    assert buf.priority == "CRITICAL"

    # Verify query
    pending = edge_sync_engine.get_pending_sync_batch(node_id)
    assert any(p.event_id == event_id for p in pending)

def test_idempotent_sync_batch_ingestion(db_session, auth_headers):
    """Test idempotent batch synchronization: resending the same event does not produce duplicates."""
    node_id = "EDGE-BOP-001"
    shared_event_id = f"EVT-IDEM-{uuid.uuid4().hex[:8].upper()}"

    sync_item = EdgeSyncEventItem(
        event_id=shared_event_id,
        camera_id="CAM-001",
        track_id=101,
        object_type="person",
        event_type="RESTRICTED_ZONE_INTRUSION",
        severity="CRITICAL",
        risk_score=92,
        risk_level="CRITICAL",
        priority="CRITICAL",
        factors_json=json.dumps([{"factor": "ZONE_INTRUSION", "weight": 35, "description": "Zone intrusion"}]),
        timeline_json=json.dumps([]),
        timestamp=datetime.utcnow()
    )

    batch_req = EdgeSyncBatchRequest(
        node_id=node_id,
        events=[sync_item],
        batch_timestamp=datetime.utcnow()
    )

    # First sync pass: should ingest cleanly
    res1 = client.post("/api/v1/edge/sync", json=json.loads(batch_req.json()), headers=auth_headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert shared_event_id in data1["synced_ids"]
    assert len(data1["duplicate_ids"]) == 0

    # Second sync pass: resending the identical batch should be treated idempotently as duplicate
    res2 = client.post("/api/v1/edge/sync", json=json.loads(batch_req.json()), headers=auth_headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert shared_event_id in data2["duplicate_ids"]
    assert len(data2["synced_ids"]) == 0

    # Verify exactly 1 record exists in central SecurityEvent table
    matches = db_session.query(SecurityEvent).filter(SecurityEvent.event_id == shared_event_id).all()
    assert len(matches) == 1

def test_priority_ordered_sync_batch(db_session):
    """Test that critical priority events are ordered before lower priority events."""
    node_id = f"EDGE-PRIO-{uuid.uuid4().hex[:6].upper()}"
    low_id = f"EVT-LOW-{uuid.uuid4().hex[:6].upper()}"
    crit_id = f"EVT-CRIT-{uuid.uuid4().hex[:6].upper()}"

    # Buffer LOW first, then CRITICAL
    edge_sync_engine.buffer_local_event(node_id, low_id, "CAM-001", "SUSPICIOUS_LOITERING", "LOW", {})
    edge_sync_engine.buffer_local_event(node_id, crit_id, "CAM-001", "ZONE_INTRUSION", "CRITICAL", {})

    # Retrieve pending batch
    batch = edge_sync_engine.get_pending_sync_batch(node_id, batch_size=10)
    assert len(batch) >= 2
    # CRITICAL should be first in queue
    assert batch[0].event_id == crit_id
    assert batch[1].event_id == low_id

def test_remote_config_versioning_and_low_bandwidth(db_session, auth_headers):
    """Test updating remote config increments config_version and toggles low_bandwidth_mode."""
    node_id = "EDGE-BOP-001"
    node_before = db_session.query(EdgeNode).filter(EdgeNode.node_id == node_id).first()
    v_before = node_before.config_version

    res = client.put(f"/api/v1/edge/nodes/{node_id}/config", json={
        "low_bandwidth_mode": True,
        "inference_fps": 6.0,
        "sync_batch_size": 15
    }, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["low_bandwidth_mode"] is True
    assert data["config_version"] == v_before + 1

def test_sync_stats_endpoint(db_session, auth_headers):
    """Test /api/v1/edge/sync/stats returns aggregated metrics."""
    res = client.get("/api/v1/edge/sync/stats", headers=auth_headers)
    assert res.status_code == 200
    stats = res.json()
    assert "total_synced" in stats
    assert "pending_sync" in stats
    assert "nodes_online" in stats
    assert stats["nodes_online"] >= 1
