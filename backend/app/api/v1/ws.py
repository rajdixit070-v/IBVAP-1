import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.stream_manager import stream_manager
from app.services.health_monitor import health_monitor
from app.services.ai.pipeline import ai_pipeline_manager
from app.services.intelligence.event_manager import security_event_manager

logger = logging.getLogger("ibvap.ws")
router = APIRouter(prefix="/ws", tags=["WebSockets"])

@router.websocket("/live-feed/{camera_id}")
async def live_video_feed_ws(websocket: WebSocket, camera_id: str):
    """
    Ultra low-latency WebSocket video frame broadcaster.
    Streams binary JPEG frames directly into client Canvas/Image player.
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected to live-feed for {camera_id}")
    
    try:
        frame_interval = 1.0 / 25.0  # Max 25 FPS over WebSocket
        while True:
            jpeg_bytes = stream_manager.get_latest_jpeg(camera_id)
            if jpeg_bytes:
                await websocket.send_bytes(jpeg_bytes)
            await asyncio.sleep(frame_interval)
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected from {camera_id}")
    except Exception as e:
        logger.error(f"Error on WebSocket live-feed for {camera_id}: {e}")
        try:
            await websocket.close()
        except Exception:
            pass

@router.websocket("/ai-feed/{camera_id}")
async def camera_ai_telemetry_ws(websocket: WebSocket, camera_id: str):
    """
    Real-time AI Detection, Tracking & Telemetry broadcaster.
    Streams bounding boxes, persistent track IDs, image-space direction, speed,
    trajectories, and live object counts to frontend HUD overlays.
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected to AI feed for {camera_id}")

    queue = asyncio.Queue(maxsize=10)
    loop = asyncio.get_running_loop()

    def sync_send_callback(payload: dict):
        try:
            loop.call_soon_threadsafe(
                lambda: queue.put_nowait(payload) if not queue.full() else None
            )
        except Exception:
            pass

    ai_pipeline_manager.register_ws_subscriber(camera_id, sync_send_callback)

    try:
        # Send initial status
        initial_status = ai_pipeline_manager.get_camera_status(camera_id)
        tracks = ai_pipeline_manager.get_camera_tracks(camera_id)
        await websocket.send_json({
            "event": "INITIAL_AI_STATE",
            "camera_id": camera_id,
            "status": initial_status.status,
            "inference_fps": initial_status.inference_fps,
            "latency_ms": initial_status.latency_ms,
            "counters": initial_status.counters.dict(),
            "tracks": tracks
        })

        while True:
            # Wait for next telemetry frame or ping
            payload = await queue.get()
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        ai_pipeline_manager.unregister_ws_subscriber(camera_id, sync_send_callback)
        logger.info(f"AI feed WebSocket disconnected for {camera_id}")
    except Exception as e:
        ai_pipeline_manager.unregister_ws_subscriber(camera_id, sync_send_callback)
        logger.error(f"Error on AI feed WebSocket for {camera_id}: {e}")

@router.websocket("/security-events")
async def security_events_ws(websocket: WebSocket):
    """
    Real-time Security Events & Threat Intelligence broadcaster.
    Pushes new intrusions, loitering, and threat events directly to dashboard operations.
    """
    await websocket.accept()
    logger.info("WebSocket client connected to security events feed.")

    queue = asyncio.Queue(maxsize=20)
    loop = asyncio.get_running_loop()

    def sync_send_event(payload: dict):
        try:
            loop.call_soon_threadsafe(
                lambda: queue.put_nowait(payload) if not queue.full() else None
            )
        except Exception:
            pass

    security_event_manager.register_ws_client(sync_send_event)

    try:
        while True:
            payload = await queue.get()
            await websocket.send_json(payload)
    except WebSocketDisconnect:
        security_event_manager.unregister_ws_client(sync_send_event)
        logger.info("Security events WebSocket client disconnected.")
    except Exception as e:
        security_event_manager.unregister_ws_client(sync_send_event)
        logger.error(f"Error on security events WebSocket: {e}")

@router.websocket("/health")
async def camera_health_ws(websocket: WebSocket):
    """
    Real-time health status broadcaster.
    Sends full camera fleet health status on connection and pushes updates.
    """
    await websocket.accept()
    health_monitor.register_ws_client(websocket)
    logger.info("WebSocket client registered for health telemetry.")

    try:
        # Send initial status immediately
        statuses = stream_manager.get_all_statuses()
        await websocket.send_json({
            "event": "INITIAL_HEALTH",
            "cameras": list(statuses.values())
        })

        # Keep connection open and listen for client pings
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        health_monitor.unregister_ws_client(websocket)
        logger.info("Health telemetry WebSocket client disconnected.")
    except Exception as e:
        health_monitor.unregister_ws_client(websocket)
        logger.error(f"Error on health telemetry WebSocket: {e}")
