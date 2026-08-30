import os
import json
import sqlite3
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

logger = logging.getLogger("ibvap.edge.storage")

class EdgeLocalStorage:
    """
    Durable local SQLite store-and-forward storage engine on the Edge Node.
    Ensures zero event or evidence loss during border network blackouts.
    """

    def __init__(self, db_path: str = "./storage/edge_local/edge_buffer.db", evidence_dir: str = "./storage/edge_local/evidence"):
        self.db_path = db_path
        self.evidence_dir = evidence_dir
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        os.makedirs(evidence_dir, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Initializes tables and indexes for prioritized store-and-forward queue."""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS edge_local_buffer (
                    local_id TEXT PRIMARY KEY,
                    event_id TEXT UNIQUE NOT NULL,
                    camera_id TEXT NOT NULL,
                    track_id INTEGER DEFAULT 0,
                    object_type TEXT DEFAULT 'target',
                    event_type TEXT NOT NULL,
                    severity TEXT DEFAULT 'HIGH',
                    risk_score INTEGER DEFAULT 50,
                    risk_level TEXT DEFAULT 'MEDIUM',
                    priority TEXT DEFAULT 'MEDIUM',
                    payload_json TEXT NOT NULL,
                    evidence_file_path TEXT,
                    evidence_checksum TEXT,
                    sync_status TEXT DEFAULT 'PENDING',
                    retry_count INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    synced_at TEXT
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_edge_sync_order 
                ON edge_local_buffer (sync_status, priority, created_at)
            """)
            conn.commit()
            logger.info(f"Initialized durable edge storage at '{self.db_path}'")

    def buffer_event(
        self,
        event_dict: Dict[str, Any],
        evidence_file_path: Optional[str] = None,
        evidence_checksum: Optional[str] = None
    ) -> str:
        """
        Durable insert of local detection event into buffer.
        """
        event_id = event_dict.get("event_id")
        local_id = f"LOC-{event_id}"
        priority = event_dict.get("priority", "MEDIUM").upper()

        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO edge_local_buffer (
                    local_id, event_id, camera_id, track_id, object_type,
                    event_type, severity, risk_score, risk_level, priority,
                    payload_json, evidence_file_path, evidence_checksum,
                    sync_status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
            """, (
                local_id,
                event_id,
                event_dict.get("camera_id", "UNKNOWN"),
                event_dict.get("track_id", 0),
                event_dict.get("object_type", "target"),
                event_dict.get("event_type", "INTRUSION"),
                event_dict.get("severity", "HIGH"),
                event_dict.get("risk_score", 50),
                event_dict.get("risk_level", "MEDIUM"),
                priority,
                json.dumps(event_dict),
                evidence_file_path,
                evidence_checksum,
                event_dict.get("timestamp", datetime.utcnow().isoformat())
            ))
            conn.commit()
        logger.info(f"Buffered local event {event_id} (Priority: {priority}) on disk.")
        return local_id

    def get_pending_batch(self, limit: int = 25) -> List[Dict[str, Any]]:
        """
        Retrieves pending events sorted strictly by priority:
        CRITICAL (1) -> HIGH (2) -> MEDIUM (3) -> LOW (4), then oldest timestamp first.
        """
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT * FROM edge_local_buffer
                WHERE sync_status IN ('PENDING', 'FAILED')
                ORDER BY 
                    CASE priority
                        WHEN 'CRITICAL' THEN 1
                        WHEN 'HIGH' THEN 2
                        WHEN 'MEDIUM' THEN 3
                        WHEN 'LOW' THEN 4
                        ELSE 5
                    END ASC,
                    created_at ASC
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def mark_events_synced(self, event_ids: List[str]) -> None:
        """Marks successfully ingested events as SYNCED."""
        if not event_ids:
            return
        now_str = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            placeholders = ",".join("?" * len(event_ids))
            conn.execute(f"""
                UPDATE edge_local_buffer
                SET sync_status = 'SYNCED', synced_at = ?
                WHERE event_id IN ({placeholders})
            """, [now_str] + event_ids)
            conn.commit()
        logger.info(f"Marked {len(event_ids)} events as SYNCED.")

    def mark_events_failed(self, event_ids: List[str]) -> None:
        """Increments retry count for failed events."""
        if not event_ids:
            return
        with self._get_connection() as conn:
            placeholders = ",".join("?" * len(event_ids))
            conn.execute(f"""
                UPDATE edge_local_buffer
                SET sync_status = 'FAILED', retry_count = retry_count + 1
                WHERE event_id IN ({placeholders})
            """, event_ids)
            conn.commit()

    def get_queue_depth(self) -> Dict[str, int]:
        """Returns counts of pending, failed, and synced records."""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT 
                    SUM(CASE WHEN sync_status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN sync_status = 'FAILED' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN sync_status = 'SYNCED' THEN 1 ELSE 0 END) as synced,
                    COUNT(*) as total
                FROM edge_local_buffer
            """)
            row = cursor.fetchone()
            return {
                "pending": row["pending"] or 0,
                "failed": row["failed"] or 0,
                "synced": row["synced"] or 0,
                "total": row["total"] or 0
            }

    def prune_synced(self, retention_days: int = 7) -> int:
        """Prunes synced events older than retention_days to free disk space."""
        cutoff = (datetime.utcnow() - timedelta(days=retention_days)).isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute("""
                DELETE FROM edge_local_buffer
                WHERE sync_status = 'SYNCED' AND synced_at < ?
            """, (cutoff,))
            pruned = cursor.rowcount
            conn.commit()
        if pruned > 0:
            logger.info(f"Pruned {pruned} old synced events from local buffer.")
        return pruned
