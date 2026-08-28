from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.database import Base

class VehicleWatchlist(Base):
    __tablename__ = "vehicle_watchlists"

    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String(30), unique=True, index=True, nullable=False)
    normalized_plate_number = Column(String(30), unique=True, index=True, nullable=False)
    vehicle_type = Column(String(50), default="car") # car, truck, bus, motorcycle, suv, van
    owner_name = Column(String(100), nullable=True)
    
    # Status: AUTHORIZED, WATCHLIST, MONITOR, BLOCKED, UNKNOWN
    status = Column(String(30), default="WATCHLIST", index=True, nullable=False)
    
    # Category: RESTRICTED_THREAT, SUSPICIOUS_MOVEMENT, ESCORTED, VIP, PATROL, GENERAL
    watchlist_category = Column(String(50), default="GENERAL")
    
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), default="admin")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
