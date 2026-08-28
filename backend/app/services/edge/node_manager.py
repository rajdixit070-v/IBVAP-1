import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.edge_node import EdgeNode
from app.models.camera import Camera
from app.models.audit_log import SecurityAuditLog
from app.schemas.edge import EdgeHeartbeatRequest, EdgeRemoteConfig

logger = logging.getLogger("ibvap.edge.node_manager")

class EdgeNodeManager:
    """
    Manages Edge Appliance lifecycles, heartbeats, configuration versioning, and telemetry.
    """
    def __init__(self):
        self.heartbeat_timeout_seconds = 60

    def process_heartbeat(self, hb: EdgeHeartbeatRequest) -> Dict[str, Any]:
        """
        Ingests telemetry heartbeat from an edge appliance.
        """
        db: Session = SessionLocal()
        try:
            node = db.query(EdgeNode).filter(EdgeNode.node_id == hb.node_id).first()
            now = datetime.utcnow()

            if not node:
                # Auto-register node if unknown
                node = EdgeNode(
                    node_id=hb.node_id,
                    name=f"Edge Node {hb.node_id}",
                    bop_site="Sector Outpost",
                    status=hb.status,
                    created_at=now
                )
                db.add(node)

            # Update live telemetry
            node.status = hb.status
            node.cpu_percent = hb.cpu_percent
            node.memory_percent = hb.memory_percent
            node.disk_percent = hb.disk_percent
            node.gpu_percent = hb.gpu_percent
            node.active_cameras_count = hb.active_cameras_count
            node.total_cameras_count = hb.total_cameras_count
            node.queued_events_count = hb.queued_events_count
            node.low_bandwidth_mode = hb.low_bandwidth_mode
            node.latency_ms = hb.latency_ms
            node.last_heartbeat = now

            # Sync status derivation
            if hb.queued_events_count > 20:
                node.sync_status = "DELAYED"
            elif hb.queued_events_count > 0:
                node.sync_status = "SYNCING"
            else:
                node.sync_status = "SYNCHRONIZED"

            db.commit()
            db.refresh(node)

            return {
                "node_id": node.node_id,
                "status": node.status,
                "config_version": node.config_version,
                "low_bandwidth_mode": node.low_bandwidth_mode,
                "sync_status": node.sync_status,
                "acknowledged_at": now.isoformat()
            }
        except Exception as e:
            logger.error(f"Error processing heartbeat for {hb.node_id}: {e}", exc_info=True)
            raise e
        finally:
            db.close()

    def update_remote_config(self, node_id: str, config: EdgeRemoteConfig) -> EdgeNode:
        """
        Updates edge configuration and increments config_version.
        """
        db: Session = SessionLocal()
        try:
            node = db.query(EdgeNode).filter(EdgeNode.node_id == node_id).first()
            if not node:
                raise ValueError(f"Edge node {node_id} not found.")

            if config.low_bandwidth_mode is not None:
                node.low_bandwidth_mode = config.low_bandwidth_mode
            
            node.config_version += 1
            node.updated_at = datetime.utcnow()

            audit = SecurityAuditLog(
                username="operator",
                action="EDGE_CONFIG_UPDATED",
                resource_type="EDGE_NODE",
                resource_id=node_id,
                details=f'{{"config_version": {node.config_version}, "low_bandwidth": {node.low_bandwidth_mode}}}'
            )
            db.add(audit)
            db.commit()
            db.refresh(node)
            return node
        finally:
            db.close()

    def audit_offline_nodes(self):
        """
        Marks nodes OFFLINE if heartbeat is older than timeout.
        """
        db: Session = SessionLocal()
        try:
            threshold = datetime.utcnow() - timedelta(seconds=self.heartbeat_timeout_seconds)
            nodes = db.query(EdgeNode).filter(
                EdgeNode.last_heartbeat < threshold,
                EdgeNode.status != "OFFLINE"
            ).all()

            for node in nodes:
                node.status = "OFFLINE"
                node.sync_status = "OFFLINE"
                logger.warn(f"Edge node {node.node_id} marked OFFLINE (heartbeat expired).")

            if nodes:
                db.commit()
        except Exception as e:
            logger.error(f"Error auditing offline edge nodes: {e}")
        finally:
            db.close()

# Global Singleton
edge_node_manager = EdgeNodeManager()
