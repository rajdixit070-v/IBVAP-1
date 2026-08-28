import time
import pytest
from app.services.rtsp_streamer import RTSPStreamer
from app.services.stream_manager import stream_manager
from app.services.rtsp_tester import test_rtsp_connection as probe_rtsp
from app.core.security import mask_rtsp_url, build_authenticated_rtsp_url

def test_url_masking():
    url = "rtsp://admin:SecretPass123@192.168.1.100:554/stream1"
    masked = mask_rtsp_url(url)
    assert "SecretPass123" not in masked
    assert "***:***@" in masked
    assert "192.168.1.100:554/stream1" in masked

def test_build_authenticated_url():
    base_url = "rtsp://192.168.1.100:554/h264"
    auth_url = build_authenticated_rtsp_url(base_url, "operator1", "P@ss123")
    assert "operator1:P@ss123@192.168.1.100:554/h264" in auth_url

def test_probe_rtsp_synthetic():
    res = probe_rtsp("synthetic://cam/live")
    assert res.success is True
    assert res.connected is True
    assert res.resolution == "1920x1080"
    assert res.fps == 25.0

def test_synthetic_streamer_lifecycle():
    streamer = RTSPStreamer(
        camera_id="UNIT-TEST-CAM",
        camera_name="Unit Test Camera",
        bop_site="BOP Alpha",
        rtsp_url="synthetic://test/live",
        username="admin",
        password="password"
    )
    
    streamer.start()
    time.sleep(0.3)  # Allow worker to generate frames
    
    assert streamer._running is True
    assert streamer.status == "HEALTHY"
    
    frame = streamer.get_latest_frame()
    assert frame is not None
    assert frame.shape == (1080, 1920, 3)
    
    jpeg_bytes = streamer.get_latest_jpeg()
    assert jpeg_bytes is not None
    assert len(jpeg_bytes) > 1000
    
    status_info = streamer.get_status_info()
    assert status_info["camera_id"] == "UNIT-TEST-CAM"
    assert status_info["status"] == "HEALTHY"
    
    streamer.stop()
    assert streamer._running is False
    assert streamer.status == "OFFLINE"

def test_stream_manager_registration():
    streamer = stream_manager.start_camera(
        camera_id="MGR-TEST-CAM",
        camera_name="Manager Test Camera",
        bop_site="BOP Test",
        rtsp_url="synthetic://test/live"
    )
    
    assert streamer is not None
    assert stream_manager.get_streamer("MGR-TEST-CAM") is not None
    
    time.sleep(0.2)
    statuses = stream_manager.get_all_statuses()
    assert "MGR-TEST-CAM" in statuses
    
    stream_manager.stop_camera("MGR-TEST-CAM")
    assert stream_manager.get_streamer("MGR-TEST-CAM") is None
