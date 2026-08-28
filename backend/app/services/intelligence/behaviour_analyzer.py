import math
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Any
from app.services.ai.tracker import STrack

def is_night_hour(start_hour: int = 20, end_hour: int = 6) -> bool:
    """Checks if current UTC/local hour falls in configured night window."""
    current_hour = datetime.utcnow().hour
    if start_hour > end_hour:
        # Crosses midnight (e.g. 20:00 to 06:00)
        return current_hour >= start_hour or current_hour < end_hour
    else:
        return start_hour <= current_hour < end_hour

def is_direction_forbidden(track_direction: str, rule: str) -> bool:
    """
    Evaluates if track direction matches the zone's forbidden direction rule.
    Examples: rule="SOUTH", rule="SOUTH_WEST", rule="INBOUND"
    """
    if not rule or rule == "NONE" or track_direction == "UNKNOWN":
        return False

    rule_upper = rule.upper()
    if rule_upper == track_direction:
        return True

    # Compound matches (e.g., SOUTH matches SOUTH_EAST and SOUTH_WEST)
    if rule_upper == "SOUTH" and "SOUTH" in track_direction:
        return True
    if rule_upper == "NORTH" and "NORTH" in track_direction:
        return True
    if rule_upper == "EAST" and "EAST" in track_direction:
        return True
    if rule_upper == "WEST" and "WEST" in track_direction:
        return True

    return False

def check_loitering(
    track: STrack,
    zone_entry_time: datetime,
    min_duration_sec: float = 10.0,
    max_displacement_px: float = 40.0
) -> bool:
    """
    Detects if a subject remains inside a zone for longer than min_duration
    without significant directional progress (low displacement between trajectory points).
    """
    dwell_sec = (track.last_seen_at - zone_entry_time).total_seconds()
    if dwell_sec < min_duration_sec:
        return False

    if len(track.trajectory) < 5:
        return True

    # Calculate net displacement from entry point to current position
    start_pt = track.trajectory[0]
    curr_pt = track.trajectory[-1]
    net_displacement = math.hypot(curr_pt["x"] - start_pt["x"], curr_pt["y"] - start_pt["y"])

    # If dwelling with limited displacement, it is confirmed loitering
    return net_displacement < (max_displacement_px * 2.5)

def check_stationary_vehicle(
    track: STrack,
    zone_entry_time: datetime,
    min_duration_sec: float = 15.0,
    speed_threshold: float = 4.0
) -> bool:
    """
    Detects if a vehicle in a zone remains stationary (speed <= 4 px/s) for sustained time.
    """
    if track.category != "vehicle":
        return False

    dwell_sec = (track.last_seen_at - zone_entry_time).total_seconds()
    if dwell_sec < min_duration_sec:
        return False

    return track.speed <= speed_threshold

def check_rapid_movement(track: STrack, speed_threshold: float = 65.0) -> bool:
    """
    Detects rapid acceleration / high relative speed in image space.
    """
    return track.speed >= speed_threshold and track.frame_count >= 3

def check_group_movement(
    tracks: List[STrack],
    max_distance_px: float = 120.0
) -> List[List[int]]:
    """
    Detects clusters of 2 or more persons moving in close spatial proximity.
    Returns list of track ID groups, e.g. [[101, 102], [105, 106, 107]].
    """
    person_tracks = [t for t in tracks if t.category == "person" and t.frame_count >= 3]
    if len(person_tracks) < 2:
        return []

    groups = []
    visited = set()

    for i, t1 in enumerate(person_tracks):
        if t1.track_id in visited:
            continue

        current_group = [t1.track_id]
        for j, t2 in enumerate(person_tracks):
            if i == j or t2.track_id in visited:
                continue

            dist = math.hypot(t1.center["x"] - t2.center["x"], t1.center["y"] - t2.center["y"])
            if dist <= max_distance_px:
                # Check direction consistency if known
                if (t1.direction == "UNKNOWN" or t2.direction == "UNKNOWN" or 
                    t1.direction == t2.direction or "SOUTH" in t1.direction and "SOUTH" in t2.direction):
                    current_group.append(t2.track_id)
                    visited.add(t2.track_id)

        if len(current_group) >= 2:
            visited.add(t1.track_id)
            groups.append(current_group)

    return groups
