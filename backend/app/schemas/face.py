from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class PersonWatchlistBase(BaseModel):
    person_id: str = Field(..., min_length=2, max_length=50)
    display_name: str = Field(..., min_length=2, max_length=100)
    category: str = Field("WATCHLIST", description="AUTHORIZED, WATCHLIST, MONITOR, RESTRICTED")
    status: str = Field("ACTIVE", description="ACTIVE, SUSPENDED, ARCHIVED")
    notes: Optional[str] = None
    photo_ref: Optional[str] = None

class PersonWatchlistCreate(PersonWatchlistBase):
    # Optional embedding vector (128 floats) or generated automatically
    embedding: Optional[List[float]] = None

class PersonWatchlistUpdate(BaseModel):
    display_name: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    photo_ref: Optional[str] = None
    embedding: Optional[List[float]] = None

class PersonWatchlistResponse(PersonWatchlistBase):
    id: int
    created_by: str
    created_at: datetime
    updated_at: datetime
    # Raw embedding vector is omitted for privacy

    class Config:
        from_attributes = True

class FaceRecognitionResult(BaseModel):
    camera_id: str
    track_id: int
    match_status: str
    matched_person_id: Optional[str] = None
    matched_person_name: Optional[str] = None
    matched_category: Optional[str] = None
    similarity_score: float = 0.0
    quality_score: float = 1.0
    verification_status: str = "PENDING"
    timestamp: datetime

class FaceEventResponse(BaseModel):
    id: int
    event_id: str
    camera_id: str
    track_id: int
    match_status: str
    matched_person_id: Optional[str] = None
    matched_person_name: Optional[str] = None
    matched_category: Optional[str] = None
    similarity_score: float
    quality_score: float
    verification_status: str
    verification_notes: Optional[str] = None
    snapshot_url: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class FaceVerificationUpdate(BaseModel):
    verification_status: str = Field(..., description="VERIFIED, DISMISSED, PENDING")
    verification_notes: Optional[str] = None

class FaceAnalyticsSummary(BaseModel):
    total_faces: int = 0
    potential_matches: int = 0
    authorized_faces: int = 0
    unknown_faces: int = 0
    recent_events: List[FaceEventResponse] = []
