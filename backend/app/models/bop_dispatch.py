from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from datetime import datetime
from app.database import Base

class BOPDispatch(Base):
    __tablename__ = "bop_dispatches"

    id = Column(Integer, primary_key=True, index=True)
    dispatch_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. DISP-20260903-ALPHA-01
    bop_id = Column(String(50), index=True, nullable=False) # e.g. BOP-ALPHA
    site_id = Column(String(50), default="SITE-BORDER-NORTH", index=True)
    officer_username = Column(String(50), index=True, nullable=False)
    
    title = Column(String(200), nullable=False)
    summary = Column(Text, nullable=False)
    priority = Column(String(20), default="ROUTINE", index=True) # ROUTINE, IMPORTANT, URGENT, FLASH
    status = Column(String(30), default="SENT_TO_HQ", index=True) # SENT_TO_HQ, ACKNOWLEDGED_BY_HQ, ACTIONED
    
    detected_persons_count = Column(Integer, default=0)
    vehicles_scanned_count = Column(Integer, default=0)
    alerts_count = Column(Integer, default=0)
    evidence_ids = Column(Text, default="[]") # JSON string array of evidence IDs
    
    hq_notes = Column(Text, nullable=True) # Response / Directives issued by HQ Admin
    acknowledged_by = Column(String(50), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

Index("idx_dispatch_bop_status", BOPDispatch.bop_id, BOPDispatch.status)
