import logging
from typing import Dict, Tuple, Optional
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.camera import Camera
from app.models.edge_node import EdgeNode

logger = logging.getLogger("ibvap.predictive.infrastructure")

class InfrastructureCorrelator:
    """
    Correlates predictive analysis with Phase 1 camera status and Phase 5 edge telemetry
    to calculate real-time Data Quality Scores and avoid false activity drop classifications.
    """

    def evaluate_camera_data_quality(self, camera_id: str) -> Tuple[float, bool, str]:
        """
        Calculates Data Quality Score (0.0 - 1.0) and checks for infrastructure outage.
        Returns: (data_quality_score, is_infrastructure_failure, outage_reason)
        """
        db: Session = SessionLocal()
        try:
            cam = db.query(Camera).filter(Camera.camera_id == camera_id).first()
            if not cam:
                return 0.85, False, "HEALTHY"

            if not cam.enabled or cam.status == "OFFLINE":
                return 0.20, True, "CAMERA_OFFLINE"

            # Check Edge Node health
            if cam.edge_node_id:
                node = db.query(EdgeNode).filter(EdgeNode.node_id == cam.edge_node_id).first()
                if node and node.status == "OFFLINE" and cam.status != "HEALTHY":
                    return 0.30, True, "EDGE_GATEWAY_OFFLINE"
                elif node and node.low_bandwidth_mode:
                    return 0.75, False, "EDGE_LOW_BANDWIDTH_MODE"

            if cam.status == "DEGRADED":
                return 0.65, False, "CAMERA_STREAM_DEGRADED"

            # Default healthy data quality
            return 0.94, False, "HEALTHY"
        finally:
            db.close()

    def evaluate_site_data_quality(self, site_id: str) -> float:
        """
        Calculates aggregate data quality score across all cameras at a site.
        """
        db: Session = SessionLocal()
        try:
            cameras = db.query(Camera).filter(Camera.bop_site == site_id).all()
            if not cameras:
                return 0.85

            total_score = 0.0
            for cam in cameras:
                score, is_down, _ = self.evaluate_camera_data_quality(cam.camera_id)
                total_score += score

            return round(total_score / len(cameras), 2)
        finally:
            db.close()

infrastructure_correlator = InfrastructureCorrelator()
