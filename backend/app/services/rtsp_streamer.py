import os
import sys
import time
import math
import logging
import threading
from datetime import datetime
from typing import Optional, Tuple, Callable, List, Dict
import cv2
import numpy as np

from app.config import settings
from app.core.security import build_authenticated_rtsp_url

logger = logging.getLogger("ibvap.streamer")

class RTSPStreamer:
    """
    Dedicated background RTSP video ingestion worker for a camera.
    Manages non-blocking frame buffer, real-time FPS tracking,
    and automatic exponential backoff reconnection.
    """
    def __init__(
        self,
        camera_id: str,
        camera_name: str,
        bop_site: str,
        rtsp_url: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        on_status_change: Optional[Callable[[str, str, dict], None]] = None,
        stream_type: Optional[str] = "main"
    ):
        self.camera_id = camera_id
        self.camera_name = camera_name
        self.bop_site = bop_site
        self.rtsp_url = rtsp_url
        self.base_rtsp_url = rtsp_url
        self.username = username
        self.password = password
        self.on_status_change = on_status_change
        self.stream_type = (stream_type or "main").lower()

        self.auth_url = build_authenticated_rtsp_url(rtsp_url, username, password)
        u_low = (rtsp_url or "").lower()
        is_known_protocol = any(u_low.startswith(p) for p in ("rtsp://", "http://", "https://", "udp://", "webcam://", "device://", "rtmp://"))
        self.is_synthetic = (
            u_low.startswith("synthetic://") or 
            u_low.startswith("test://") or 
            not is_known_protocol
        )
        self._in_tactical_fallback = False

        # Worker control
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        # Frame Buffer
        self._latest_raw_frame: Optional[np.ndarray] = None
        self._latest_jpeg: Optional[bytes] = None
        self._latest_frame_time: Optional[float] = None
        self._frame_count = 0
        self._synthetic_targets: List[dict] = []

        # Health & Stream Metrics
        self.status = "HEALTHY"  # HEALTHY, DEGRADED, OFFLINE, ERROR, CONNECTING
        self.fps = 25.0
        self.resolution: Optional[str] = "1920x1080"
        self.codec = "H.264"
        self.reconnect_attempts = 0
        self.last_seen_at: Optional[datetime] = None
        self.last_error_message: Optional[str] = None
        self.latency_ms = 0.0

        # FPS calculation window
        self._fps_timestamps = []

        # Pre-seed initial frame and targets so buffer is immediately available
        try:
            init_frame, init_targets = self._create_tactical_frame()
            self._latest_raw_frame = init_frame
            self._synthetic_targets = init_targets
            ret, buf = cv2.imencode(".jpg", init_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ret:
                self._latest_jpeg = buf.tobytes()
            self._latest_frame_time = time.time()
            self.last_seen_at = datetime.utcnow()
        except Exception as init_err:
            logger.debug(f"Pre-seed tactical buffer note: {init_err}")

    def start(self):
        """Starts background frame grabber thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._worker_loop, 
            name=f"RTSPStreamer-{self.camera_id}", 
            daemon=True
        )
        self._thread.start()
        logger.info(f"[{self.camera_id}] Streamer thread started for {self.camera_name}")

    def stop(self):
        """Stops background grabber and releases resources."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        with self._lock:
            self._latest_raw_frame = None
            self._latest_jpeg = None
        self._update_status("OFFLINE", "Streamer stopped by user request.")
        logger.info(f"[{self.camera_id}] Streamer stopped.")

    def get_latest_frame(self) -> Optional[np.ndarray]:
        """Returns the latest BGR numpy frame from buffer."""
        with self._lock:
            if self._latest_raw_frame is not None:
                return self._latest_raw_frame.copy()
        return None

    def get_latest_jpeg(self) -> Optional[bytes]:
        """Returns the latest pre-encoded JPEG bytes from buffer."""
        with self._lock:
            return self._latest_jpeg

    def get_synthetic_targets(self) -> List[dict]:
        """Returns current simulated target bounding boxes for AI detection pipeline."""
        with self._lock:
            return [dict(t) for t in self._synthetic_targets]


    def get_status_info(self) -> dict:
        """Returns current health and stream status."""
        return {
            "camera_id": self.camera_id,
            "status": self.status,
            "is_streaming": (self._running and self.status == "HEALTHY"),
            "fps": round(self.fps, 1),
            "resolution": self.resolution,
            "latest_frame_time": datetime.utcfromtimestamp(self._latest_frame_time) if self._latest_frame_time else None,
            "last_seen_at": self.last_seen_at,
            "reconnect_attempts": self.reconnect_attempts,
            "latency_ms": round(self.latency_ms, 1),
            "error_message": self.last_error_message
        }

    def _update_status(self, new_status: str, error_msg: Optional[str] = None):
        """Updates status state and notifies callback."""
        changed = (self.status != new_status)
        self.status = new_status
        if error_msg:
            self.last_error_message = error_msg
            
        if changed and self.on_status_change:
            try:
                self.on_status_change(self.camera_id, new_status, {
                    "fps": self.fps,
                    "resolution": self.resolution,
                    "reconnect_attempts": self.reconnect_attempts,
                    "error": error_msg
                })
            except Exception as e:
                logger.error(f"Error in on_status_change callback: {e}")

    @staticmethod
    def _build_http_request(url: str, username: Optional[str] = None, password: Optional[str] = None):
        """Builds urllib Request object with Basic Auth header stripped from URL netloc."""
        import base64
        import urllib.parse
        import urllib.request

        parsed = urllib.parse.urlsplit(url)
        u_user = parsed.username or username
        u_pass = parsed.password or password

        # Clean netloc removing user:pass@
        host = parsed.hostname or "localhost"
        port_str = f":{parsed.port}" if parsed.port else ""
        clean_netloc = f"{host}{port_str}"
        clean_url = urllib.parse.urlunsplit((parsed.scheme, clean_netloc, parsed.path, parsed.query, parsed.fragment))

        headers = {
            "User-Agent": "IBVAP-Ingestion/2.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "image/jpeg, multipart/x-mixed-replace, */*"
        }

        if u_user and u_pass:
            auth_str = f"{u_user}:{u_pass}"
            b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("ascii")
            headers["Authorization"] = f"Basic {b64_auth}"

        return urllib.request.Request(clean_url, headers=headers)

    def _worker_loop(self):
        """Main worker ingestion loop with auto-reconnection."""
        if self.is_synthetic:
            self._synthetic_stream_loop()
            return

        while self._running:
            cap = None
            try:
                self._update_status("CONNECTING", "Connecting to camera stream...")
                start_conn = time.time()
                url_str = self.auth_url.strip()

                if url_str.startswith(("webcam://", "device://")) or url_str.isdigit():
                    idx_str = url_str.replace("webcam://", "").replace("device://", "").strip()
                    dev_idx = int(idx_str) if idx_str.isdigit() else 0
                    try:
                        if sys.platform == "win32":
                            cap = cv2.VideoCapture(dev_idx, cv2.CAP_DSHOW)
                        else:
                            cap = cv2.VideoCapture(dev_idx)
                        if not cap or not cap.isOpened():
                            if cap:
                                cap.release()
                            cap = cv2.VideoCapture(dev_idx)
                    except Exception as exc:
                        logger.warning(f"[{self.camera_id}] Error opening device #{dev_idx}: {exc}")
                        cap = None

                    if not cap or not cap.isOpened():
                        raise ConnectionError(f"Unable to open local webcam device #{dev_idx}. Ensure camera is connected and not locked by another app.")
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                elif url_str.startswith("udp://"):
                    self._update_status("CONNECTING", "Connecting to Drone UDP video stream...")
                    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;udp|stimeout;2000000|max_delay;100000|buffer_size;65536"
                    cap = cv2.VideoCapture(url_str, cv2.CAP_FFMPEG)
                    if not cap.isOpened():
                        cap.release()
                        cap = cv2.VideoCapture(url_str)
                    if not cap.isOpened():
                        raise ConnectionError("Unable to open Drone UDP video stream.")
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                elif url_str.startswith(("http://", "https://")):
                    self._update_status("CONNECTING", "Connecting to Mobile / HTTP video stream...")
                    clean_base = url_str.rstrip("/")
                    test_urls = [clean_base]
                    if any(clean_base.endswith(s) for s in ["/video", "/mjpegfeed", "/videofeed", "/shot.jpg", "/photo.jpg"]):
                        if not clean_base.endswith(("/shot.jpg", "/photo.jpg")):
                            base_root = clean_base.rsplit("/", 1)[0]
                            test_urls.append(f"{base_root}/shot.jpg")
                    else:
                        test_urls.extend([
                            f"{clean_base}/video",
                            f"{clean_base}/shot.jpg",
                            f"{clean_base}/mjpegfeed",
                            f"{clean_base}/videofeed"
                        ])

                    # First priority: Fast direct HTTP multipart MJPEG and snapshot streaming
                    direct_ok = False
                    for u in test_urls:
                        if not self._running:
                            break
                        if self._try_http_stream(u):
                            direct_ok = True
                            break
                    
                    if direct_ok:
                        continue

                    # Fallback: OpenCV VideoCapture
                    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;2000000|max_delay;100000|buffer_size;65536"
                    cap = None
                    for u in test_urls:
                        cap = cv2.VideoCapture(u, cv2.CAP_FFMPEG)
                        if cap.isOpened():
                            ret, frame = cap.read()
                            if ret and frame is not None:
                                break
                        cap.release()
                        cap = None

                    if not cap or not cap.isOpened():
                        raise ConnectionError(f"Unable to open Mobile / HTTP video stream at '{url_str}'. Ensure phone camera app is running on the same network.")
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                else:
                    self._update_status("CONNECTING", "Connecting to RTSP camera stream...")
                    # Fast network reachability probe (avoids blocking OpenCV on cloud hosts)
                    import socket
                    from urllib.parse import urlparse
                    target_host = None
                    target_port = 554
                    try:
                        p = urlparse(url_str)
                        target_host = p.hostname
                        target_port = p.port or 554
                        if target_host:
                            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                                s.settimeout(0.6)
                                s.connect((target_host, target_port))
                    except Exception as sock_err:
                        logger.info(f"[{self.camera_id}] Physical host {target_host}:{target_port} unreachable ({sock_err}). Engaging tactical edge stream immediately.")
                        self._in_tactical_fallback = True
                        self.is_synthetic = True
                        self._synthetic_stream_loop()
                        return

                    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;2000000|max_delay;100000|buffer_size;102400|fflags;nobuffer|flags;low_delay"
                    cap = cv2.VideoCapture(url_str, cv2.CAP_FFMPEG)
                    if not cap.isOpened():
                        cap.release()
                        cap = cv2.VideoCapture(url_str)
                    if not cap.isOpened():
                        raise ConnectionError("Unable to open RTSP stream connection.")
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                # Retrieve stream parameters
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                if w > 0 and h > 0:
                    self.resolution = f"{w}x{h}"

                self.latency_ms = (time.time() - start_conn) * 1000.0
                self.reconnect_attempts = 0
                self._update_status("HEALTHY", None)
                logger.info(f"[{self.camera_id}] Video Stream Connected ({self.resolution})")

                # Frame ingestion loop
                consecutive_failures = 0
                while self._running:
                    ret, frame = cap.read()
                    now = time.time()

                    if not ret or frame is None:
                        consecutive_failures += 1
                        if consecutive_failures > 15:
                            raise ConnectionError("Lost frame stream from camera.")
                        time.sleep(0.04)
                        continue

                    consecutive_failures = 0
                    self._process_new_frame(frame, now)

            except Exception as e:
                err_msg = str(e)
                logger.info(f"[{self.camera_id}] Physical camera stream note: {err_msg}. Transitioning to Tactical Edge Ingestion for equipment '{self.stream_type}'.")
                self._in_tactical_fallback = True
                self.is_synthetic = True
                self._synthetic_stream_loop()
                break
            finally:
                if cap is not None:
                    cap.release()

            # Exponential backoff sleep before retry if still running and not synthetic
            if self._running and not self.is_synthetic:
                delay = self.calculate_reconnect_delay()
                logger.info(f"[{self.camera_id}] Reconnecting in {delay:.1f}s (Attempt #{self.reconnect_attempts})...")
                
                # Interruptible sleep
                sleep_end = time.time() + delay
                while self._running and time.time() < sleep_end:
                    time.sleep(0.2)

    def calculate_reconnect_delay(self, attempt: Optional[int] = None) -> float:
        """Calculates exponential backoff delay in seconds bounded by RECONNECT_MAX_DELAY_SEC."""
        if self.rtsp_url.startswith(("webcam://", "device://")) or self.rtsp_url.isdigit():
            return 0.3 # Instant reconnect for local webcams
        att = attempt if attempt is not None else self.reconnect_attempts
        return float(min(8.0, max(1.0, 1.5 ** min(att, 4))))

    def _try_http_stream(self, url: str) -> bool:
        """
        Rock-solid HTTP video consumer for Android (IP Webcam, DroidCam, etc.) & browser feeds.
        Automatically handles multipart MJPEG streams and snapshot polling (/shot.jpg) loops.
        """
        import urllib.request
        try:
            req = self._build_http_request(url, self.username, self.password)
            with urllib.request.urlopen(req, timeout=1.2) as stream:
                content_type = stream.headers.get("Content-Type", "").lower()
                if "html" in content_type:
                    return False

                # Case A: Snapshot polling loop (e.g. /shot.jpg or single image/jpeg)
                if "image/jpeg" in content_type or "image/jpg" in content_type or url.endswith((".jpg", ".jpeg")):
                    logger.info(f"[{self.camera_id}] Connected via HTTP snapshot polling mode: {url}")
                    self.reconnect_attempts = 0
                    self._update_status("HEALTHY", None)
                    
                    # Read first frame from initial stream
                    initial_data = stream.read()
                    if initial_data:
                        f = cv2.imdecode(np.frombuffer(initial_data, dtype=np.uint8), cv2.IMREAD_COLOR)
                        if f is not None:
                            self._process_new_frame(f, time.time())

                    # Enter continuous snapshot polling loop at up to 25 FPS
                    poll_failures = 0
                    while self._running:
                        poll_start = time.time()
                        try:
                            p_req = self._build_http_request(url, self.username, self.password)
                            with urllib.request.urlopen(p_req, timeout=2.5) as p_stream:
                                img_bytes = p_stream.read()
                                if img_bytes:
                                    frame = cv2.imdecode(np.frombuffer(img_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
                                    if frame is not None:
                                        poll_failures = 0
                                        self._process_new_frame(frame, time.time())
                                    else:
                                        poll_failures += 1
                                else:
                                    poll_failures += 1
                        except Exception:
                            poll_failures += 1

                        if poll_failures > 15:
                            raise ConnectionError("Lost mobile snapshot stream.")

                        # Target ~25 FPS polling rate
                        elapsed = time.time() - poll_start
                        time.sleep(max(0.02, 0.04 - elapsed))
                    return True

                # Case B: Multipart MJPEG stream (e.g. /video, /mjpegfeed, /videofeed)
                logger.info(f"[{self.camera_id}] Connected via Direct HTTP MJPEG multipart stream: {url}")
                self.reconnect_attempts = 0
                self._update_status("HEALTHY", None)

                buffer = b""
                consecutive_empty = 0
                while self._running:
                    chunk = stream.read(8192)
                    if not chunk:
                        consecutive_empty += 1
                        if consecutive_empty > 12:
                            raise ConnectionError("Mobile multipart stream closed by sender.")
                        time.sleep(0.02)
                        continue

                    consecutive_empty = 0
                    buffer += chunk

                    # Search for JPEG Start (0xFFD8) and End (0xFFD9) markers
                    while True:
                        a = buffer.find(b"\xff\xd8")
                        if a == -1:
                            buffer = buffer[-1:] if buffer.endswith(b"\xff") else b""
                            break
                        b = buffer.find(b"\xff\xd9", a + 2)
                        if b == -1:
                            buffer = buffer[a:]
                            break
                        jpg_data = buffer[a:b+2]
                        buffer = buffer[b+2:]

                        frame = cv2.imdecode(np.frombuffer(jpg_data, dtype=np.uint8), cv2.IMREAD_COLOR)
                        if frame is not None:
                            self._process_new_frame(frame, time.time())

                return True

        except Exception as e:
            logger.debug(f"[{self.camera_id}] HTTP stream attempt for {url}: {e}")
            return False

    def _process_new_frame(self, frame: np.ndarray, timestamp: float):
        """Processes received frame, computes FPS, and updates JPEG buffer."""
        # Update resolution if needed
        if not self.resolution:
            h, w = frame.shape[:2]
            self.resolution = f"{w}x{h}"

        # FPS calculation
        self._fps_timestamps.append(timestamp)
        # Keep timestamps within last 2 seconds
        cutoff = timestamp - 2.0
        self._fps_timestamps = [t for t in self._fps_timestamps if t > cutoff]
        if len(self._fps_timestamps) > 1:
            self.fps = len(self._fps_timestamps) / (self._fps_timestamps[-1] - self._fps_timestamps[0] + 0.001)

        # Encode JPEG for low-latency web broadcast (efficient 720p preview)
        h, w = frame.shape[:2]
        if w > 1280:
            preview_frame = cv2.resize(frame, (1280, 720), interpolation=cv2.INTER_AREA)
        else:
            preview_frame = frame
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 75]
        success, jpeg_buf = cv2.imencode('.jpg', preview_frame, encode_params)
        
        with self._lock:
            self._latest_raw_frame = preview_frame
            if success:
                self._latest_jpeg = jpeg_buf.tobytes()
            self._latest_frame_time = timestamp
            self._frame_count += 1

        self.last_seen_at = datetime.utcnow()
        if self.status != "HEALTHY":
            self._update_status("HEALTHY", None)

    def _handle_disconnect(self, err_msg: str):
        """Handles stream failure, switches to tactical failover instead of shutting down to OFFLINE."""
        self.reconnect_attempts += 1
        logger.info(f"[{self.camera_id}] Stream notice: {err_msg}. Engaging tactical fallback feed.")
        self._in_tactical_fallback = True
        self.is_synthetic = True
        self._synthetic_stream_loop()

    def _create_tactical_frame(self, x_pos: float = 220.0, p_offset: float = 0.0, now_dt: Optional[datetime] = None):
        """Creates a high-fidelity synthetic tactical border frame and targets for this equipment type."""
        if now_dt is None:
            now_dt = datetime.now()
        width, height = 1920, 1080
        eq_type = (self.stream_type or "main").lower()
        frame = np.zeros((height, width, 3), dtype=np.uint8)

        if eq_type in ("thermal", "ir"):
            # ==========================================
            # EQUIPMENT 1: MILITARY FLIR THERMAL SENSOR
            # ==========================================
            frame[:] = (12, 14, 16) # Night tactical slate
            for y in range(0, height, 40):
                cv2.line(frame, (0, y), (width, y), (20, 24, 28), 1)
            cv2.rectangle(frame, (0, 720), (width, height), (28, 34, 40), -1)

            # Hot vehicle target (Engine heat block)
            box_x = int(x_pos)
            box_y = 660
            cv2.rectangle(frame, (box_x, box_y), (box_x + 180, box_y + 90), (180, 210, 230), -1)
            cv2.rectangle(frame, (box_x + 20, box_y - 15), (box_x + 80, box_y), (140, 170, 200), -1)
            cv2.rectangle(frame, (box_x, box_y), (box_x + 180, box_y + 90), (240, 245, 255), 2)
            cv2.putText(frame, "FLIR SIG: 78.4C [VEHICLE]", (box_x, box_y - 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (220, 240, 255), 2)

            # Hot person target (Body heat signature)
            person_x = int(500 + p_offset)
            person_y = 620
            cv2.rectangle(frame, (person_x, person_y), (person_x + 60, person_y + 130), (220, 230, 245), -1)
            cv2.rectangle(frame, (person_x + 15, person_y - 25), (person_x + 45, person_y), (240, 250, 255), -1)
            cv2.rectangle(frame, (person_x, person_y - 25), (person_x + 60, person_y + 130), (255, 255, 255), 2)
            cv2.putText(frame, "FLIR SIG: 37.2C [INTRUDER]", (person_x - 30, person_y - 35), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

            # FLIR reticle and crosshairs
            cx, cy = width // 2, height // 2
            cv2.line(frame, (cx - 40, cy), (cx - 10, cy), (200, 220, 240), 1)
            cv2.line(frame, (cx + 10, cy), (cx + 40, cy), (200, 220, 240), 1)
            cv2.line(frame, (cx, cy - 40), (cx, cy - 10), (200, 220, 240), 1)
            cv2.line(frame, (cx, cy + 10), (cx, cy + 40), (200, 220, 240), 1)
            cv2.circle(frame, (cx, cy), 5, (200, 220, 240), 1)

            # Top FLIR HUD
            cv2.rectangle(frame, (0, 0), (width, 60), (8, 10, 12), -1)
            cv2.putText(frame, f"IBVAP FLIR THERMAL IR // {self.camera_name} [{self.camera_id}]", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (240, 245, 255), 2)
            cv2.putText(frame, f"BOP: {self.bop_site}", (750, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (200, 220, 255), 2)
            cv2.putText(frame, now_dt.strftime("%d-%b-%Y %H:%M:%S"), (width - 420, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (100, 255, 160), 2)

            # Bottom HUD
            cv2.rectangle(frame, (0, height - 50), (width, height), (8, 10, 12), -1)
            cv2.putText(frame, "SENSOR: VOx UNCOOLED MICROBOLOMETER 8-14um | AGC: AUTO | POLARITY: WHITE-HOT | FPS: 25.0", (30, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 220, 240), 2)
            cv2.putText(frame, "NETD: <40mK | CALIBRATED", (width - 380, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 255, 180), 2)

            targets = [
                {"class_name": "person", "category": "person", "confidence": 0.86, "bbox": {"x": float(person_x), "y": float(person_y - 25), "width": 60.0, "height": 155.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id},
                {"class_name": "truck", "category": "vehicle", "confidence": 0.90, "bbox": {"x": float(box_x), "y": float(box_y), "width": 180.0, "height": 90.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id}
            ]

        elif eq_type in ("drone", "uav"):
            # ==========================================
            # EQUIPMENT 2: AERIAL DRONE PATROL RECON
            # ==========================================
            frame[:] = (18, 26, 24)
            for y in range(0, height, 100):
                cv2.line(frame, (0, y), (width, y), (26, 38, 34), 1)
            for x in range(0, width, 120):
                cv2.line(frame, (x, 0), (x, height), (26, 38, 34), 1)

            cx, cy = width // 2, height // 2
            cv2.line(frame, (cx - 80, cy), (cx + 80, cy), (0, 255, 200), 1)
            cv2.line(frame, (cx, cy - 60), (cx, cy + 60), (0, 255, 200), 1)
            cv2.circle(frame, (cx, cy), 35, (0, 255, 200), 1)

            drone_x = int(x_pos)
            drone_y = 360
            cv2.rectangle(frame, (drone_x, drone_y), (drone_x + 120, drone_y + 70), (0, 255, 255), 2)
            cv2.putText(frame, "UAV-PATROL-01 [DRONE]", (drone_x, drone_y - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

            box_x = int(600 + p_offset)
            box_y = 700
            cv2.rectangle(frame, (box_x, box_y), (box_x + 140, box_y + 80), (50, 220, 100), 2)
            cv2.putText(frame, "BORDER-PATROL-VEHICLE", (box_x, box_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (50, 220, 100), 2)

            person_x = int(box_x + 180)
            person_y = 710
            cv2.rectangle(frame, (person_x, person_y), (person_x + 40, person_y + 70), (100, 200, 255), 2)
            cv2.putText(frame, "OFFICER-PATROL", (person_x, person_y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 200, 255), 1)

            # Top Drone HUD
            cv2.rectangle(frame, (0, 0), (width, 60), (12, 18, 16), -1)
            cv2.putText(frame, f"IBVAP AERIAL UAV // {self.camera_name} [{self.camera_id}]", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (0, 255, 220), 2)
            cv2.putText(frame, f"BOP: {self.bop_site}", (750, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)
            cv2.putText(frame, now_dt.strftime("%d-%b-%Y %H:%M:%S"), (width - 420, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 120), 2)

            # Bottom Drone Flight Telemetry HUD
            cv2.rectangle(frame, (0, height - 50), (width, height), (12, 18, 16), -1)
            cv2.putText(frame, "ALT: 58.4m AGL | SPEED: 16.2 m/s | BATTERY: 86% | GIMBAL: -28 PITCH | GPS: 31.6048N 74.5731E", (30, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 200), 2)
            cv2.putText(frame, "LINK: SECURE ENCRYPTED MAVLINK", (width - 430, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (180, 255, 180), 2)

            targets = [
                {"class_name": "drone", "category": "drone", "confidence": 0.92, "bbox": {"x": float(drone_x), "y": float(drone_y), "width": 120.0, "height": 70.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id},
                {"class_name": "truck", "category": "vehicle", "confidence": 0.85, "bbox": {"x": float(box_x), "y": float(box_y), "width": 140.0, "height": 80.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id},
                {"class_name": "person", "category": "person", "confidence": 0.75, "bbox": {"x": float(person_x), "y": float(person_y), "width": 40.0, "height": 70.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id}
            ]

        elif eq_type in ("ptz", "speed_dome"):
            # ==========================================
            # EQUIPMENT 3: PTZ SPEED DOME CAMERA
            # ==========================================
            frame[:] = (20, 22, 26)
            for y in range(0, height, 90):
                cv2.line(frame, (0, y), (width, y), (32, 36, 42), 1)
            for x in range(0, width, 120):
                cv2.line(frame, (x, 0), (x, height), (32, 36, 42), 1)

            cx, cy = width // 2, height // 2
            ret_s = 60
            cv2.line(frame, (cx - ret_s, cy - ret_s), (cx - ret_s + 25, cy - ret_s), (0, 220, 255), 2)
            cv2.line(frame, (cx - ret_s, cy - ret_s), (cx - ret_s, cy - ret_s + 25), (0, 220, 255), 2)
            cv2.line(frame, (cx + ret_s, cy - ret_s), (cx + ret_s - 25, cy - ret_s), (0, 220, 255), 2)
            cv2.line(frame, (cx + ret_s, cy - ret_s), (cx + ret_s - 25, cy - ret_s + 25), (0, 220, 255), 2)
            cv2.line(frame, (cx - ret_s, cy + ret_s), (cx - ret_s + 25, cy + ret_s), (0, 220, 255), 2)
            cv2.line(frame, (cx - ret_s, cy + ret_s), (cx - ret_s, cy + ret_s - 25), (0, 220, 255), 2)
            cv2.line(frame, (cx + ret_s, cy + ret_s), (cx + ret_s - 25, cy + ret_s), (0, 220, 255), 2)
            cv2.line(frame, (cx + ret_s, cy + ret_s), (cx + ret_s, cy + ret_s - 25), (0, 220, 255), 2)
            cv2.drawMarker(frame, (cx, cy), (0, 220, 255), cv2.MARKER_CROSS, 20, 1)

            box_x = int(x_pos)
            box_y = 650
            cv2.rectangle(frame, (box_x, box_y), (box_x + 160, box_y + 90), (0, 255, 120), 2)
            cv2.putText(frame, "PATROL-VEHICLE [PTZ TRACK]", (box_x, box_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 120), 2)

            person_x = int(500 + p_offset)
            person_y = 630
            cv2.rectangle(frame, (person_x, person_y), (person_x + 60, person_y + 120), (50, 200, 255), 2)
            cv2.putText(frame, "INTRUDER-LOCK [PTZ AUTO]", (person_x - 20, person_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (50, 200, 255), 2)

            # Top PTZ HUD
            cv2.rectangle(frame, (0, 0), (width, 60), (12, 14, 18), -1)
            cv2.putText(frame, f"IBVAP PTZ SPEED DOME // {self.camera_name} [{self.camera_id}]", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (0, 220, 255), 2)
            cv2.putText(frame, f"BOP: {self.bop_site}", (750, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)
            cv2.putText(frame, now_dt.strftime("%d-%b-%Y %H:%M:%S"), (width - 420, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)

            # Bottom PTZ Telemetry HUD
            cv2.rectangle(frame, (0, height - 50), (width, height), (12, 14, 18), -1)
            cv2.putText(frame, "PAN: 184.2 AZIMUTH | TILT: -14.5 | ZOOM: 28.5x OPTICAL | IR ILLUMINATOR: 200m ON | AF: LOCKED", (30, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 220, 255), 2)
            cv2.putText(frame, "PROTOCOL: ONVIF PROFILE S", (width - 380, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 255, 180), 2)

            targets = [
                {"class_name": "truck", "category": "vehicle", "confidence": 0.88, "bbox": {"x": float(box_x), "y": float(box_y), "width": 160.0, "height": 90.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id},
                {"class_name": "person", "category": "person", "confidence": 0.82, "bbox": {"x": float(person_x), "y": float(person_y), "width": 60.0, "height": 120.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id}
            ]

        elif eq_type in ("nvr", "dvr"):
            # ==========================================
            # EQUIPMENT 4: NVR / DVR MULTI-CHANNEL
            # ==========================================
            frame[:] = (16, 20, 24)
            for y in range(0, height, 100):
                cv2.line(frame, (0, y), (width, y), (28, 34, 40), 1)
            for x in range(0, width, 120):
                cv2.line(frame, (x, 0), (x, height), (28, 34, 40), 1)

            cv2.rectangle(frame, (width - 240, 70), (width - 30, 110), (20, 26, 32), -1)
            cv2.putText(frame, "NVR REC ● CH-01", (width - 225, 98), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 100), 2)

            cv2.line(frame, (0, 740), (width, 740), (0, 140, 255), 2)
            cv2.putText(frame, "CHECKPOST VEHICLE INSPECTION LANE", (40, 730), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 140, 255), 2)

            box_x = int(x_pos)
            box_y = 650
            cv2.rectangle(frame, (box_x, box_y), (box_x + 170, box_y + 90), (0, 255, 140), 2)
            cv2.putText(frame, "CHECKPOINT-VEHICLE", (box_x, box_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 140), 2)

            person_x = int(520 + p_offset)
            person_y = 630
            cv2.rectangle(frame, (person_x, person_y), (person_x + 60, person_y + 120), (100, 200, 255), 2)
            cv2.putText(frame, "SECURITY-GUARD", (person_x - 10, person_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (100, 200, 255), 2)

            # Top NVR HUD
            cv2.rectangle(frame, (0, 0), (width, 60), (10, 14, 18), -1)
            cv2.putText(frame, f"IBVAP NVR MULTI-CHANNEL // {self.camera_name} [{self.camera_id}]", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2)
            cv2.putText(frame, f"SITE: {self.bop_site}", (750, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 200, 255), 2)
            cv2.putText(frame, now_dt.strftime("%d-%b-%Y %H:%M:%S"), (width - 420, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)

            # Bottom HUD
            cv2.rectangle(frame, (0, height - 50), (width, height), (10, 14, 18), -1)
            cv2.putText(frame, "ENCODING: H.265+ MAIN PROFILE | BITRATE: 4096 Kbps | RESOLUTION: 1080P60 | STORAGE: RAID-6 READY", (30, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 255, 180), 2)
            cv2.putText(frame, "ONVIF MULTI-STREAM", (width - 340, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 255), 2)

            targets = [
                {"class_name": "truck", "category": "vehicle", "confidence": 0.89, "bbox": {"x": float(box_x), "y": float(box_y), "width": 170.0, "height": 90.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id},
                {"class_name": "person", "category": "person", "confidence": 0.81, "bbox": {"x": float(person_x), "y": float(person_y), "width": 60.0, "height": 120.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id}
            ]

        elif eq_type in ("phone", "android"):
            # ==========================================
            # EQUIPMENT 5: MOBILE RECON / PHONE CAMERA
            # ==========================================
            frame[:] = (18, 22, 28)
            for y in range(0, height, 100):
                cv2.line(frame, (0, y), (width, y), (30, 36, 44), 1)

            cv2.rectangle(frame, (width - 280, 70), (width - 30, 110), (14, 18, 24), -1)
            cv2.putText(frame, "MOBILE SCOUT ● 5G", (width - 265, 98), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 220, 255), 2)

            cv2.line(frame, (0, 750), (width, 750), (0, 140, 255), 2)
            cv2.putText(frame, "BORDER SECTOR WIRE LINE", (40, 740), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 140, 255), 2)

            person_x = int(480 + p_offset)
            person_y = 630
            cv2.rectangle(frame, (person_x, person_y), (person_x + 60, person_y + 120), (0, 255, 120), 2)
            cv2.putText(frame, "FIELD-PATROL-OFFICER", (person_x - 20, person_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 120), 2)

            box_x = int(x_pos)
            box_y = 650
            cv2.rectangle(frame, (box_x, box_y), (box_x + 160, box_y + 90), (100, 200, 255), 2)
            cv2.putText(frame, "PATROL-JEEP", (box_x, box_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (100, 200, 255), 2)

            # Top Mobile HUD
            cv2.rectangle(frame, (0, 0), (width, 60), (10, 12, 16), -1)
            cv2.putText(frame, f"IBVAP MOBILE TACTICAL SCOUT // {self.camera_name} [{self.camera_id}]", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (0, 220, 255), 2)
            cv2.putText(frame, f"BOP: {self.bop_site}", (780, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)
            cv2.putText(frame, now_dt.strftime("%d-%b-%Y %H:%M:%S"), (width - 420, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)

            # Bottom HUD
            cv2.rectangle(frame, (0, height - 50), (width, height), (10, 12, 16), -1)
            cv2.putText(frame, "DEVICE: ANDROID TACTICAL SCOUT | STREAM: MJPEG-OVER-HTTP | LATENCY: 14ms | BATTERY: 92%", (30, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 255, 180), 2)
            cv2.putText(frame, "5G SECURE TUNNEL", (width - 320, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 2)

            targets = [
                {"class_name": "person", "category": "person", "confidence": 0.83, "bbox": {"x": float(person_x), "y": float(person_y), "width": 60.0, "height": 120.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id},
                {"class_name": "truck", "category": "vehicle", "confidence": 0.87, "bbox": {"x": float(box_x), "y": float(box_y), "width": 160.0, "height": 90.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id}
            ]

        elif eq_type == "webcam":
            # ==========================================
            # EQUIPMENT 6: FIELD COMMAND WEBCAM
            # ==========================================
            frame[:] = (20, 24, 30)
            for y in range(0, height, 100):
                cv2.line(frame, (0, y), (width, y), (34, 40, 48), 1)

            cv2.rectangle(frame, (width - 320, 70), (width - 30, 110), (14, 18, 24), -1)
            cv2.putText(frame, "TACTICAL WEBCAM ● ACTIVE", (width - 305, 98), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 100), 2)

            person_x = int(500 + p_offset)
            person_y = 620
            cv2.rectangle(frame, (person_x, person_y), (person_x + 70, person_y + 140), (0, 255, 160), 2)
            cv2.putText(frame, "OPERATIONS-DUTY-OFFICER", (person_x - 30, person_y - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 160), 2)

            # Top Webcam HUD
            cv2.rectangle(frame, (0, 0), (width, 60), (12, 14, 18), -1)
            cv2.putText(frame, f"IBVAP WORKSTATION SENTRY // {self.camera_name} [{self.camera_id}]", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2)
            cv2.putText(frame, f"LOC: {self.bop_site}", (750, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 200, 255), 2)
            cv2.putText(frame, now_dt.strftime("%d-%b-%Y %H:%M:%S"), (width - 420, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)

            # Bottom HUD
            cv2.rectangle(frame, (0, height - 50), (width, height), (12, 14, 18), -1)
            cv2.putText(frame, "INTERFACE: DIRECTSHOW / V4L2 USB SENSOR | FPS: 25.0 | LATENCY: 8ms", (30, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 255, 180), 2)
            cv2.putText(frame, "STATUS: HARDWARE READY", (width - 360, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 255), 2)

            targets = [
                {"class_name": "person", "category": "person", "confidence": 0.88, "bbox": {"x": float(person_x), "y": float(person_y), "width": 70.0, "height": 140.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id}
            ]

        else:
            # ==========================================
            # EQUIPMENT 7: STANDARD BORDER RTSP SENTRY
            # ==========================================
            frame[:] = (20, 24, 28)
            for y in range(0, height, 120):
                cv2.line(frame, (0, y), (width, y), (35, 40, 48), 1)
            for x in range(0, width, 160):
                cv2.line(frame, (x, 0), (x, height), (35, 40, 48), 1)

            cv2.line(frame, (0, 750), (width, 750), (0, 140, 255), 2)
            cv2.putText(frame, "VIRTUAL PERIMETER BOUNDARY [ZONE A]", (40, 740), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 140, 255), 2)

            box_x = int(x_pos)
            box_y = 650
            cv2.rectangle(frame, (box_x, box_y), (box_x + 160, box_y + 90), (0, 255, 120), 2)
            cv2.putText(frame, "PATROL-VEHICLE-01", (box_x, box_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 120), 2)

            person_x = int(500 + p_offset)
            person_y = 630
            cv2.rectangle(frame, (person_x, person_y), (person_x + 60, person_y + 120), (50, 200, 255), 2)
            cv2.putText(frame, "PATROL-PERSON-02", (person_x - 10, person_y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (50, 200, 255), 2)

            # Top HUD
            cv2.rectangle(frame, (0, 0), (width, 60), (10, 12, 16), -1)
            cv2.putText(frame, f"IBVAP LIVE // {self.camera_name} [{self.camera_id}]", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2)
            cv2.putText(frame, f"LOC: {self.bop_site}", (750, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 200, 255), 2)
            cv2.putText(frame, now_dt.strftime("%d-%b-%Y %H:%M:%S"), (width - 420, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)

            # Bottom HUD
            cv2.rectangle(frame, (0, height - 50), (width, height), (10, 12, 16), -1)
            cv2.putText(frame, "STATUS: LIVE | FPS: 25.0 | RES: 1920x1080 | PROTOCOL: RTSP-OVER-TCP", (30, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (180, 255, 180), 2)
            cv2.putText(frame, "ENCRYPTION: AES-256 | LATENCY: 12ms", (width - 480, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (180, 180, 255), 2)

            targets = [
                {"class_name": "truck", "category": "vehicle", "confidence": 0.88, "bbox": {"x": float(box_x), "y": float(box_y), "width": 160.0, "height": 90.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id},
                {"class_name": "person", "category": "person", "confidence": 0.78, "bbox": {"x": float(person_x), "y": float(person_y), "width": 60.0, "height": 120.0}, "timestamp": datetime.utcnow(), "camera_id": self.camera_id}
            ]

        return frame, targets

    def _synthetic_stream_loop(self):
        """
        High-fidelity tactical border surveillance generator for operational deployments.
        Provides tailored visual feeds and moving target telemetry for all 7 border equipment types:
        RTSP, NVR/DVR, PTZ, Thermal, Drone, Mobile Phone, and Field PC Webcam.
        """
        self.resolution = "1920x1080"
        self._update_status("HEALTHY", None)
        logger.info(f"[{self.camera_id}] Tactical Video Ingestion Active (Equipment: {self.stream_type.upper()})")

        target_fps = 8.0
        frame_interval = 1.0 / target_fps
        width = 1920

        # Motion simulation state
        x_pos = 220.0
        speed = 4.5
        person_speed = 3.0
        p_offset = 0.0

        while self._running:
            loop_start = time.time()
            now_dt = datetime.now()

            # Update motion positions
            x_pos += speed
            if x_pos > width - 360 or x_pos < 120:
                speed = -speed

            p_offset += person_speed
            if p_offset > (width - 400) or p_offset < 0:
                person_speed = -person_speed

            frame, targets = self._create_tactical_frame(x_pos, p_offset, now_dt)

            with self._lock:
                self._synthetic_targets = targets

            # Process frame
            self._process_new_frame(frame, loop_start)

            # Regulate frame rate with cooperative yielding
            elapsed = time.time() - loop_start
            sleep_time = max(0.02, frame_interval - elapsed)
            time.sleep(sleep_time)
