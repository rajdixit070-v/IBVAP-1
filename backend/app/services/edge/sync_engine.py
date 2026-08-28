import json
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import case

from app.database import SessionLocal
from app.models.edge_event_buffer import EdgeEventBuffer
from app.models.security_event import SecurityEvent
from app.schemas.edge import EdgeSyncBatchRequest, EdgeSyncBatchResponse, EdgeSyncEventItem
from app.services.intelligence.event_manager import security_event_manager

logger = logging.getLogger("ibvap.edge.sync_engine")

class EdgeSyncEngine:
    """
    Store-and-Forward Prioritized Synchronization Engine & Idempotent Central Ingestion.
    """

    def buffer_local_event(
        self,
        node_id: str,
        event_id: str,
        camera_id: str,
        event_type: str,
        priority: str,
        payload: Dict[str, Any]
    ) -> EdgeEventBuffer:
        """
        Durable local storage of event on edge node when offline or queueing.
        """
        db: Session = SessionLocal()
        try:
            local_id = f"LOC-{node_id}-{uuid.uuid4().hex[:8].upper()}"
            record = EdgeEventBuffer(
                local_id=local_id,
                node_id=node_id,
                event_id=event_id,
                camera_id=camera_id,
                priority=priority.upper(),
                event_payload_json=json.dumps(payload),
                sync_status="PENDING",
                created_at=datetime.utcnow()
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            logger.info(f"Buffered local event {event_id} (Priority: {priority}) on node {node_id}.")
            return record
        finally:
            db.close()

    def get_pending_sync_batch(self, node_id: str, batch_size: int = 25) -> List[EdgeEventBuffer]:
        """
        Retrieves pending store-and-forward events strictly ordered by priority:
        CRITICAL (1) -> HIGH (2) -> MEDIUM (3) -> LOW (4), then oldest timestamp first.
        """
        db: Session = SessionLocal()
        try:
            priority_order = case(
                (EdgeEventBuffer.priority == "CRITICAL", 1),
                (EdgeEventBuffer.priority == "HIGH", 2),
                (EdgeEventBuffer.priority == "MEDIUM", 3),
                (EdgeEventBuffer.priority == "LOW", 4),
                else_=5
            )

            records = db.query(EdgeEventBuffer).filter(
                EdgeEventBuffer.node_id == node_id,
                EdgeEventBuffer.sync_status.in_(["PENDING", "FAILED"])
            ).order_by(
                priority_order,
                EdgeEventBuffer.created_at.asc()
            ).limit(batch_size).all()

            return records
        finally:
            db.close()

    def ingest_sync_batch(self, batch: EdgeSyncBatchRequest) -> EdgeSyncBatchResponse:
        """
        Idempotent Central Ingestion:
        Ingests events from edge node batch. If an event_id was previously received,
        it is recognized as an idempotent duplicate and acknowledged safely without duplication.
        """
        db: Session = SessionLocal()
        synced_ids = []
        duplicate_ids = []

        try:
            for item in batch.events:
                # 1. Idempotency Check
                existing = db.query(SecurityEvent).filter(
                    SecurityEvent.event_id == item.event_id
                ).first()

                if existing:
                    duplicate_ids.append(item.event_id)
                    continue

                # 2. Persist New Central Event
                factors = json.loads(item.factors_json) if item.factors_json else []
                timeline = json.loads(item.timeline_json) if item.timeline_json else []

                sec_event = SecurityEvent(
                    event_id=item.event_id,
                    camera_id=item.camera_id,
                    track_id=item.track_id or 0,
                    object_type=item.object_type,
                    event_type=item.event_type,
                    severity=item.severity,
                    risk_score=item.risk_score,
                    risk_level=item.risk_level,
                    status="ACTIVE",
                    environment=f"EDGE_SYNC:{batch.node_id}",
                    factors_json=json.dumps(factors),
                    timeline_json=json.dumps(timeline),
                    started_at=item.timestamp,
                    last_updated_at=item.timestamp
                )
                db.add(sec_event)
                synced_ids.append(item.event_id)

                # 3. Broadcast to Central WebSocket feed
                security_event_manager.broadcast_sync_event({
                    "event": "NEW_SECURITY_EVENT",
                    "data": {
                        "event_id": item.event_id,
                        "camera_id": item.camera_id,
                        "event_type": item.event_type,
                        "risk_score": item.risk_score,
                        "risk_level": item.risk_level,
                        "status": "ACTIVE",
                        "started_at": item.timestamp.isoformat()
                    }
                })

            db.commit()

            # Also update local buffer sync status if database has the local buffer rows
            if synced_ids or duplicate_ids:
                all_acked = synced_ids + duplicate_ids
                db.query(EdgeEventBuffer).filter(
                    EdgeEventBuffer.event_id.in_(all_acked)
                ).update({
                    "sync_status": "SYNCED",
                    "synced_at": datetime.utcnow()
                }, synchronize_session=False)
                db.commit()

            logger.info(f"Sync batch processed from {batch.node_id}: {len(synced_ids)} synced, {len(duplicate_ids)} duplicates.")

            return EdgeSyncBatchResponse(
                received_count=len(batch.events),
                synced_ids=synced_ids,
                duplicate_ids=duplicate_ids,
                status="SUCCESS"
            )
        except Exception as e:
            logger.error(f"Error during batch sync ingestion from {batch.node_id}: {e}", exc_info=True)
            db.rollback()
            raise e
        finally:
            db.close()

# Global Singleton
edge_sync_engine = EdgeSyncEngine()
