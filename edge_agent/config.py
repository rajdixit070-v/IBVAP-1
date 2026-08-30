import os
import json
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger("ibvap.edge.config")

@dataclass
class LocalCameraConfig:
    camera_id: str
    rtsp_url: str
    name: Optional[str] = None
    stream_type: str = "main" # main, thermal, ptz, drone
    fps: float = 15.0
    enabled: bool = True

@dataclass
class EdgeAgentConfig:
    node_id: str = "EDGE-BOP-001"
    node_name: str = "Tactical Outpost Edge Node"
    bop_site: str = "BOP Sector North"
    central_url: str = "http://localhost:8000" # Central IBVAP URL (over VPN or mTLS)
    api_key: str = "" # 256-bit Edge Token issued by Central IBVAP
    
    # Cameras on local outpost LAN (never exposed to public internet)
    cameras: List[LocalCameraConfig] = field(default_factory=list)
    
    # Operation intervals
    heartbeat_interval_sec: int = 10
    sync_interval_sec: int = 5
    sync_batch_size: int = 25
    low_bandwidth_mode: bool = False
    
    # Local durable storage
    local_storage_dir: str = "./storage/edge_local"
    database_path: str = "./storage/edge_local/edge_buffer.db"
    evidence_dir: str = "./storage/edge_local/evidence"
    
    # AI Inference settings
    yolo_model_path: str = "models/yolov8n.pt"
    confidence_threshold: float = 0.50
    detection_fps: float = 10.0

    @classmethod
    def load_from_file(cls, config_path: str = "edge_config.json") -> "EdgeAgentConfig":
        """Loads configuration from JSON file. If missing, writes default template."""
        if not os.path.exists(config_path):
            logger.warning(f"Config file '{config_path}' not found. Generating default template.")
            default_config = cls()
            default_config.save_to_file(config_path)
            return default_config

        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        cameras_data = data.get("cameras", [])
        camera_configs = [
            LocalCameraConfig(
                camera_id=c["camera_id"],
                rtsp_url=c["rtsp_url"],
                name=c.get("name"),
                stream_type=c.get("stream_type", "main"),
                fps=float(c.get("fps", 15.0)),
                enabled=c.get("enabled", True)
            )
            for c in cameras_data
        ]

        cfg = cls(
            node_id=data.get("node_id", "EDGE-BOP-001"),
            node_name=data.get("node_name", "Tactical Outpost Edge Node"),
            bop_site=data.get("bop_site", "BOP Sector North"),
            central_url=data.get("central_url", "http://localhost:8000"),
            api_key=data.get("api_key", ""),
            cameras=camera_configs,
            heartbeat_interval_sec=data.get("heartbeat_interval_sec", 10),
            sync_interval_sec=data.get("sync_interval_sec", 5),
            sync_batch_size=data.get("sync_batch_size", 25),
            low_bandwidth_mode=data.get("low_bandwidth_mode", False),
            local_storage_dir=data.get("local_storage_dir", "./storage/edge_local"),
            database_path=data.get("database_path", "./storage/edge_local/edge_buffer.db"),
            evidence_dir=data.get("evidence_dir", "./storage/edge_local/evidence"),
            yolo_model_path=data.get("yolo_model_path", "models/yolov8n.pt"),
            confidence_threshold=float(data.get("confidence_threshold", 0.50)),
            detection_fps=float(data.get("detection_fps", 10.0))
        )
        return cfg

    def save_to_file(self, config_path: str = "edge_config.json") -> None:
        """Saves current configuration to file."""
        data = {
            "node_id": self.node_id,
            "node_name": self.node_name,
            "bop_site": self.bop_site,
            "central_url": self.central_url,
            "api_key": self.api_key,
            "heartbeat_interval_sec": self.heartbeat_interval_sec,
            "sync_interval_sec": self.sync_interval_sec,
            "sync_batch_size": self.sync_batch_size,
            "low_bandwidth_mode": self.low_bandwidth_mode,
            "local_storage_dir": self.local_storage_dir,
            "database_path": self.database_path,
            "evidence_dir": self.evidence_dir,
            "yolo_model_path": self.yolo_model_path,
            "confidence_threshold": self.confidence_threshold,
            "detection_fps": self.detection_fps,
            "cameras": [
                {
                    "camera_id": c.camera_id,
                    "rtsp_url": c.rtsp_url,
                    "name": c.name or c.camera_id,
                    "stream_type": c.stream_type,
                    "fps": c.fps,
                    "enabled": c.enabled
                }
                for c in self.cameras
            ]
        }
        os.makedirs(os.path.dirname(os.path.abspath(config_path)) or ".", exist_ok=True)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        logger.info(f"Saved configuration to '{config_path}'")
