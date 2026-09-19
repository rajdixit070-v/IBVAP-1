from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.camera import Camera
from app.models.health_log import CameraHealthLog
from app.schemas.camera import (
    CameraCreate,
    CameraUpdate,
    CameraResponse,
    CameraTestRequest,
    CameraTestResponse,
)
from app.schemas.health import (
    CameraHealthStatus,
    CameraSummaryStats,
    CameraDiagnosticLogResponse
)
from app.api.deps import get_current_user, get_current_user_optional, require_admin, require_camera_admin, verify_camera_access

from app.services import camera_service
from app.services.rtsp_tester import test_rtsp_connection
from app.services.stream_manager import stream_manager
from app.services.security.ssrf_validator import SSRFValidator
from app.core.security import decrypt_credential

router = APIRouter(prefix="/cameras", tags=["Camera Management"])

@router.get("", response_model=List[CameraResponse])
@router.get("/", response_model=List[CameraResponse])
def get_cameras(

    search: Optional[str] = None,
    bop_site: Optional[str] = None,
    sector: Optional[str] = None,
    status: Optional[str] = None,
    enabled: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all configured CCTV cameras with optional search and filters."""
    cameras, _ = camera_service.list_cameras(
        db, search=search, bop_site=bop_site, sector=sector,
        status=status, enabled=enabled, skip=skip, limit=limit
    )
    return cameras

@router.get("/overview/summary")
def get_cameras_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns high-level camera health and distribution stats across all BOPs."""
    return camera_service.get_overview_summary(db)

@router.post("", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
def create_new_camera(
    camera_in: CameraCreate,
    db: Session = Depends(get_db),
    authorized_user: User = Depends(require_camera_admin)
):
    """Registers a new IP camera into the IBVAP platform (Admin or Checkpost Commander)."""

    # Check for duplicate camera ID
    existing = db.query(Camera).filter(Camera.camera_id == camera_in.camera_id.strip().upper()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Camera with ID '{camera_in.camera_id}' already exists."
        )
    return camera_service.create_camera(db, camera_in)

@router.post("/test-raw", response_model=CameraTestResponse)
def test_raw_camera_stream(
    test_req: CameraTestRequest,
    current_user: User = Depends(get_current_user)
):
    """Tests connectivity, resolution, FPS, and codec for an RTSP URL with SSRF protection."""
    is_valid, err_reason = SSRFValidator.validate_destination_url(test_req.rtsp_url)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security Violation (SSRF Protection): {err_reason}"
        )

    return test_rtsp_connection(
        rtsp_url=test_req.rtsp_url,
        username=test_req.username,
        password=test_req.password,
        timeout_sec=test_req.timeout_sec or 8.0
    )

@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera_details(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetches details for a specific camera with IDOR authorization guard."""
    verify_camera_access(camera_id, current_user, db)
    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera '{camera_id}' not found."
        )
    return camera_service.format_camera_response(cam)

@router.put("/{camera_id}", response_model=CameraResponse)
def update_camera_details(
    camera_id: str,
    camera_in: CameraUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_camera_admin)
):
    """Updates camera configuration or credentials (Admin or Checkpost Officer with IDOR check)."""
    verify_camera_access(camera_id, admin_user, db)
    if camera_in.rtsp_url:
        is_valid, err_reason = SSRFValidator.validate_destination_url(camera_in.rtsp_url)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Security Violation (SSRF Protection): {err_reason}"
            )

    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera '{camera_id}' not found."
        )
    return camera_service.update_camera(db, cam, camera_in)

@router.delete("/{camera_id}", status_code=status.HTTP_200_OK)
def delete_camera(
    camera_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_camera_admin)
):
    """Removes a camera and releases its ingestion resources (Admin or Checkpost Officer with IDOR check)."""
    verify_camera_access(camera_id, admin_user, db)

    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera '{camera_id}' not found."
        )
    camera_service.delete_camera(db, cam)
    return {"success": True, "message": f"Camera '{camera_id}' successfully removed."}

@router.post("/{camera_id}/test-connection", response_model=CameraTestResponse)
def test_existing_camera_connection(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tests connectivity of an existing saved camera using its stored credentials with IDOR check."""
    verify_camera_access(camera_id, current_user, db)
    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera '{camera_id}' not found."
        )
    decrypted_pw = decrypt_credential(cam.encrypted_password)
    return test_rtsp_connection(
        rtsp_url=cam.rtsp_url,
        username=cam.username,
        password=decrypted_pw,
        timeout_sec=8.0
    )

@router.post("/{camera_id}/start")
def start_camera_stream(
    camera_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Manually starts ingestion streamer for a camera with IDOR check."""
    verify_camera_access(camera_id, admin_user, db)
    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")
    
    cam.enabled = True
    db.commit()
    
    decrypted_pw = decrypt_credential(cam.encrypted_password)
    streamer = stream_manager.start_camera(
        camera_id=cam.camera_id,
        camera_name=cam.camera_name,
        bop_site=cam.bop_site,
        rtsp_url=cam.rtsp_url,
        username=cam.username,
        password=decrypted_pw
    )
    return {"success": True, "camera_id": cam.camera_id, "status": streamer.status}

@router.post("/{camera_id}/stop")
def stop_camera_stream(
    camera_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """Manually stops ingestion streamer for a camera with IDOR check."""
    verify_camera_access(camera_id, admin_user, db)
    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")
    
    cam.enabled = False
    cam.status = "OFFLINE"
    db.commit()
    
    stream_manager.stop_camera(cam.camera_id)
    return {"success": True, "camera_id": cam.camera_id, "status": "OFFLINE"}

@router.get("/{camera_id}/status", response_model=CameraHealthStatus)
def get_live_camera_status(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves live streaming metrics (FPS, resolution, reconnect attempts) for a camera with IDOR check."""
    verify_camera_access(camera_id, current_user, db)
    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")
    
    status_info = stream_manager.get_status(cam.camera_id)
    if not status_info:
        return CameraHealthStatus(
            camera_id=cam.camera_id,
            status=cam.status,
            is_streaming=False,
            fps=cam.fps or 0.0,
            resolution=cam.resolution,
            last_seen_at=cam.last_seen_at,
            reconnect_attempts=0
        )
    return status_info

@router.get("/{camera_id}/live")
@router.get("/{camera_id}/preview")
@router.get("/{camera_id}/stream")
def get_live_video_stream(
    camera_id: str,
    fps: Optional[float] = Query(25.0, ge=1.0, le=60.0),
    profile: Optional[str] = Query("main", pattern="^(main|sub)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Authenticated HTTP MJPEG streaming endpoint for low-latency live camera preview.
    Supports 'main' (HD) and 'sub' (Low-bandwidth SD for slow border connections).
    Protected by JWT authentication and camera-level authorization.
    """
    verify_camera_access(camera_id, current_user, db)
    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")
    
    return StreamingResponse(
        stream_manager.generate_mjpeg_stream(cam.camera_id, fps_limit=fps, stream_profile=profile or "main"),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/{camera_id}/snapshot")
def get_camera_snapshot(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Returns single current JPEG snapshot frame. If stream is offline, returns a placeholder JPEG."""
    if current_user:
        verify_camera_access(camera_id, current_user, db)
    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")
    
    jpeg_bytes = stream_manager.get_latest_jpeg(cam.camera_id)
    if not jpeg_bytes:
        streamer = stream_manager.ensure_camera_running(cam.camera_id)
        if streamer:
            jpeg_bytes = streamer.get_latest_jpeg()

    if jpeg_bytes:
        return Response(content=jpeg_bytes, media_type="image/jpeg")

    # No live frame available — generate offline placeholder JPEG
    try:
        import numpy as np
        import cv2
        h, w = 360, 640
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        frame[:] = (18, 22, 28)  # Dark slate background
        # Grid lines
        for y in range(0, h, 60):
            cv2.line(frame, (0, y), (w, y), (35, 40, 48), 1)
        for x in range(0, w, 80):
            cv2.line(frame, (x, 0), (x, h), (35, 40, 48), 1)
        # Status text
        cv2.putText(frame, f"CAMERA OFFLINE", (w//2 - 120, h//2 - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (80, 80, 95), 2)
        cv2.putText(frame, f"{cam.camera_id} | {cam.camera_name}", (w//2 - 140, h//2 + 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (60, 65, 75), 1)
        cv2.putText(frame, f"BOP: {cam.bop_site or 'N/A'} | Status: {cam.status}",
                    (w//2 - 140, h//2 + 48), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (50, 55, 65), 1)
        # Red border
        cv2.rectangle(frame, (4, 4), (w - 4, h - 4), (40, 40, 80), 2)
        _, jpeg_buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        return Response(content=jpeg_buf.tobytes(), media_type="image/jpeg",
                        headers={"X-Camera-Status": cam.status or "OFFLINE"})
    except Exception:
        raise HTTPException(status_code=503, detail="No video frame available. Stream offline or initializing.")


@router.post("/{camera_id}/ingest-frame")
async def ingest_direct_camera_frame(
    camera_id: str,
    request: Request,
    file: Optional[UploadFile] = File(None),
    resolution: Optional[str] = Query(None),
    fps: Optional[float] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Direct browser/mobile reverse frame ingestion.
    Allows phones, laptops, and field edge nodes to stream live video directly into Central Command.
    """
    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    if file:
        frame_bytes = await file.read()
    else:
        frame_bytes = await request.body()

    if not frame_bytes:
        raise HTTPException(status_code=400, detail="Empty frame payload.")

    stream_manager.ingest_edge_frame(
        camera_id=cam.camera_id,
        frame_bytes=frame_bytes,
        resolution=resolution or "1280x720",
        fps=fps or 25.0
    )
    return {"success": True, "camera_id": cam.camera_id, "size_bytes": len(frame_bytes)}



@router.get("/{camera_id}/logs", response_model=List[CameraDiagnosticLogResponse])
def get_camera_diagnostic_logs(
    camera_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetches historical diagnostic and connection events for troubleshooting with IDOR check."""
    verify_camera_access(camera_id, current_user, db)
    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")
    
    logs = (
        db.query(CameraHealthLog)
        .filter(CameraHealthLog.camera_id == cam.camera_id)
        .order_by(CameraHealthLog.timestamp.desc())
        .limit(limit)
        .all()
    )
    return logs

@router.delete("/{camera_id}/logs", status_code=status.HTTP_200_OK)
def clear_camera_diagnostic_logs(
    camera_id: str,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_camera_admin)
):
    """Clears all historical diagnostic logs for a specific camera."""
    verify_camera_access(camera_id, admin_user, db)
    cam = camera_service.get_camera_by_id(db, camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    deleted = db.query(CameraHealthLog).filter(CameraHealthLog.camera_id == cam.camera_id).delete()
    db.commit()
    return {"success": True, "message": f"Cleared {deleted} diagnostic log entries for camera '{camera_id}'."}

