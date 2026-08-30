import os
import sys
import time
import signal
import logging
import argparse
import threading

# Ensure root workspace is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from edge_agent.config import EdgeAgentConfig, LocalCameraConfig
from edge_agent.storage import EdgeLocalStorage
from edge_agent.sync_client import EdgeSyncClient
from edge_agent.ai_worker import EdgeCameraWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("ibvap.edge.agent")

class EdgeAgentDaemon:
    """
    Main Edge Agent Daemon running on Border Outpost / Remote Edge Server.
    Consumes local RTSP, executes AI, buffers offline events, and syncs over VPN to Central IBVAP.
    """

    def __init__(self, config_path: str = "edge_config.json"):
        self.config_path = config_path
        self.config = EdgeAgentConfig.load_from_file(config_path)
        self.storage = EdgeLocalStorage(self.config.database_path, self.config.evidence_dir)
        self.sync_client = EdgeSyncClient(self.config, self.storage)
        
        self.workers: list[EdgeCameraWorker] = []
        self.running = False
        self._threads: list[threading.Thread] = []

    def start(self):
        self.running = True
        logger.info("==================================================")
        logger.info(f"  IBVAP TACTICAL EDGE AGENT: {self.config.node_id}")
        logger.info(f"  Site: {self.config.bop_site} | Mode: Offline Resilient")
        logger.info(f"  Central Gateway: {self.config.central_url}")
        logger.info(f"  Configured Local Cameras: {len(self.config.cameras)}")
        logger.info("==================================================")

        # 1. Start local camera AI workers
        for cam_cfg in self.config.cameras:
            if cam_cfg.enabled:
                worker = EdgeCameraWorker(cam_cfg, self.config, self.storage)
                worker.start()
                self.workers.append(worker)

        # 2. Start background heartbeat thread
        hb_thread = threading.Thread(target=self._heartbeat_loop, daemon=True, name="HeartbeatThread")
        hb_thread.start()
        self._threads.append(hb_thread)

        # 3. Start background sync thread
        sync_thread = threading.Thread(target=self._sync_loop, daemon=True, name="SyncThread")
        sync_thread.start()
        self._threads.append(sync_thread)

        logger.info("All Edge Agent subsystem workers active.")

    def stop(self):
        logger.info("Stopping Edge Agent daemon...")
        self.running = False
        for w in self.workers:
            w.stop()
        logger.info("Edge Agent gracefully stopped.")

    def _heartbeat_loop(self):
        while self.running:
            try:
                active_cams = sum(1 for w in self.workers if w.is_connected)
                self.sync_client.send_heartbeat(active_cameras=active_cams)
            except Exception as e:
                logger.error(f"Heartbeat loop error: {e}")
            time.sleep(max(3, self.config.heartbeat_interval_sec))

    def _sync_loop(self):
        while self.running:
            try:
                self.sync_client.flush_pending_sync_batch()
            except Exception as e:
                logger.error(f"Sync loop error: {e}")
            time.sleep(max(2, self.config.sync_interval_sec))

def run_test_mode(config_path: str = "edge_config.json"):
    """
    Self-verification test:
    Simulates buffering an offline target event, verifies storage, and verifies sync.
    """
    import uuid
    from datetime import datetime
    logger.info("Running Edge Agent self-test verification...")
    
    cfg = EdgeAgentConfig.load_from_file(config_path)
    storage = EdgeLocalStorage(cfg.database_path, cfg.evidence_dir)
    sync_client = EdgeSyncClient(cfg, storage)

    # 1. Buffer a mock tactical detection
    mock_event = {
        "event_id": f"EVT-TEST-{uuid.uuid4().hex[:6].upper()}",
        "node_id": cfg.node_id,
        "camera_id": "CAM-EDGE-TEST",
        "track_id": 101,
        "object_type": "person",
        "event_type": "EDGE_INTRUDER_DETECTED",
        "severity": "CRITICAL",
        "risk_score": 90,
        "risk_level": "HIGH",
        "priority": "CRITICAL",
        "confidence": 0.95,
        "bbox": {"x": 50, "y": 50, "w": 120, "h": 260},
        "timestamp": datetime.utcnow().isoformat()
    }
    local_id = storage.buffer_event(mock_event)
    logger.info(f"[PASS] Successfully buffered event: {local_id}")

    # 2. Check queue depth
    depth = storage.get_queue_depth()
    assert depth["pending"] >= 1, "Queue pending count should be >= 1"
    logger.info(f"[PASS] Queue Depth verified: {depth}")

    # 3. Test heartbeat
    logger.info("Testing heartbeat to Central IBVAP...")
    hb = sync_client.send_heartbeat(active_cameras=1)
    if hb:
        logger.info(f"[PASS] Central IBVAP acknowledged heartbeat: {hb.get('status')}")
        # 4. Flush batch
        synced = sync_client.flush_pending_sync_batch()
        logger.info(f"[PASS] Flushed batch to Central: {synced} synced.")
    else:
        logger.info("[INFO] Central offline or unreachable. Store-and-forward queue securely retained on disk.")

    logger.info("Edge Agent self-test completed successfully!")

def interactive_setup(config_path: str = "edge_config.json"):
    print("=== IBVAP Edge Agent Interactive Setup ===")
    node_id = input("Enter Node ID (e.g. EDGE-BOP-KARGIL-01): ").strip() or "EDGE-BOP-001"
    bop_site = input("Enter Outpost Name (e.g. BOP Kargil Sector 3): ").strip() or "Sector North"
    central_url = input("Enter Central IBVAP VPN URL (e.g. http://10.8.0.1:8000): ").strip() or "http://localhost:8000"
    api_key = input("Enter 256-bit Edge API Key: ").strip()

    cfg = EdgeAgentConfig(
        node_id=node_id,
        bop_site=bop_site,
        central_url=central_url,
        api_key=api_key
    )

    cam_id = input("Add local camera ID (or leave blank to skip): ").strip()
    if cam_id:
        rtsp = input(f"Enter local RTSP URL for {cam_id} (e.g. rtsp://192.168.1.100:554/ch0): ").strip()
        cfg.cameras.append(LocalCameraConfig(camera_id=cam_id, rtsp_url=rtsp))

    cfg.save_to_file(config_path)
    print(f"Setup complete! Config saved to {config_path}")

def main():
    parser = argparse.ArgumentParser(description="IBVAP Tactical Edge Agent")
    parser.add_argument("--config", default="edge_config.json", help="Path to edge configuration file")
    parser.add_argument("--test-mode", action="store_true", help="Run offline queue self-test and exit")
    parser.add_argument("--setup", action="store_true", help="Run interactive setup wizard")
    args = parser.parse_args()

    if args.setup:
        interactive_setup(args.config)
        return

    if args.test_mode:
        run_test_mode(args.config)
        return

    agent = EdgeAgentDaemon(args.config)

    def sig_handler(signum, frame):
        agent.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)

    agent.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        agent.stop()

if __name__ == "__main__":
    main()
