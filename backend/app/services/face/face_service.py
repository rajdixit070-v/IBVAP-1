import json
import uuid
import logging
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.person_watchlist import PersonWatchlist
from app.models.face_event import FaceEvent
from app.schemas.face import FaceRecognitionResult
from app.services.ai.tracker import STrack
from app.services.face.face_detector import crop_face_region, evaluate_face_quality
from app.services.face.embedding_engine import face_embedding_engine, compute_cosine_similarity
from app.services.intelligence.event_manager import security_event_manager

logger = logging.getLogger("ibvap.face")

class FaceAnalyticsService:
    """
    Facial Detection, Quality Assessment & Watchlist Comparison Service.
    """
    def __init__(self, similarity_threshold: float = 0.75):
        self.similarity_threshold = similarity_threshold
        # (camera_id, track_id) -> { "best_quality": float, "match_status": str, "timestamp": datetime }
        self._processed_tracks: Dict[str, Dict[str, Any]] = {}

    def process_person_track(
        self,
        camera_id: str,
        frame: np.ndarray,
        track: STrack
    ) -> Optional[FaceRecognitionResult]:
        """
        Executes face quality check, embedding extraction, and watchlist matching.
        """
        if track.category != "person" or frame is None or frame.size == 0:
            return None

        track_key = f"{camera_id}:{track.track_id}"

        # 1. Extract Face Zone
        face_crop = crop_face_region(frame, track.bbox)
        if face_crop is None:
            return None

        # 2. Evaluate Face Quality
        quality_score, is_acceptable = evaluate_face_quality(face_crop)
        if not is_acceptable:
            return None

        # Check if we already have a higher-quality face match for this track
        existing = self._processed_tracks.get(track_key)
        if existing and existing.get("best_quality", 0.0) >= quality_score:
            return None

        # 3. Generate 128-d L2 Normalized Embedding
        current_embedding = face_embedding_engine.extract_embedding(face_crop)

        # 4. Query Watchlist Database for Cosine Matches
        db: Session = SessionLocal()
        try:
            watchlist_records = db.query(PersonWatchlist).filter(
                PersonWatchlist.status == "ACTIVE"
            ).all()

            best_match: Optional[PersonWatchlist] = None
            best_similarity = 0.0

            for record in watchlist_records:
                try:
                    ref_embedding = json.loads(record.embedding_json)
                    sim = compute_cosine_similarity(current_embedding, ref_embedding)
                    if sim > best_similarity:
                        best_similarity = sim
                        best_match = record
                except Exception:
                    continue

            # Classify match status
            if best_match and best_similarity >= self.similarity_threshold:
                if best_match.category == "AUTHORIZED":
                    match_status = "AUTHORIZED_MATCH"
                elif best_match.category in ["WATCHLIST", "RESTRICTED"]:
                    match_status = "WATCHLIST_POTENTIAL_MATCH"
                elif best_match.category == "MONITOR":
                    match_status = "MONITOR"
                else:
                    match_status = "UNKNOWN"
                matched_id = best_match.person_id
                matched_name = best_match.display_name
                matched_cat = best_match.category
            else:
                match_status = "UNKNOWN"
                matched_id = None
                matched_name = None
                matched_cat = None

            now = datetime.utcnow()
            event_id = f"FACE-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

            face_event = FaceEvent(
                event_id=event_id,
                camera_id=camera_id,
                track_id=track.track_id,
                match_status=match_status,
                matched_person_id=matched_id,
                matched_person_name=matched_name,
                matched_category=matched_cat,
                similarity_score=round(best_similarity, 2),
                quality_score=quality_score,
                verification_status="PENDING",
                timestamp=now
            )
            db.add(face_event)
            db.commit()

            self._processed_tracks[track_key] = {
                "best_quality": quality_score,
                "match_status": match_status,
                "timestamp": now
            }

            logger.info(f"Face [{camera_id}] Track #{track.track_id} -> {match_status} (Sim: {round(best_similarity, 2)}, Quality: {quality_score})")

            # 5. Escalate Risk Engine if Watchlist Potential Match
            if match_status == "WATCHLIST_POTENTIAL_MATCH":
                security_event_manager.dispatch_security_event(
                    camera_id=camera_id,
                    track_id=track.track_id,
                    object_type="person",
                    event_type="FACE_POTENTIAL_MATCH",
                    confidence=best_similarity,
                    bbox=track.bbox,
                    direction=track.direction,
                    speed=track.speed,
                    timeline_message=f"Facial Match: Potential Watchlist Match for Person #{track.track_id} (Identity: {matched_name} • Similarity: {round(best_similarity * 100)}%)"
                )

            return FaceRecognitionResult(
                camera_id=camera_id,
                track_id=track.track_id,
                match_status=match_status,
                matched_person_id=matched_id,
                matched_person_name=matched_name,
                matched_category=matched_cat,
                similarity_score=round(best_similarity, 2),
                quality_score=quality_score,
                verification_status="PENDING",
                timestamp=now
            )

        except Exception as e:
            logger.error(f"Face watchlist comparison error: {e}", exc_info=True)
            return None
        finally:
            db.close()

# Global Singleton
face_service = FaceAnalyticsService(similarity_threshold=0.75)
