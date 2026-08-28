from typing import List, Dict, Tuple, Any

def is_point_in_polygon(x: float, y: float, polygon: List[Dict[str, float]]) -> bool:
    """
    Ray-casting algorithm to determine if a point (x, y) is inside a polygon.
    Works for normalized [0, 1] coordinates and pixel coordinates.
    """
    n = len(polygon)
    if n < 3:
        return False

    inside = False
    p1 = polygon[0]
    for i in range(1, n + 1):
        p2 = polygon[i % n]
        if y > min(p1["y"], p2["y"]):
            if y <= max(p1["y"], p2["y"]):
                if x <= max(p1["x"], p2["x"]):
                    if p1["y"] != p2["y"]:
                        xinters = (y - p1["y"]) * (p2["x"] - p1["x"]) / (p2["y"] - p1["y"]) + p1["x"]
                    if p1["x"] == p2["x"] or x <= xinters:
                        inside = not inside
        p1 = p2

    return inside

def get_ground_plane_point_normalized(
    bbox: Dict[str, float],
    frame_width: float = 1920.0,
    frame_height: float = 1080.0
) -> Dict[str, float]:
    """
    Extracts the bottom-center point of a bounding box (where ground intersection occurs)
    and normalizes it to [0.0, 1.0].
    """
    fw = max(1.0, frame_width)
    fh = max(1.0, frame_height)

    # Bottom-center in pixels
    bc_x_px = bbox["x"] + (bbox["width"] / 2.0)
    bc_y_px = bbox["y"] + bbox["height"]

    # Normalize
    norm_x = max(0.0, min(1.0, bc_x_px / fw))
    norm_y = max(0.0, min(1.0, bc_y_px / fh))

    return {"x": round(norm_x, 4), "y": round(norm_y, 4)}

def get_center_point_normalized(
    bbox: Dict[str, float],
    frame_width: float = 1920.0,
    frame_height: float = 1080.0
) -> Dict[str, float]:
    """
    Extracts the center point of a bounding box and normalizes to [0.0, 1.0].
    """
    fw = max(1.0, frame_width)
    fh = max(1.0, frame_height)

    c_x_px = bbox["x"] + (bbox["width"] / 2.0)
    c_y_px = bbox["y"] + (bbox["height"] / 2.0)

    norm_x = max(0.0, min(1.0, c_x_px / fw))
    norm_y = max(0.0, min(1.0, c_y_px / fh))

    return {"x": round(norm_x, 4), "y": round(norm_y, 4)}
