import asyncio
import json
import logging
from typing import Optional, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from app.services.stream_manager import stream_manager
from app.services.health_monitor import health_monitor
from app.services.ai.pipeline import ai_pipeline_manager
from app.services.intelligence.event_manager import security_event_manager
from app.services.alert.alert_engine import alert_engine
from app.services.security.ws_ticket_service import WSTicketService

logger = logging.getLogger("ibvap.ws")
router = APIRouter(prefix="/ws", tags=["WebSockets"])

async def _send_safe_json(websocket: WebSocket, payload: Any):
    """Safely serializes and sends payload over WebSocket, converting datetimes and non-primitives to JSON strings."""
    await websocket.send_text(json.dumps(payload, default=str))

async def _authenticate_and_accept(
    websocket: WebSocket,
    ticket: Optional[str],
    token: Optional[str],
    expected_scope: str,
    expected_camera_id: Optional[str] = None
) -> bool:
    """
    Validates single-use ticket or token and enforces camera/role scope before accepting WebSocket.
    """
    auth_data = WSTicketService.validate_and_consume_ticket(
        ticket=ticket,
        expected_scope=expected_scope,
        expected_camera_id=expected_camera_id,
        jwt_token_fallback=token
    )
    if not auth_data:
        logger.warning(f"Rejected unauthenticated WebSocket attempt to {expected_scope} (cam={expected_camera_id})")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return False

    await websocket.accept()
    logger.info(f"WebSocket client authorized for {expected_scope} (user={auth_data.get('username')}, cam={expected_camera_id})")
    return True

@router.websocket("/live-feed/{camera_id}")
async def live_video_feed_ws(
    websocket: WebSocket,
    camera_id: str,
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """
    Ultra low-latency WebSocket video frame broadcaster.
    Streams binary JPEG frames directly into client Canvas/Image player.
    """
    from urllib.parse import unquote
    clean_camera_id = unquote(str(camera_id)).strip()

    if not await _authenticate_and_accept(websocket, ticket, token, "live_feed", clean_camera_id):
        return
    
    try:
        frame_interval = 1.0 / 30.0  # Smooth 30 FPS over WebSocket
        last_frame_count = -1
        # Ensure camera streamer is actively started from DB
        stream_manager.ensure_camera_running(clean_camera_id)

        while True:
            streamer = stream_manager.get_streamer(clean_camera_id)
            if not streamer or not getattr(streamer, "_running", False):
                streamer = stream_manager.ensure_camera_running(clean_camera_id)

            if streamer and streamer._running and streamer.status != "OFFLINE":
                jpeg_bytes = streamer.get_latest_jpeg()
                if jpeg_bytes:
                    if streamer._frame_count != last_frame_count or last_frame_count == -1:
                        await websocket.send_bytes(jpeg_bytes)
                        last_frame_count = streamer._frame_count
                else:
                    placeholder = stream_manager._get_offline_placeholder_jpeg(clean_camera_id)
                    await websocket.send_bytes(placeholder)
            else:
                placeholder = stream_manager._get_offline_placeholder_jpeg(clean_camera_id)
                await websocket.send_bytes(placeholder)
                await asyncio.sleep(0.08)
                continue

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
async def camera_ai_telemetry_ws(
    websocket: WebSocket,
    camera_id: str,
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """
    Real-time AI Detection, Tracking & Telemetry broadcaster.
    Streams bounding boxes, persistent track IDs, image-space direction, speed,
    trajectories, and live object counts to frontend HUD overlays.
    """
    if not await _authenticate_and_accept(websocket, ticket, token, "ai_feed", camera_id):
        return

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
        await _send_safe_json(websocket, {
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
            await _send_safe_json(websocket, payload)
    except WebSocketDisconnect:
        ai_pipeline_manager.unregister_ws_subscriber(camera_id, sync_send_callback)
        logger.info(f"AI feed WebSocket disconnected for {camera_id}")
    except Exception as e:
        ai_pipeline_manager.unregister_ws_subscriber(camera_id, sync_send_callback)
        logger.error(f"Error on AI feed WebSocket for {camera_id}: {e}")

@router.websocket("/security-events")
async def security_events_ws(
    websocket: WebSocket,
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """
    Real-time Security Events & Threat Intelligence broadcaster.
    Pushes new intrusions, loitering, and threat events directly to dashboard operations.
    """
    if not await _authenticate_and_accept(websocket, ticket, token, "security_events"):
        return

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
            await _send_safe_json(websocket, payload)
    except WebSocketDisconnect:
        security_event_manager.unregister_ws_client(sync_send_event)
        logger.info("Security events WebSocket client disconnected.")
    except Exception as e:
        security_event_manager.unregister_ws_client(sync_send_event)
        logger.error(f"Error on security events WebSocket: {e}")

@router.websocket("/health")
async def camera_health_ws(
    websocket: WebSocket,
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """
    Real-time health status broadcaster.
    Sends full camera fleet health status on connection and pushes updates.
    """
    if not await _authenticate_and_accept(websocket, ticket, token, "health"):
        return
    health_monitor.register_ws_client(websocket)
    logger.info("WebSocket client registered for health telemetry.")

    try:
        # Send initial status immediately
        statuses = stream_manager.get_all_statuses()
        await _send_safe_json(websocket, {
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

@router.websocket("/alerts")
async def live_alerts_ws(
    websocket: WebSocket,
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None)
):
    """
    Real-time Live Alert & Notification broadcaster.
    Streams new alerts, acknowledgements, escalations, and resolutions.
    """
    if not await _authenticate_and_accept(websocket, ticket, token, "alerts"):
        return
    logger.info("WebSocket client connected to live alerts feed.")

    queue = asyncio.Queue(maxsize=25)
    loop = asyncio.get_running_loop()

    def sync_send_alert(payload: dict):
        try:
            loop.call_soon_threadsafe(
                lambda: queue.put_nowait(payload) if not queue.full() else None
            )
        except Exception:
            pass

    alert_engine.register_ws_client(sync_send_alert)

    try:
        while True:
            payload = await queue.get()
            await _send_safe_json(websocket, payload)
    except WebSocketDisconnect:
        alert_engine.unregister_ws_client(sync_send_alert)
        logger.info("Alerts WebSocket client disconnected.")
    except Exception as e:
        alert_engine.unregister_ws_client(sync_send_alert)
        logger.error(f"Error on alerts WebSocket: {e}")


