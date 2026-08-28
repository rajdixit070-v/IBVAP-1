import logging
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.camera_transition import CameraTransition

logger = logging.getLogger("ibvap.cross_camera.graph")

class CameraGraphService:
    """
    Logical camera topology graph manager: tracks valid transitions,
    travel time bounds, and topological direction vectors.
    """

    def get_transition(self, from_cam: str, to_cam: str) -> Optional[CameraTransition]:
        db: Session = SessionLocal()
        try:
            return db.query(CameraTransition).filter(
                CameraTransition.from_camera_id == from_cam,
                CameraTransition.to_camera_id == to_cam,
                CameraTransition.is_enabled == True
            ).first()
        finally:
            db.close()

    def validate_transition(
        self,
        from_cam: str,
        to_cam: str,
        time_delta_sec: float
    ) -> Tuple[bool, Optional[str], float]:
        """
        Validates transition against network graph constraints.
        Returns: (is_valid, anomaly_type_if_any, topological_confidence)
        """
        if from_cam == to_cam:
            return True, None, 1.0

        transition = self.get_transition(from_cam, to_cam)
        if not transition:
            # Route Deviation: Moving between cameras with no configured edge
            return False, "ROUTE_DEVIATION", 0.30

        # Impossible Travel: Time delta shorter than physical minimum
        if time_delta_sec < transition.min_travel_time_sec:
            logger.warning(
                f"Impossible transition detected from {from_cam} to {to_cam}: "
                f"delta {time_delta_sec}s < min {transition.min_travel_time_sec}s"
            )
            return False, "IMPOSSIBLE_TRANSITION", 0.10

        # Transit beyond max travel time (stale / gap)
        if time_delta_sec > transition.max_travel_time_sec:
            return True, "EXCEEDED_MAX_TRANSIT_WINDOW", transition.transition_confidence * 0.70

        return True, None, transition.transition_confidence

    def get_adjacent_cameras(self, camera_id: str) -> List[str]:
        db: Session = SessionLocal()
        try:
            edges = db.query(CameraTransition.to_camera_id).filter(
                CameraTransition.from_camera_id == camera_id,
                CameraTransition.is_enabled == True
            ).all()
            return [e[0] for e in edges]
        finally:
            db.close()

# Global Singleton
camera_graph_service = CameraGraphService()
