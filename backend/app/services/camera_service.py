import logging
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_

logger = logging.getLogger("ibvap.camera_service")

from app.models.camera import Camera
from app.models.health_log import CameraHealthLog
from app.schemas.camera import CameraCreate, CameraUpdate, CameraResponse
from app.schemas.health import CameraSummaryStats
from app.core.security import encrypt_credential, decrypt_credential, mask_rtsp_url
from app.services.stream_manager import stream_manager

def format_camera_response(cam: Camera) -> CameraResponse:
    """Safely formats a Camera model into a sanitized CameraResponse (never leaking passwords)."""
    return CameraResponse(
        id=cam.id,
        camera_id=cam.camera_id,
        camera_name=cam.camera_name,
        description=cam.description,
        bop_site=cam.bop_site,
        site_id=getattr(cam, "site_id", None),
        bop_id=getattr(cam, "bop_id", None),
        edge_node_id=getattr(cam, "edge_node_id", None),
        sector=cam.sector,
        location=cam.location,
        latitude=cam.latitude,
        longitude=cam.longitude,
        rtsp_url=mask_rtsp_url(cam.rtsp_url),
        username=cam.username,
        has_password=bool(cam.encrypted_password),
        stream_type=cam.stream_type or "main",
        resolution=cam.resolution,
        fps=cam.fps or 0.0,
        codec=cam.codec or "H.264",
        enabled=cam.enabled,
        status=cam.status,
        last_seen_at=cam.last_seen_at,
        created_at=cam.created_at,
        updated_at=cam.updated_at
    )

def list_cameras(
    db: Session,
    search: Optional[str] = None,
    bop_site: Optional[str] = None,
    sector: Optional[str] = None,
    status: Optional[str] = None,
    enabled: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100
) -> Tuple[List[CameraResponse], int]:
    """Retrieves paginated and filtered camera list."""
    query = db.query(Camera)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Camera.camera_id.ilike(search_pattern),
                Camera.camera_name.ilike(search_pattern),
                Camera.location.ilike(search_pattern),
                Camera.bop_site.ilike(search_pattern)
            )
        )
    if bop_site:
        query = query.filter(Camera.bop_site == bop_site)
    if sector:
        query = query.filter(Camera.sector == sector)
    if status:
        query = query.filter(Camera.status == status)
    if enabled is not None:
        query = query.filter(Camera.enabled == enabled)

    total = query.count()
    cameras = query.order_by(Camera.camera_id.asc()).offset(skip).limit(limit).all()
    
    return [format_camera_response(c) for c in cameras], total

def get_camera_by_id(db: Session, camera_id: str) -> Optional[Camera]:
    """Finds camera by unique identifier (CAM-001) or database integer ID."""
    if camera_id.isdigit():
        cam = db.query(Camera).filter(Camera.id == int(camera_id)).first()
        if cam:
            return cam
    return db.query(Camera).filter(Camera.camera_id == camera_id).first()

def create_camera(db: Session, camera_in: CameraCreate) -> CameraResponse:
    """Creates a new camera, encrypts credentials, and starts stream if enabled."""
    encrypted_pw = encrypt_credential(camera_in.password) if camera_in.password else None
    
    db_camera = Camera(
        camera_id=camera_in.camera_id.strip().upper(),
        camera_name=camera_in.camera_name.strip(),
        description=camera_in.description,
        bop_site=camera_in.bop_site.strip(),
        site_id=camera_in.site_id or "SITE-BORDER-NORTH",
        bop_id=camera_in.bop_id,
        edge_node_id=camera_in.edge_node_id or "EDGE-BOP-001",
        sector=camera_in.sector.strip(),
        location=camera_in.location,
        latitude=camera_in.latitude,
        longitude=camera_in.longitude,
        rtsp_url=camera_in.rtsp_url.strip(),
        username=camera_in.username.strip() if camera_in.username else None,
        encrypted_password=encrypted_pw,
        stream_type=camera_in.stream_type or "main",
        enabled=camera_in.enabled,
        status="CONNECTING" if camera_in.enabled else "OFFLINE"
    )
    db.add(db_camera)
    db.commit()
    db.refresh(db_camera)

    # Start live stream ingestion if enabled
    if db_camera.enabled:
        decrypted_pw = camera_in.password
        stream_manager.start_camera(
            camera_id=db_camera.camera_id,
            camera_name=db_camera.camera_name,
            bop_site=db_camera.bop_site,
            rtsp_url=db_camera.rtsp_url,
            username=db_camera.username,
            password=decrypted_pw
        )

    return format_camera_response(db_camera)

