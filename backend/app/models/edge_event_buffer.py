from sqlalchemy import Column, Integer, String, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class EdgeEventBuffer(Base):
    __tablename__ = "edge_event_buffers"

    id = Column(Integer, primary_key=True, index=True)
    local_id = Column(String(50), unique=True, index=True, nullable=False)
    node_id = Column(String(50), index=True, nullable=False) # e.g. EDGE-BOP-001
    event_id = Column(String(50), index=True, nullable=False) # Globally unique event ID
    camera_id = Column(String(50), index=True, nullable=False)
    
    # Priority: CRITICAL, HIGH, MEDIUM, LOW
    priority = Column(String(20), default="MEDIUM", index=True, nullable=False)
    
    event_payload_json = Column(Text, nullable=False)
    
    # Sync Status: PENDING, SYNCING, SYNCED, FAILED
    sync_status = Column(String(30), default="PENDING", index=True, nullable=False)
    
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    synced_at = Column(DateTime, nullable=True)

# Compound index for prioritized store-and-forward queue processing
Index("idx_edge_buf_node_prio_status", EdgeEventBuffer.node_id, EdgeEventBuffer.priority, EdgeEventBuffer.sync_status)
