import os
import logging
from typing import List, Dict, Any, Optional
from app.config import settings
from app.schemas.ai import ModelStatusItem, AIModelsOverviewResponse
from app.services.face.embedding_engine import face_embedding_engine

logger = logging.getLogger("ibvap.ai.model_provisioning")

def get_ai_models_status(is_admin: bool = False) -> List[ModelStatusItem]:
    """
    Returns truthful, un-faked runtime status for all configured AI models:
    - YOLO Object Detector
    - Face Recognition (SFace/ArcFace)
    - Dedicated Drone / UAV Detector

    Masks filesystem absolute paths for non-admin users to prevent information disclosure.
    """
    from app.services.ai.pipeline import ai_pipeline_manager

    detector = ai_pipeline_manager.detector
    face_engine = face_embedding_engine

    items: List[ModelStatusItem] = []

    # 1. Primary YOLO Object Detector
    yolo_path = getattr(settings, "YOLO_MODEL_PATH", "yolov8n.pt")
    yolo_configured = bool(yolo_path)
    yolo_resolved = detector.resolved_path if detector else None
    yolo_exists = bool(yolo_resolved and os.path.exists(yolo_resolved))
    yolo_loaded = bool(detector and detector.is_loaded)
    if yolo_loaded:
        yolo_status = "LOADED"
    elif not yolo_configured:
        yolo_status = "NOT_CONFIGURED"
    elif not yolo_exists:
        yolo_status = "FILE_MISSING"
    elif detector and detector.status == "ERROR":
        yolo_status = "ERROR"
    else:
        yolo_status = "FILE_MISSING"

    display_yolo = yolo_path if is_admin else (os.path.basename(yolo_path) if yolo_path else None)

    items.append(ModelStatusItem(
        model_name="YOLO Object Detector",
        model_path=display_yolo,
        configured=yolo_configured,
        file_exists=yolo_exists,
        loaded=yolo_loaded,
        status=yolo_status,
        error=detector.error if detector else None,
        capabilities=["person", "vehicle", "animal"] if yolo_loaded else []
    ))

    # 2. Facial Biometrics Engine (SFace / ArcFace)
    face_path = getattr(settings, "FACE_MODEL_PATH", "models/face_recognition_sface.onnx")
    face_configured = bool(face_path)
    face_resolved = face_engine.resolved_path if face_engine else None
    face_exists = bool(face_resolved and os.path.exists(face_resolved))
    face_loaded = bool(face_engine and face_engine.is_loaded)
    if face_loaded:
        face_status = "LOADED"
    elif not face_configured:
        face_status = "NOT_CONFIGURED"
    elif not face_exists:
        face_status = "FILE_MISSING"
    elif face_engine and face_engine.status == "FACE_MODEL_ERROR":
        face_status = "ERROR"
    else:
        face_status = "FILE_MISSING"

    display_face = face_path if is_admin else (os.path.basename(face_path) if face_path else None)

    items.append(ModelStatusItem(
        model_name="Face Biometric Recognizer (SFace/ArcFace)",
        model_path=display_face,
        configured=face_configured,
        file_exists=face_exists,
        loaded=face_loaded,
        status=face_status,
        error=face_engine.error if face_engine else None,
        capabilities=["face_embedding", "face_similarity"] if face_loaded else []
    ))

    # 3. Dedicated UAV / Drone Detector
    drone_path = getattr(settings, "DRONE_MODEL_PATH", None)
    drone_configured = bool(drone_path)
    drone_resolved = detector.resolved_drone_path if detector else None
    drone_exists = bool(drone_resolved and os.path.exists(drone_resolved))
    drone_loaded = bool(detector and detector.drone_status == "LOADED")
    if drone_loaded:
        drone_status = "LOADED"
    elif not drone_configured:
        drone_status = "NOT_CONFIGURED"
    elif not drone_exists:
        drone_status = "FILE_MISSING"
    elif detector and detector.drone_status == "ERROR":
        drone_status = "ERROR"
    else:
        drone_status = "NOT_CONFIGURED"

    display_drone = drone_path if is_admin else (os.path.basename(drone_path) if drone_path else None)

    items.append(ModelStatusItem(
        model_name="Dedicated Drone/UAV Detector",
        model_path=display_drone,
        configured=drone_configured,
        file_exists=drone_exists,
        loaded=drone_loaded,
        status=drone_status,
        error=detector.drone_error if detector else None,
        capabilities=["drone", "uav", "quadcopter"] if drone_loaded else []
    ))

    return items
