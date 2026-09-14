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
        on_status_change: Optional[Callable[[str, str, dict], None]] = None
    ):
        self.camera_id = camera_id
        self.camera_name = camera_name
        self.bop_site = bop_site
        self.rtsp_url = rtsp_url
        self.base_rtsp_url = rtsp_url
        self.username = username
        self.password = password
        self.on_status_change = on_status_change

        self.auth_url = build_authenticated_rtsp_url(rtsp_url, username, password)
        u_low = (rtsp_url or "").lower()
        is_known_protocol = any(u_low.startswith(p) for p in ("rtsp://", "http://", "https://", "udp://", "webcam://", "device://", "rtmp://"))
        self.is_synthetic = (
            u_low.startswith("synthetic://") or 
            u_low.startswith("test://") or 
            not is_known_protocol
        )

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
        self.status = "CONNECTING"  # HEALTHY, DEGRADED, OFFLINE, ERROR, CONNECTING
        self.fps = 0.0
        self.resolution: Optional[str] = None
        self.codec = "H.264"
        self.reconnect_attempts = 0
        self.last_seen_at: Optional[datetime] = None
        self.last_error_message: Optional[str] = None
        self.latency_ms = 0.0

        # FPS calculation window
        self._fps_timestamps = []

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
                logger.warning(f"[{self.camera_id}] Stream error: {err_msg}")
                self._handle_disconnect(err_msg)
            finally:
                if cap is not None:
                    cap.release()

            # Exponential backoff sleep before retry
            if self._running:
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

        # Encode JPEG for low-latency web broadcast
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 80]
        success, jpeg_buf = cv2.imencode('.jpg', frame, encode_params)
        
        with self._lock:
            self._latest_raw_frame = frame
            if success:
                self._latest_jpeg = jpeg_buf.tobytes()
            self._latest_frame_time = timestamp
            self._frame_count += 1

        self.last_seen_at = datetime.utcnow()
        if self.status != "HEALTHY":
            self._update_status("HEALTHY", None)

    def _handle_disconnect(self, err_msg: str):
        """Handles stream failure, preserves last frame for smooth UI transitions, and sets status to OFFLINE."""
        self.reconnect_attempts += 1
        self._update_status("OFFLINE", f"Stream disconnected: {err_msg}")
        self.fps = 0.0


    def _synthetic_stream_loop(self):
        """
        High-fidelity simulated border camera generator for testing & demonstrations.
        Generates realistic CCTV frame overlays with timestamps, site metadata, and moving test objects.
        """
        self.resolution = "1920x1080"
        self._update_status("HEALTHY", None)
        logger.info(f"[{self.camera_id}] Running Synthetic Test Generator")

        target_fps = 25.0
        frame_interval = 1.0 / target_fps
        width, height = 1920, 1080

        # Motion simulation state
        x_pos = 200.0
        speed = 4.0

        while self._running:
            loop_start = time.time()
            now_dt = datetime.now()

            # Create synthetic CCTV background (Dark border outpost scene)
            frame = np.zeros((height, width, 3), dtype=np.uint8)
            frame[:] = (20, 24, 28) # Dark tactical slate

            # Grid lines
            for y in range(0, height, 120):
                cv2.line(frame, (0, y), (width, y), (35, 40, 48), 1)
            for x in range(0, width, 160):
                cv2.line(frame, (x, 0), (x, height), (35, 40, 48), 1)

            # Simulated perimeter fence line
            cv2.line(frame, (0, 750), (width, 750), (0, 140, 255), 2)
            cv2.putText(frame, "VIRTUAL PERIMETER BOUNDARY [ZONE A]", (40, 740), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 140, 255), 2)

            # Simulated moving vehicle target (patrol vehicle / technical)
            x_pos += speed
            if x_pos > width - 320 or x_pos < 80:
                speed = -speed
            
            box_x = int(x_pos)
            box_y = 650
            cv2.rectangle(frame, (box_x, box_y), (box_x + 160, box_y + 90), (0, 255, 120), 2)
            cv2.putText(frame, "PATROL-VEHICLE-01", (box_x, box_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 120), 2)

            # Simulated walking personnel target (border perimeter patrol)
            person_x = int(600 + ((width - 800) - (x_pos * 0.7)))
            person_y = 630
            cv2.rectangle(frame, (person_x, person_y), (person_x + 60, person_y + 120), (50, 200, 255), 2)
            cv2.putText(frame, "PATROL-PERSON-02", (person_x, person_y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (50, 200, 255), 2)

            # Update structured synthetic target metadata for AI worker
            with self._lock:
                self._synthetic_targets = [
                    {
                        "class_name": "truck",
                        "category": "vehicle",
                        "confidence": 0.88,
                        "bbox": {"x": float(box_x), "y": float(box_y), "width": 160.0, "height": 90.0},
                        "timestamp": datetime.utcnow(),
                        "camera_id": self.camera_id
                    },
                    {
                        "class_name": "person",
                        "category": "person",
                        "confidence": 0.74,
                        "bbox": {"x": float(person_x), "y": float(person_y), "width": 60.0, "height": 120.0},
                        "timestamp": datetime.utcnow(),
                        "camera_id": self.camera_id
                    }
                ]

            # Top HUD: Camera ID, BOP Name, Time
            cv2.rectangle(frame, (0, 0), (width, 60), (10, 12, 16), -1)
            cv2.putText(frame, f"IBVAP LIVE // {self.camera_name} [{self.camera_id}]", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
            cv2.putText(frame, f"LOC: {self.bop_site}", (650, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 200, 255), 2)
            
            timestamp_str = now_dt.strftime("%d-%b-%Y %I:%M:%S %p")
            cv2.putText(frame, timestamp_str, (width - 430, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)

            # Bottom Status HUD
            cv2.rectangle(frame, (0, height - 50), (width, height), (10, 12, 16), -1)
            cv2.putText(frame, f"STATUS: LIVE | FPS: {self.fps:.1f} | RES: 1920x1080 | PROTOCOL: RTSP-OVER-TCP", (30, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (180, 255, 180), 2)
            cv2.putText(frame, "ENCRYPTION: AES-256 | LATENCY: 12ms", (width - 480, height - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (180, 180, 255), 2)

            # Process frame
            self._process_new_frame(frame, loop_start)

            # Regulate frame rate
            elapsed = time.time() - loop_start
            sleep_time = max(0.001, frame_interval - elapsed)
            time.sleep(sleep_time)
