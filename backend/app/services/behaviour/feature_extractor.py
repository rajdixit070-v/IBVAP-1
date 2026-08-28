import math
import numpy as np
from typing import List, Dict, Any, Tuple, Optional

class BehaviourFeatureExtractor:
    """
    Kinematic and spatial feature extractor for object tracks and trajectories.
    Computes speed, acceleration, stopping duration, direction oscillation,
    fence-edge alignment, and stationary dwell metrics.
    """

    @staticmethod
    def calculate_kinematics(trajectory: List[Tuple[float, float, float]]) -> Dict[str, float]:
        """
        Computes current speed (pixels/sec or relative units), max speed, and acceleration.
        trajectory is a list of (x, y, timestamp_sec).
        """
        if len(trajectory) < 2:
            return {"speed": 0.0, "acceleration": 0.0, "max_speed": 0.0}

        speeds = []
        for i in range(1, len(trajectory)):
            x1, y1, t1 = trajectory[i - 1]
            x2, y2, t2 = trajectory[i]
            dt = max(0.01, t2 - t1)
            dist = math.hypot(x2 - x1, y2 - y1)
            speeds.append(dist / dt)

        current_speed = speeds[-1]
        max_speed = max(speeds)
        
        # Acceleration between last two speed intervals
        acc = 0.0
        if len(speeds) >= 2:
            dt = max(0.01, trajectory[-1][2] - trajectory[-2][2])
            acc = (speeds[-1] - speeds[-2]) / dt

        return {
            "speed": round(current_speed, 2),
            "acceleration": round(acc, 2),
            "max_speed": round(max_speed, 2)
        }

    @staticmethod
    def detect_rapid_direction_changes(
        trajectory: List[Tuple[float, float, float]],
        min_changes: int = 3,
        window_sec: float = 15.0
    ) -> Tuple[bool, int]:
        """
        Detects oscillatory or rapid direction changes (e.g. forward/backward/forward).
        """
        if len(trajectory) < 4:
            return False, 0

        now = trajectory[-1][2]
        recent = [p for p in trajectory if now - p[2] <= window_sec]
        if len(recent) < 4:
            return False, 0

        direction_changes = 0
        prev_dx = recent[1][0] - recent[0][0]
        prev_dy = recent[1][1] - recent[0][1]

        for i in range(2, len(recent)):
            dx = recent[i][0] - recent[i - 1][0]
            dy = recent[i][1] - recent[i - 1][1]

            dot = (prev_dx * dx) + (prev_dy * dy)
            mag1 = math.hypot(prev_dx, prev_dy)
            mag2 = math.hypot(dx, dy)

            if mag1 > 0.01 and mag2 > 0.01:
                cos_theta = dot / (mag1 * mag2)
                # Angle > 110 degrees is a significant reversal
                if cos_theta < -0.35:
                    direction_changes += 1
                    prev_dx, prev_dy = dx, dy
            else:
                prev_dx, prev_dy = dx, dy

        return direction_changes >= min_changes, direction_changes

    @staticmethod
    def detect_stop_and_go(
        trajectory: List[Tuple[float, float, float]],
        speed_threshold: float = 0.05,
        min_stops: int = 3,
        window_sec: float = 30.0
    ) -> Tuple[bool, int]:
        """
        Detects intermittent stop-and-go movements (e.g. move-stop-move-stop).
        """
        if len(trajectory) < 6:
            return False, 0

        now = trajectory[-1][2]
        recent = [p for p in trajectory if now - p[2] <= window_sec]
        if len(recent) < 6:
            return False, 0

        stops = 0
        was_stopped = False

        for i in range(1, len(recent)):
            x1, y1, t1 = recent[i - 1]
            x2, y2, t2 = recent[i]
            dt = max(0.01, t2 - t1)
            speed = math.hypot(x2 - x1, y2 - y1) / dt

            is_stopped = speed < speed_threshold
            if is_stopped and not was_stopped:
                stops += 1
                was_stopped = True
            elif not is_stopped:
                was_stopped = False

        return stops >= min_stops, stops

    @staticmethod
    def detect_fence_edge_movement(
        trajectory: List[Tuple[float, float, float]],
        polygon: List[Dict[str, float]],
        distance_threshold: float = 0.12,
        min_points: int = 5
    ) -> bool:
        """
        Detects prolonged movement closely parallel to a virtual fence/polygon boundary.
        """
        if len(trajectory) < min_points or not polygon:
            return False

        # Check recent positions proximity to polygon segments
        recent_positions = trajectory[-min_points:]
        near_fence_count = 0

        for x, y, _ in recent_positions:
            min_dist = float("inf")
            for i in range(len(polygon)):
                p1 = polygon[i]
                p2 = polygon[(i + 1) % len(polygon)]
                # Point-to-segment distance
                dist = BehaviourFeatureExtractor._point_to_segment_dist(x, y, p1["x"], p1["y"], p2["x"], p2["y"])
                min_dist = min(min_dist, dist)

            if min_dist <= distance_threshold:
                near_fence_count += 1

        return near_fence_count >= (min_points - 1)

    @staticmethod
    def _point_to_segment_dist(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
        l2 = (x2 - x1)**2 + (y2 - y1)**2
        if l2 == 0:
            return math.hypot(px - x1, py - y1)
        t = max(0.0, min(1.0, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2))
        proj_x = x1 + t * (x2 - x1)
        proj_y = y1 + t * (y2 - y1)
        return math.hypot(px - proj_x, py - proj_y)

feature_extractor = BehaviourFeatureExtractor()
