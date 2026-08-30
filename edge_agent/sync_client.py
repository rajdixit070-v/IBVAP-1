import os
import time
import json
import psutil
import logging
import requests
from typing import Dict, Any, List, Optional
from datetime import datetime

from edge_agent.config import EdgeAgentConfig
from edge_agent.storage import EdgeLocalStorage

logger = logging.getLogger("ibvap.edge.sync_client")

class EdgeSyncClient:
    """
    Secure Synchronization and Telemetry Client.
    Communicates with Central IBVAP over VPN / mTLS using 256-bit Edge Token.
    Flushes store-and-forward queue strictly by priority when online.
    """

    def __init__(self, config: EdgeAgentConfig, storage: EdgeLocalStorage):
        self.config = config
        self.storage = storage
        self.session = requests.Session()
        self.is_online = False
        self.last_latency_ms = 0.0

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": f"IBVAP-EdgeAgent/{self.config.node_id}"
        }
        if self.config.api_key:
            headers["X-Edge-API-Key"] = self.config.api_key
        return headers

    def send_heartbeat(self, active_cameras: int = 0) -> Optional[Dict[str, Any]]:
        """
        Sends hardware & queue telemetry to Central IBVAP.
        """
        url = f"{self.config.central_url.rstrip('/')}/api/v1/edge/heartbeat"
        
        # Telemetry collection
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory().percent
        disk = psutil.disk_usage("/").percent if os.name != "nt" else psutil.disk_usage("C:").percent
        
        queue_info = self.storage.get_queue_depth()

        payload = {
            "node_id": self.config.node_id,
            "status": "ONLINE",
            "cpu_percent": float(cpu),
            "memory_percent": float(mem),
            "disk_percent": float(disk),
            "gpu_percent": 0.0,
            "active_cameras_count": active_cameras,
            "total_cameras_count": len(self.config.cameras),
            "queued_events_count": queue_info["pending"] + queue_info["failed"],
            "config_version": 1,
            "latency_ms": self.last_latency_ms,
            "low_bandwidth_mode": self.config.low_bandwidth_mode
        }

        try:
            start_t = time.time()
            resp = self.session.post(url, json=payload, headers=self._get_headers(), timeout=5.0)
            self.last_latency_ms = round((time.time() - start_t) * 1000, 1)

            if resp.status_code == 200:
                self.is_online = True
                ack = resp.json()
                logger.debug(f"Heartbeat ACK from Central (Latency: {self.last_latency_ms}ms)")
                
                # Check for dynamic remote config updates
                if ack.get("low_bandwidth_mode") is not None and ack["low_bandwidth_mode"] != self.config.low_bandwidth_mode:
                    logger.info(f"Central updated low_bandwidth_mode -> {ack['low_bandwidth_mode']}")
                    self.config.low_bandwidth_mode = ack["low_bandwidth_mode"]
                return ack
            else:
                logger.warning(f"Heartbeat rejected: HTTP {resp.status_code} - {resp.text}")
                self.is_online = False
                return None

        except requests.exceptions.RequestException as e:
            if self.is_online:
                logger.warning(f"Connection to Central IBVAP lost ({e}). Transitioning to offline buffering mode.")
            self.is_online = False
            return None

    def flush_pending_sync_batch(self) -> int:
        """
        Retrieves prioritized pending events from local storage and syncs to Central.
        If network is down, events remain safely buffered on disk.
        """
        if not self.is_online:
            return 0

        batch = self.storage.get_pending_batch(limit=self.config.sync_batch_size)
        if not batch:
            return 0

        logger.info(f"Syncing batch of {len(batch)} prioritized events to Central IBVAP...")
        url = f"{self.config.central_url.rstrip('/')}/api/v1/edge/sync"

        event_items = []
        for r in batch:
            try:
                payload = json.loads(r["payload_json"])
            except Exception:
                payload = {}

            item = {
                "event_id": r["event_id"],
                "camera_id": r["camera_id"],
                "track_id": r["track_id"],
                "object_type": r["object_type"],
                "event_type": r["event_type"],
                "severity": r["severity"],
                "risk_score": r["risk_score"],
                "risk_level": r["risk_level"],
                "priority": r["priority"],
                "factors_json": json.dumps(payload.get("factors", [])),
                "timeline_json": json.dumps(payload.get("timeline", [])),
                "timestamp": r["created_at"]
            }
            event_items.append(item)

        sync_payload = {
            "node_id": self.config.node_id,
            "events": event_items,
            "batch_timestamp": datetime.utcnow().isoformat()
        }

        try:
            resp = self.session.post(url, json=sync_payload, headers=self._get_headers(), timeout=10.0)
            if resp.status_code == 200:
                result = resp.json()
                synced_ids = result.get("synced_ids", []) + result.get("duplicate_ids", [])
                self.storage.mark_events_synced(synced_ids)
                logger.info(f"Successfully synced {len(synced_ids)} events to Central.")

                # Also sync forensic evidence image files if not in low-bandwidth mode
                if not self.config.low_bandwidth_mode:
                    self._sync_evidence_files(batch)

                return len(synced_ids)
            else:
                logger.error(f"Central sync failed: HTTP {resp.status_code} - {resp.text}")
                failed_ids = [r["event_id"] for r in batch]
                self.storage.mark_events_failed(failed_ids)
                return 0

        except requests.exceptions.RequestException as e:
            logger.warning(f"Network error during sync ({e}). Events remain safely queued on edge disk.")
            self.is_online = False
            return 0

    def _sync_evidence_files(self, batch: List[Dict[str, Any]]) -> None:
        """Uploads captured forensic snapshot JPEGs to Central Evidence Locker."""
        evidence_url = f"{self.config.central_url.rstrip('/')}/api/v1/edge/sync-evidence"

        for r in batch:
            evd_path = r.get("evidence_file_path")
            if not evd_path or not os.path.exists(evd_path):
                continue

            try:
                with open(evd_path, "rb") as img_file:
                    files = {"file": (os.path.basename(evd_path), img_file, "image/jpeg")}
                    data = {
                        "node_id": self.config.node_id,
                        "event_id": r["event_id"],
                        "camera_id": r["camera_id"],
                        "checksum_sha256": r.get("evidence_checksum", ""),
                        "created_at": r["created_at"]
                    }
                    headers = {}
                    if self.config.api_key:
                        headers["X-Edge-API-Key"] = self.config.api_key

                    resp = self.session.post(evidence_url, data=data, files=files, headers=headers, timeout=10.0)
                    if resp.status_code == 200:
                        logger.debug(f"Uploaded evidence snapshot for event {r['event_id']}")
            except Exception as e:
                logger.debug(f"Failed to sync evidence photo {evd_path}: {e}")