def update_camera(db: Session, db_camera: Camera, camera_in: CameraUpdate) -> CameraResponse:
    """Updates camera attributes and refreshes streamer if configuration changed."""
    update_data = camera_in.model_dump(exclude_unset=True)
    
    reconnect_needed = False
    if "password" in update_data:
        new_pw = update_data.pop("password")
        if new_pw is not None:
            db_camera.encrypted_password = encrypt_credential(new_pw)
            reconnect_needed = True

    if "rtsp_url" in update_data and update_data["rtsp_url"] != db_camera.rtsp_url:
        reconnect_needed = True
    if "username" in update_data and update_data["username"] != db_camera.username:
        reconnect_needed = True

    for field, value in update_data.items():
        setattr(db_camera, field, value)

    db_camera.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_camera)

    # Manage streamer state
    stream_running = db_camera.camera_id in stream_manager._streamers
    if not db_camera.enabled:
        stream_manager.stop_camera(db_camera.camera_id)
        db_camera.status = "OFFLINE"
        db.commit()
    elif reconnect_needed or not stream_running:
        decrypted_pw = decrypt_credential(db_camera.encrypted_password)
        stream_manager.start_camera(
            camera_id=db_camera.camera_id,
            camera_name=db_camera.camera_name,
            bop_site=db_camera.bop_site,
            rtsp_url=db_camera.rtsp_url,
            username=db_camera.username,
            password=decrypted_pw
        )

    return format_camera_response(db_camera)

def delete_camera(db: Session, db_camera: Camera):
    """Stops streamer, unregisters AI worker, cleans up dependent records, and deletes camera record."""
    cam_id = db_camera.camera_id

    # 1. Stop streamer and AI worker
    stream_manager.stop_camera(cam_id)
    try:
        from app.services.ai.pipeline import ai_pipeline
        ai_pipeline.unregister_camera(cam_id)
    except Exception as e:
        logger.debug(f"AI pipeline unregister notice for {cam_id}: {e}")

    # 2. Cascade delete dependent configurations & logs
    try:
        from app.models.ai_config import CameraAIConfig
        db.query(CameraAIConfig).filter(CameraAIConfig.camera_id == cam_id).delete(synchronize_session=False)
    except Exception:
        pass

    try:
        from app.models.zone import SecurityZone
        db.query(SecurityZone).filter(SecurityZone.camera_id == cam_id).delete(synchronize_session=False)
    except Exception:
        pass

    try:
        from app.models.camera_transition import CameraTransition
        db.query(CameraTransition).filter(
            (CameraTransition.from_camera_id == cam_id) | (CameraTransition.to_camera_id == cam_id)
        ).delete(synchronize_session=False)
    except Exception:
        pass

    try:
        db.query(CameraHealthLog).filter(CameraHealthLog.camera_id == cam_id).delete(synchronize_session=False)
    except Exception:
        pass

    # 3. Delete camera
    db.delete(db_camera)
    db.commit()
    logger.info(f"Camera {cam_id} and all related configurations deleted successfully.")

def get_overview_summary(db: Session) -> Dict[str, Any]:
    """Aggregates high-level camera statistics grouped by BOP and health status."""
    cameras = db.query(Camera).all()
    total = len(cameras)
    healthy = sum(1 for c in cameras if c.status == "HEALTHY")
    degraded = sum(1 for c in cameras if c.status == "DEGRADED")
    offline = sum(1 for c in cameras if c.status == "OFFLINE")
    error = sum(1 for c in cameras if c.status in ("ERROR", "CONNECTING"))

    bop_summary = {}
    for c in cameras:
        if c.bop_site not in bop_summary:
            bop_summary[c.bop_site] = {"total": 0, "healthy": 0, "degraded": 0, "offline": 0}
        bop_summary[c.bop_site]["total"] += 1
        st = c.status.lower()
        if st in bop_summary[c.bop_site]:
            bop_summary[c.bop_site][st] += 1

    return {
        "total_cameras": total,
        "healthy": healthy,
        "degraded": degraded,
        "offline": offline,
        "error": error,
        "bop_summary": bop_summary
    }
