import math
from collections import deque
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Any
import numpy as np
from scipy.optimize import linear_sum_assignment

def calculate_iou(boxA: Dict[str, float], boxB: Dict[str, float]) -> float:
    """Calculates Intersection over Union (IoU) between two bounding boxes {x, y, width, height}."""
    xA = max(boxA["x"], boxB["x"])
    yA = max(boxA["y"], boxB["y"])
    xB = min(boxA["x"] + boxA["width"], boxB["x"] + boxB["width"])
    yB = min(boxA["y"] + boxA["height"], boxB["y"] + boxB["height"])

    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    boxAArea = boxA["width"] * boxA["height"]
    boxBArea = boxB["width"] * boxB["height"]
    unionArea = float(boxAArea + boxBArea - interArea)

    if unionArea <= 0:
        return 0.0
    return interArea / unionArea

def compute_image_space_direction(trajectory: List[Dict[str, float]], min_displacement: float = 8.0) -> str:
    """
    Computes image-space movement direction from recent trajectory history.
    Values: NORTH (Up), SOUTH (Down), EAST (Right), WEST (Left),
            NORTH_EAST, NORTH_WEST, SOUTH_EAST, SOUTH_WEST, STATIONARY, UNKNOWN.
    Note: Explicitly treats direction as image-plane coordinates.
    """
    if len(trajectory) < 3:
        return "UNKNOWN"

    start_pt = trajectory[0]
    end_pt = trajectory[-1]

    dx = end_pt["x"] - start_pt["x"]
    dy = end_pt["y"] - start_pt["y"]  # In image coords, +y is downward (South), -y is upward (North)

    distance = math.hypot(dx, dy)
    if distance < min_displacement:
        return "STATIONARY"

    angle = math.atan2(dy, dx)
    angle_deg = math.degrees(angle)

    if -22.5 <= angle_deg < 22.5:
        return "EAST"
    elif 22.5 <= angle_deg < 67.5:
        return "SOUTH_EAST"
    elif 67.5 <= angle_deg < 112.5:
        return "SOUTH"
    elif 112.5 <= angle_deg < 157.5:
        return "SOUTH_WEST"
    elif -67.5 <= angle_deg < -22.5:
        return "NORTH_EAST"
    elif -112.5 <= angle_deg < -67.5:
        return "NORTH"
    elif -157.5 <= angle_deg < -112.5:
        return "NORTH_WEST"
    else:
        return "WEST"

