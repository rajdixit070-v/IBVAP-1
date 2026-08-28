import math
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any

class TrackPlateObservation:
    def __init__(self, raw_text: str, normalized_text: str, confidence: float, timestamp: datetime):
        self.raw_text = raw_text
        self.normalized_text = normalized_text
        self.confidence = confidence
        self.timestamp = timestamp

class VehicleTrackPlateHistory:
    """
    Accumulates multi-frame OCR readings for a specific vehicle track.
    """
    def __init__(self, track_id: int, camera_id: str):
        self.track_id = track_id
        self.camera_id = camera_id
        self.observations: List[TrackPlateObservation] = []
        # candidate -> { "count": int, "total_conf": float, "best_raw": str, "max_conf": float }
        self.candidates: Dict[str, Dict[str, Any]] = {}
        self.best_plate: Optional[str] = None
        self.best_confidence: float = 0.0
        self.confirmed_at: Optional[datetime] = None

    def add_reading(self, raw_text: str, normalized_text: str, confidence: float, timestamp: datetime = None) -> Tuple[Optional[str], float, int]:
        """
        Adds a single frame OCR observation and returns (current_consensus_plate, consensus_confidence, observation_count).
        """
        if not normalized_text or len(normalized_text) < 4:
            return self.best_plate, self.best_confidence, len(self.observations)

        now = timestamp or datetime.utcnow()
        obs = TrackPlateObservation(raw_text, normalized_text, confidence, now)
        self.observations.append(obs)

        # Update candidate statistics
        if normalized_text not in self.candidates:
            self.candidates[normalized_text] = {
                "count": 1,
                "total_conf": confidence,
                "best_raw": raw_text,
                "max_conf": confidence
            }
        else:
            cand = self.candidates[normalized_text]
            cand["count"] += 1
            cand["total_conf"] += confidence
            if confidence > cand["max_conf"]:
                cand["max_conf"] = confidence
                cand["best_raw"] = raw_text

        # Compute consensus candidate with highest temporal support
        best_cand_key = None
        highest_score = -1.0

        for key, stats in self.candidates.items():
            avg_conf = stats["total_conf"] / stats["count"]
            # Consensus weight boosted logarithmically by frame count
            score = avg_conf * (1.0 + min(0.5, 0.15 * math.log(stats["count"] + 1)))
            if score > highest_score:
                highest_score = score
                best_cand_key = key

        if best_cand_key:
            self.best_plate = best_cand_key
            self.best_confidence = round(min(0.99, highest_score), 2)

        return self.best_plate, self.best_confidence, len(self.observations)

class MultiFramePlateConsensusManager:
    """
    Manages per-camera multi-frame plate tracking state.
    """
    def __init__(self):
        # (camera_id, track_id) -> VehicleTrackPlateHistory
        self._track_histories: Dict[str, VehicleTrackPlateHistory] = {}

    def get_or_create_history(self, camera_id: str, track_id: int) -> VehicleTrackPlateHistory:
        key = f"{camera_id}:{track_id}"
        if key not in self._track_histories:
            self._track_histories[key] = VehicleTrackPlateHistory(track_id, camera_id)
        return self._track_histories[key]

    def clear_expired_tracks(self, active_track_ids_by_camera: Dict[str, List[int]]):
        """Removes plate histories for tracks that are no longer alive."""
        keys_to_delete = []
        for key in self._track_histories.keys():
            cam_id, tid_str = key.split(":")
            tid = int(tid_str)
            active_tids = active_track_ids_by_camera.get(cam_id, [])
            if tid not in active_tids:
                keys_to_delete.append(key)
        for k in keys_to_delete:
            del self._track_histories[k]

# Global Singleton
plate_consensus_manager = MultiFramePlateConsensusManager()
