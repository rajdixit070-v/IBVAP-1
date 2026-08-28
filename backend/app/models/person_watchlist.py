from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.database import Base

class PersonWatchlist(Base):
    __tablename__ = "person_watchlists"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(String(50), unique=True, index=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    
    # Category: AUTHORIZED, WATCHLIST, MONITOR, RESTRICTED
    category = Column(String(50), default="WATCHLIST", index=True, nullable=False)
    
    # Status: ACTIVE, SUSPENDED, ARCHIVED
    status = Column(String(30), default="ACTIVE", index=True)
    
    # 128-d / 512-d normalized L2 facial feature embedding vector stored as JSON array
    embedding_json = Column(Text, nullable=False)
    
    photo_ref = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String(100), default="admin")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
