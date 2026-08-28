from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class VehicleWatchlistBase(BaseModel):
    plate_number: str = Field(..., min_length=3, max_length=30)
    vehicle_type: str = Field("car", description="car, truck, bus, motorcycle, suv, van")
    owner_name: Optional[str] = None
    status: str = Field("WATCHLIST", description="AUTHORIZED, WATCHLIST, MONITOR, BLOCKED, UNKNOWN")
    watchlist_category: str = Field("GENERAL", description="RESTRICTED_THREAT, SUSPICIOUS_MOVEMENT, ESCORTED, VIP, PATROL, GENERAL")
    notes: Optional[str] = None

class VehicleWatchlistCreate(VehicleWatchlistBase):
    pass

class VehicleWatchlistUpdate(BaseModel):
    plate_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    owner_name: Optional[str] = None
    status: Optional[str] = None
    watchlist_category: Optional[str] = None
    notes: Optional[str] = None

class VehicleWatchlistResponse(VehicleWatchlistBase):
    id: int
    normalized_plate_number: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ANPRRecognitionResult(BaseModel):
    camera_id: str
    track_id: int
    plate_number: str
    normalized_plate: str
    confidence: float
    plate_confidence: float = 0.90
    observations_count: int = 1
    vehicle_type: str = "car"
    match_status: str = "UNKNOWN"
    matched_owner: Optional[str] = None
    watchlist_notes: Optional[str] = None
    timestamp: datetime

class ANPREventResponse(BaseModel):
    id: int
    event_id: str
    camera_id: str
    track_id: int
    plate_number: str
    normalized_plate: str
    confidence: float
    plate_confidence: float
    observations_count: int
    vehicle_type: str
    match_status: str
    matched_owner: Optional[str] = None
    watchlist_notes: Optional[str] = None
    snapshot_url: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class ANPRSummary(BaseModel):
    total_reads: int = 0
    watchlist_matches: int = 0
    authorized_count: int = 0
    unknown_count: int = 0
    recent_events: List[ANPREventResponse] = []