class STrack:
    """Represents an active multi-frame tracked object instance with persistent ID."""
    _count = 0

    def __init__(
        self,
        camera_id: str,
        detection: Dict[str, Any],
        max_history: int = 30
    ):
        STrack._count += 1
        self.track_id = STrack._count
        self.camera_id = camera_id
        self.object_type = detection["class_name"]
        self.category = detection["category"]
        self.confidence = detection["confidence"]
        self.bbox = dict(detection["bbox"])
        self.previous_bbox = dict(detection["bbox"])
        
        self.first_seen_at = detection.get("timestamp", datetime.utcnow())
        self.last_seen_at = self.first_seen_at
        self.frame_count = 1
        self.time_since_update = 0
        self.state = "DETECTED" # DETECTED -> TRACKING -> TEMPORARILY_LOST -> REACQUIRED -> EXPIRED

        self.max_history = max_history
        self.trajectory = deque(maxlen=max_history)
        
        # Center points
        cx, cy, bcx, bcy = self._calculate_centers(self.bbox)
        self.center = {"x": round(cx, 1), "y": round(cy, 1)}
        self.bottom_center = {"x": round(bcx, 1), "y": round(bcy, 1)}
        self.trajectory.append(self.center)

        self.speed = 0.0
        self.direction = "UNKNOWN"

    def _calculate_centers(self, box: Any) -> Tuple[float, float, float, float]:
        if isinstance(box, dict):
            x = float(box.get("x", 0.0))
            y = float(box.get("y", 0.0))
            w = float(box.get("width", box.get("w", 50.0)))
            h = float(box.get("height", box.get("h", 50.0)))
            cx = x + w / 2.0
            cy = y + h / 2.0
            bcx = cx
            bcy = y + h
            return cx, cy, bcx, bcy
        elif isinstance(box, (list, tuple)) and len(box) >= 4:
            x1, y1, x2, y2 = float(box[0]), float(box[1]), float(box[2]), float(box[3])
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            bcx = cx
            bcy = y2
            return cx, cy, bcx, bcy
        return 0.0, 0.0, 0.0, 0.0

    def update(self, detection: Dict[str, Any]):
        """Updates track with a matched detection in the current frame."""
        now = detection.get("timestamp", datetime.utcnow())
        dt = (now - self.last_seen_at).total_seconds()
        
        self.previous_bbox = dict(self.bbox)
        self.bbox = dict(detection["bbox"])
        self.confidence = detection["confidence"]
        self.last_seen_at = now
        self.frame_count += 1
        self.time_since_update = 0

        if self.state in ["DETECTED", "TEMPORARILY_LOST"]:
            self.state = "TRACKING" if self.frame_count >= 2 else "DETECTED"

        # Calculate new centers
        cx, cy, bcx, bcy = self._calculate_centers(self.bbox)
        new_center = {"x": round(cx, 1), "y": round(cy, 1)}
        self.bottom_center = {"x": round(bcx, 1), "y": round(bcy, 1)}

        # Speed estimate (px/s)
        if dt > 0 and len(self.trajectory) > 0:
            last_pt = self.trajectory[-1]
            dist = math.hypot(new_center["x"] - last_pt["x"], new_center["y"] - last_pt["y"])
            instant_speed = dist / max(0.01, dt)
            self.speed = round(0.7 * self.speed + 0.3 * instant_speed, 1)

        self.center = new_center
        self.trajectory.append(new_center)
        self.direction = compute_image_space_direction(list(self.trajectory))

    def mark_missed(self):
        """Marks track as unobserved in current frame."""
        self.time_since_update += 1
        if self.time_since_update > 1:
            self.state = "TEMPORARILY_LOST"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track_id": self.track_id,
            "camera_id": self.camera_id,
            "object_type": self.object_type,
            "category": self.category,
            "confidence": round(self.confidence, 3),
            "bbox": self.bbox,
            "center": self.center,
            "bottom_center": self.bottom_center,
            "first_seen_at": self.first_seen_at.isoformat(),
            "last_seen_at": self.last_seen_at.isoformat(),
            "frame_count": self.frame_count,
            "speed": self.speed,
            "direction": self.direction,
            "tracking_state": self.state,
            "trajectory": list(self.trajectory)
        }

