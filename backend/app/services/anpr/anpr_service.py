import uuid
import logging
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.vehicle_watchlist import VehicleWatchlist
from app.models.anpr_event import ANPREvent
from app.schemas.anpr import ANPRRecognitionResult
from app.services.ai.tracker import STrack
from app.services.anpr.plate_detector import crop_plate_region, preprocess_plate_image, estimate_plate_quality
from app.services.anpr.ocr_engine import ocr_engine, normalize_plate_number
from app.services.anpr.consensus import plate_consensus_manager
from app.services.intelligence.event_manager import security_event_manager

logger = logging.getLogger("ibvap.anpr")

class ANPRService:
    """
    Automatic Number Plate Recognition & Vehicle Intelligence Pipeline Coordinator.
    """
    def __init__(self):
        # (camera_id, track_id) -> recognized_plate_record
        self._processed_tracks: Dict[str, Dict[str, Any]] = {}

    def process_vehicle_track(
        self,
        camera_id: str,
        frame: np.ndarray,
        track: STrack
    ) -> Optional[ANPRRecognitionResult]:
        """
        Executes ANPR pipeline for a vehicle track.
        """
        if track.category != "vehicle" or frame is None or frame.size == 0:
            return None

        track_key = f"{camera_id}:{track.track_id}"
        
        # 1. Crop candidate license plate region
        plate_crop = crop_plate_region(frame, track.bbox)
        if plate_crop is None:
            return None

        # 2. Quality Gate Check
        quality_score, is_acceptable = estimate_plate_quality(plate_crop)
        if not is_acceptable and track.frame_count < 5:
            # Reject poor quality if earlier in track life
            return None

        # 3. Preprocess Image & OCR
        preprocessed = preprocess_plate_image(plate_crop)
        raw_text, norm_text, ocr_conf = ocr_engine.recognize(preprocessed)

        if not norm_text or len(norm_text) < 4:
            return None

        # 4. Multi-Frame Temporal Consensus Voting
        history = plate_consensus_manager.get_or_create_history(camera_id, track.track_id)
        consensus_plate, consensus_conf, obs_count = history.add_reading(
            raw_text=raw_text,
            normalized_text=norm_text,
            confidence=ocr_conf
        )

        if not consensus_plate or obs_count < 2 or consensus_conf < 0.70:
            return None

        # 5. Check if already matched to avoid duplicate spamming
        existing = self._processed_tracks.get(track_key)
        if existing and existing.get("plate") == consensus_plate:
            return None

        # 6. Database Watchlist Lookup
        db: Session = SessionLocal()
        try:
            watchlist_entry = db.query(VehicleWatchlist).filter(
                VehicleWatchlist.normalized_plate_number == consensus_plate
            ).first()

            if watchlist_entry:
                if watchlist_entry.status == "AUTHORIZED":
                    match_status = "AUTHORIZED"
                elif watchlist_entry.status in ["WATCHLIST", "BLOCKED"]:
                    match_status = "WATCHLIST_MATCH"
                elif watchlist_entry.status == "MONITOR":
                    match_status = "MONITOR"
                else:
                    match_status = "UNKNOWN"
                matched_owner = watchlist_entry.owner_name
                watchlist_notes = watchlist_entry.notes
            else:
                match_status = "UNKNOWN"
                matched_owner = None
                watchlist_notes = None

            now = datetime.utcnow()
            event_id = f"ANPR-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

            anpr_record = ANPREvent(
                event_id=event_id,
                camera_id=camera_id,
                track_id=track.track_id,
                plate_number=consensus_plate,
                normalized_plate=consensus_plate,
                confidence=consensus_conf,
                plate_confidence=quality_score,
                observations_count=obs_count,
                vehicle_type=track.object_type,
                match_status=match_status,
                matched_owner=matched_owner,
                watchlist_notes=watchlist_notes,
                timestamp=now
            )
            db.add(anpr_record)
            db.commit()

            self._processed_tracks[track_key] = {
                "plate": consensus_plate,
                "match_status": match_status,
                "timestamp": now
            }

            logger.info(f"ANPR [{camera_id}] Vehicle #{track.track_id} -> {consensus_plate} ({match_status} • Conf: {consensus_conf})")

            # 7. Capture Forensic Evidence & Escalate Risk Engine if Watchlist Match
            evd = None
            if frame is not None and frame.size > 0:
                try:
                    from app.services.evidence.evidence_manager import evidence_manager
                    evd = evidence_manager.capture_and_save_frame(
                        camera_id=camera_id,
                        frame=frame,
                        track=track,
                        event_type="VEHICLE_PLATE_IDENTIFIED"
                    )
                except Exception as ee:
                    logger.warning(f"ANPR evidence save failed: {ee}")

            if match_status == "WATCHLIST_MATCH":
                security_event_manager.dispatch_security_event(
                    camera_id=camera_id,
                    track_id=track.track_id,
                    object_type=track.object_type,
                    event_type="ANPR_WATCHLIST_MATCH",
                    confidence=consensus_conf,
                    bbox=track.bbox,
                    direction=track.direction,
                    speed=track.speed,
                    timeline_message=f"ANPR Watchlist Alert: High-risk vehicle matched with Plate {consensus_plate} ({matched_owner or 'Unknown Owner'})",
                    evidence_id=evd.evidence_id if evd else None,
                    evidence_path=evd.file_path if evd else None
                )
            elif match_status != "AUTHORIZED":
                security_event_manager.dispatch_security_event(
                    camera_id=camera_id,
                    track_id=track.track_id,
                    object_type=track.object_type,
                    event_type="ANPR_PLATE_DETECTED",
                    confidence=consensus_conf,
                    bbox=track.bbox,
                    direction=track.direction,
                    speed=track.speed,
                    timeline_message=f"Vehicle Identification: License plate {consensus_plate} registered on camera {camera_id} (Confidence: {int(consensus_conf * 100)}%)",
                    evidence_id=evd.evidence_id if evd else None,
                    evidence_path=evd.file_path if evd else None
                )

            return ANPRRecognitionResult(
                camera_id=camera_id,
                track_id=track.track_id,
                plate_number=consensus_plate,
                normalized_plate=consensus_plate,
                confidence=consensus_conf,
                plate_confidence=quality_score,
                observations_count=obs_count,
                vehicle_type=track.object_type,
                match_status=match_status,
                matched_owner=matched_owner,
                watchlist_notes=watchlist_notes,
                timestamp=now
            )

        except Exception as e:
            logger.error(f"ANPR database lookup error: {e}", exc_info=True)
            return None
        finally:
            db.close()

# Global Singleton
anpr_service = ANPRService()
