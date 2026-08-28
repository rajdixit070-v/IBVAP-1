import os
import time
import socket
import re
import urllib.parse
from typing import Optional, Dict, Any, Tuple
import cv2
from app.schemas.camera import CameraTestResponse
from app.core.security import build_authenticated_rtsp_url

# Configure OpenCV FFMPEG transport for low-latency TCP handshake
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;4000000"

def _parse_host_port(url: str) -> Tuple[Optional[str], int]:
    """Extracts host and port from an RTSP / HTTP URL."""
    try:
        if "://" in url:
            parsed = urllib.parse.urlparse(url)
            host = parsed.hostname
            port = parsed.port or (554 if parsed.scheme == "rtsp" else 80)
            return host, port
    except Exception:
        pass
    return None, 554

def _check_tcp_port(host: str, port: int, timeout_sec: float = 3.0) -> Tuple[bool, Optional[str], float]:
    """Quick socket check to verify camera host & port reachability without hanging."""
    start_time = time.time()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout_sec)
            s.connect((host, port))
            latency = (time.time() - start_time) * 1000.0
            return True, None, latency
    except socket.timeout:
        return False, "TIMEOUT", (time.time() - start_time) * 1000.0
    except ConnectionRefusedError:
        return False, "CONNECTION_REFUSED", (time.time() - start_time) * 1000.0
    except socket.gaierror:
        return False, "INVALID_RTSP_URL", (time.time() - start_time) * 1000.0
    except Exception as e:
        return False, "UNKNOWN_ERROR", (time.time() - start_time) * 1000.0

def test_rtsp_connection(
    rtsp_url: str, 
    username: Optional[str] = None, 
    password: Optional[str] = None,
    timeout_sec: float = 8.0
) -> CameraTestResponse:
    """
    Actively probes and tests an RTSP camera stream.
    Validates TCP reachability, opens video stream via OpenCV/FFmpeg,
    captures a test frame, and measures resolution, FPS, and latency.
    """
    clean_url = rtsp_url.strip() if rtsp_url else ""
    
    # 1. Basic URL validation
    if not clean_url:
        return CameraTestResponse(
            success=False,
            connected=False,
            error_type="INVALID_RTSP_URL",
            error_message="RTSP URL cannot be empty."
        )

    # 2. Support for synthetic test streams (e.g. for testing in simulated environments)
    if clean_url.startswith("synthetic://") or clean_url.startswith("test://"):
        return CameraTestResponse(
            success=True,
            connected=True,
            resolution="1920x1080",
            fps=25.0,
            codec="H.264",
            latency_ms=12.5,
            details={"mode": "Synthetic Test Stream", "status": "Ready"}
        )

    if not clean_url.startswith("rtsp://") and not clean_url.startswith("http://") and not clean_url.startswith("https://"):
        return CameraTestResponse(
            success=False,
            connected=False,
            error_type="INVALID_RTSP_URL",
            error_message="Stream URL must begin with 'rtsp://' (or 'http://' / 'https://')."
        )

    # 3. Socket check to prevent long blocking on dead IPs
    host, port = _parse_host_port(clean_url)
    if host:
        is_reachable, socket_error, socket_latency = _check_tcp_port(host, port, timeout_sec=min(3.0, timeout_sec))
        if not is_reachable:
            error_map = {
                "CONNECTION_REFUSED": f"Connection refused at {host}:{port}. Ensure camera is powered on and RTSP port 554 is open.",
                "TIMEOUT": f"Connection timed out trying to reach camera at {host}:{port}.",
                "INVALID_RTSP_URL": f"Host '{host}' could not be resolved. Check IP address or hostname.",
                "UNKNOWN_ERROR": f"Unable to reach network host {host}:{port}."
            }
            return CameraTestResponse(
                success=False,
                connected=False,
                latency_ms=round(socket_latency, 2),
                error_type=socket_error or "CONNECTION_REFUSED",
                error_message=error_map.get(socket_error, f"Failed to connect to {host}:{port}")
            )

    # 4. Open RTSP stream with OpenCV FFmpeg backend
    auth_url = build_authenticated_rtsp_url(clean_url, username, password)
    start_time = time.time()
    
    cap = None
    try:
        cap = cv2.VideoCapture(auth_url, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            # Try default backend as fallback
            cap.release()
            cap = cv2.VideoCapture(auth_url)
            
        if not cap.isOpened():
            latency = (time.time() - start_time) * 1000.0
            error_msg = "Could not open RTSP video stream. Check credentials or stream path."
            error_type = "STREAM_UNAVAILABLE"
            if username or password:
                error_type = "AUTHENTICATION_FAILED"
                error_msg = "Failed to authenticate with camera. Verify username and password."
            return CameraTestResponse(
                success=False,
                connected=False,
                latency_ms=round(latency, 2),
                error_type=error_type,
                error_message=error_msg
            )
            
        # Try reading a test frame
        ret, frame = cap.read()
        latency = (time.time() - start_time) * 1000.0
        
        if not ret or frame is None:
            return CameraTestResponse(
                success=False,
                connected=False,
                latency_ms=round(latency, 2),
                error_type="DECODER_ERROR",
                error_message="Connected to camera, but failed to decode video frames. Unsupported codec or stream empty."
            )
            
        # Extract properties
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or frame.shape[1]
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or frame.shape[0]
        reported_fps = float(cap.get(cv2.CAP_PROP_FPS))
        fps = reported_fps if (reported_fps > 0 and reported_fps <= 120) else 25.0
        
        # Determine codec if available
        fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
        codec_name = "H.264"
        if fourcc > 0:
            try:
                codec_chars = "".join([chr((fourcc >> 8 * i) & 0xFF) for i in range(4)]).strip()
                if codec_chars:
                    codec_name = codec_chars
            except Exception:
                pass
                
        return CameraTestResponse(
            success=True,
            connected=True,
            resolution=f"{width}x{height}",
            fps=round(fps, 1),
            codec=codec_name,
            latency_ms=round(latency, 1),
            details={
                "frame_width": width,
                "frame_height": height,
                "aspect_ratio": f"{round(width/height, 2)}:1" if height > 0 else "16:9"
            }
        )
    except Exception as e:
        latency = (time.time() - start_time) * 1000.0
        return CameraTestResponse(
            success=False,
            connected=False,
            latency_ms=round(latency, 2),
            error_type="UNKNOWN_ERROR",
            error_message=f"RTSP stream error: {str(e)}"
        )
    finally:
        if cap is not None:
            cap.release()