class ByteTracker:
    """
    ByteTrack Object Tracking Engine for multi-frame object persistence.
    """
    def __init__(
        self,
        camera_id: str,
        track_thresh: float = 0.45,
        match_thresh: float = 0.70,
        max_lost_frames: int = 30,
        max_history: int = 30
    ):
        self.camera_id = camera_id
        self.track_thresh = track_thresh
        self.match_thresh = match_thresh
        self.max_lost_frames = max_lost_frames
        self.max_history = max_history

        self.tracked_stracks: List[STrack] = []
        self.lost_stracks: List[STrack] = []
        self.frame_id = 0

    def update_params(
        self,
        track_thresh: Optional[float] = None,
        match_thresh: Optional[float] = None,
        max_lost_frames: Optional[int] = None,
        max_history: Optional[int] = None
    ):
        """Dynamically tunes ByteTrack tracking parameters on the fly."""
        if track_thresh is not None:
            self.track_thresh = float(track_thresh)
        if match_thresh is not None:
            self.match_thresh = float(match_thresh)
        if max_lost_frames is not None:
            self.max_lost_frames = int(max_lost_frames)
        if max_history is not None:
            self.max_history = int(max_history)

    def update(self, detections: List[Dict[str, Any]]) -> List[STrack]:
        """
        Updates the tracker with detections for the current frame.
        Returns list of currently active confirmed tracks.
        """
        self.frame_id += 1
        
        # Split detections into high and low confidence
        high_dets = [d for d in detections if d["confidence"] >= self.track_thresh]
        low_dets = [d for d in detections if d["confidence"] < self.track_thresh]

        # 1. First association: match high confidence detections with active confirmed/lost tracks
        unconfirmed_tracks = [t for t in self.tracked_stracks if t.state == "DETECTED"]
        confirmed_tracks = [t for t in self.tracked_stracks if t.state == "TRACKING"]
        pool_tracks = confirmed_tracks + self.lost_stracks

        matched_tracks_1, unmatched_tracks_1, unmatched_dets_1 = self._associate(
            pool_tracks, high_dets, self.match_thresh
        )

        for track, det in matched_tracks_1:
            track.update(det)
            if track in self.lost_stracks:
                self.lost_stracks.remove(track)
            if track not in self.tracked_stracks:
                self.tracked_stracks.append(track)

        # 2. Second association: match remaining active tracks with low confidence detections
        matched_tracks_2, unmatched_tracks_2, _ = self._associate(
            unmatched_tracks_1, low_dets, self.match_thresh - 0.2
        )

        for track, det in matched_tracks_2:
            track.update(det)
            if track in self.lost_stracks:
                self.lost_stracks.remove(track)
            if track not in self.tracked_stracks:
                self.tracked_stracks.append(track)

        # Handle unmatched confirmed tracks
        for track in unmatched_tracks_2:
            track.mark_missed()
            if track in self.tracked_stracks:
                self.tracked_stracks.remove(track)
            if track not in self.lost_stracks:
                self.lost_stracks.append(track)

        # 3. Third association: match unmatched high detections with unconfirmed tracks
        matched_unconfirmed, unmatched_unconfirmed, remaining_high_dets = self._associate(
            unconfirmed_tracks, unmatched_dets_1, self.match_thresh
        )

        for track, det in matched_unconfirmed:
            track.update(det)

        for track in unmatched_unconfirmed:
            track.mark_missed()
            if track in self.tracked_stracks:
                self.tracked_stracks.remove(track)
            if track not in self.lost_stracks:
                self.lost_stracks.append(track)

        # 4. Initialize new tracks for remaining unassociated high-confidence detections
        for det in remaining_high_dets:
            new_track = STrack(self.camera_id, det, max_history=self.max_history)
            self.tracked_stracks.append(new_track)

        # 5. Clean up expired lost tracks
        expired_tracks = []
        for track in self.lost_stracks:
            if track.time_since_update > self.max_lost_frames:
                track.state = "EXPIRED"
                expired_tracks.append(track)

        for track in expired_tracks:
            self.lost_stracks.remove(track)

        # Return all active tracks
        active = [t for t in self.tracked_stracks if t.state in ["TRACKING", "DETECTED"]]
        return active

    def _associate(
        self,
        tracks: List[STrack],
        detections: List[Dict[str, Any]],
        threshold: float
    ) -> Tuple[List[Tuple[STrack, Dict[str, Any]]], List[STrack], List[Dict[str, Any]]]:
        """Performs bipartite matching using IoU cost matrix and Hungarian algorithm."""
        if len(tracks) == 0 or len(detections) == 0:
            return [], tracks.copy(), detections.copy()

        cost_matrix = np.zeros((len(tracks), len(detections)), dtype=np.float32)
        for i, track in enumerate(tracks):
            for j, det in enumerate(detections):
                if track.category == det["category"] or track.object_type == det["class_name"]:
                    iou = calculate_iou(track.bbox, det["bbox"])
                    cost_matrix[i, j] = 1.0 - iou
                else:
                    cost_matrix[i, j] = 1.0

        row_ind, col_ind = linear_sum_assignment(cost_matrix)

        matched = []
        unmatched_tracks = set(range(len(tracks)))
        unmatched_dets = set(range(len(detections)))

        for r, c in zip(row_ind, col_ind):
            if cost_matrix[r, c] <= (1.0 - (1.0 - threshold) * 0.5):
                matched.append((tracks[r], detections[c]))
                unmatched_tracks.discard(r)
                unmatched_dets.discard(c)

        return (
            matched,
            [tracks[i] for i in unmatched_tracks],
            [detections[j] for j in unmatched_dets]
        )

    def reset(self):
        """Clears all track state for this camera."""
        self.tracked_stracks.clear()
        self.lost_stracks.clear()
        self.frame_id = 0
