import time
import pytest
import threading
import numpy as np
from app.services.stream_manager import stream_manager
from app.services.ai.pipeline import ai_pipeline_manager
from app.services.ai.detector import YOLOObjectDetector
from app.services.intelligence.event_manager import security_event_manager

def test_p0_8_1_camera_start_and_stop_lifecycle():
    """Test 1: StreamManager starts and stops camera ingestion cleanly."""
    cam_id = "LIFECYCLE-CAM-1"
    streamer = stream_manager.start_camera(
        camera_id=cam_id,
        camera_name="Lifecycle Test Camera",
        bop_site="BOP Alpha",
        rtsp_url="synthetic://test/cam1"
    )
    assert streamer is not None
    assert streamer._running is True
    assert streamer.camera_id == cam_id

    # Stop camera
    stream_manager.stop_camera(cam_id)
    assert stream_manager.get_streamer(cam_id) is None
    assert streamer._running is False

def test_p0_8_2_duplicate_camera_worker_prevention():
    """Test 2: Calling start_camera multiple times returns existing worker without duplication."""
    cam_id = "DUPLICATE-PREVENT-CAM"
    streamer1 = stream_manager.start_camera(
        camera_id=cam_id,
        camera_name="Duplicate Test Camera",
        bop_site="BOP Alpha",
        rtsp_url="synthetic://test/dup"
    )
    streamer2 = stream_manager.start_camera(
        camera_id=cam_id,
        camera_name="Duplicate Test Camera",
        bop_site="BOP Alpha",
        rtsp_url="synthetic://test/dup"
    )
    assert streamer1 is streamer2

    # Cleanup
    stream_manager.stop_camera(cam_id)

def test_p0_8_3_rapid_start_stop_cycles():
    """Test 3: Rapid sequential start/stop cycles do not leak threads or crash."""
    cam_id = "RAPID-CYCLE-CAM"
    for _ in range(5):
        s = stream_manager.start_camera(
            camera_id=cam_id,
            camera_name="Rapid Cycle Cam",
            bop_site="BOP Alpha",
            rtsp_url="synthetic://test/rapid"
        )
        assert s._running is True
        stream_manager.stop_camera(cam_id)
        assert s._running is False

def test_p0_8_4_multi_camera_concurrent_streaming():
    """Test 4: Multiple cameras stream concurrently without interfering with each other."""
    cams = [f"CONCURRENT-CAM-{i}" for i in range(3)]
    streamers = []
    for c_id in cams:
        s = stream_manager.start_camera(
            camera_id=c_id,
            camera_name=f"Cam {c_id}",
            bop_site="BOP Alpha",
            rtsp_url=f"synthetic://test/{c_id}"
        )
        streamers.append(s)

    time.sleep(0.3)
    for s in streamers:
        assert s._running is True
        assert s.status == "HEALTHY"
        frame = s.get_latest_frame()
        assert frame is not None

    # Cleanup
    for c_id in cams:
        stream_manager.stop_camera(c_id)

def test_p0_8_5_shared_ai_inference_thread_safety():
    """Test 5: Concurrent threads executing YOLO inference on a shared detector do not deadlock or race."""
    detector = YOLOObjectDetector(model_name="yolov8n", device="cpu")
    frames = [np.zeros((480, 640, 3), dtype=np.uint8) for _ in range(4)]
    results = [None] * 4

    def worker_infer(idx):
        res = detector.detect(frames[idx], camera_id=f"THREAD-CAM-{idx}")
        results[idx] = res

    threads = [threading.Thread(target=worker_infer, args=(i,)) for i in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=15.0)

    for i in range(4):
        assert results[i] is not None
        assert isinstance(results[i], list)

def test_p0_8_6_websocket_broadcast_isolation():
    """Test 6: A throwing/dead WebSocket client does not interrupt broadcast to valid clients."""
    received = []

    def valid_client_1(payload):
        received.append(("client1", payload))

    def dead_client(payload):
        raise ConnectionResetError("Simulated client disconnect")

    def valid_client_2(payload):
        received.append(("client2", payload))

    security_event_manager.register_ws_client(valid_client_1)
    security_event_manager.register_ws_client(dead_client)
    security_event_manager.register_ws_client(valid_client_2)

    # Broadcast sync event
    security_event_manager.broadcast_sync_event({"test_event": "PING"})

    # Verify valid clients received message
    client_ids = [c for c, _ in received]
    assert "client1" in client_ids
    assert "client2" in client_ids

    # Verify dead client was cleanly pruned
    assert dead_client not in security_event_manager.ws_subscribers

    # Cleanup
    security_event_manager.unregister_ws_client(valid_client_1)
    security_event_manager.unregister_ws_client(valid_client_2)

def test_p0_8_7_graceful_pipeline_shutdown():
    """Test 7: AIPipelineManager unregisters all cameras cleanly without leaving zombie workers."""
    cam_id = "AI-SHUTDOWN-CAM"
    worker = ai_pipeline_manager.register_camera(cam_id, auto_start=True)
    assert worker.is_running is True

    ai_pipeline_manager.unregister_all()
    assert len(ai_pipeline_manager.workers) == 0
    assert worker.is_running is False
