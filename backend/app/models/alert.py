from sqlalchemy import Column, Integer, String, Boolean, DateTime, Index
from datetime import datetime
from app.database import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. ALT-2026-000101
    event_id = Column(String(50), index=True, nullable=False) # Source SecurityEvent
    camera_id = Column(String(50), index=True, nullable=False)
    bop_site = Column(String(100), default="BOP Alpha", index=True)
    title = Column(String(200), nullable=False)
    
    # Priority: CRITICAL, HIGH, MEDIUM, LOW
    priority = Column(String(20), default="HIGH", index=True, nullable=False)
    risk_score = Column(Integer, default=50, index=True, nullable=False)
    
    # Status: NEW, ACKNOWLEDGED, DISMISSED, ESCALATED
    status = Column(String(30), default="NEW", index=True, nullable=False)
    
    assigned_to = Column(String(100), nullable=True, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String(100), nullable=True)
    
    # Server-driven SLA Escalation Deadline
    escalation_deadline = Column(DateTime, nullable=True, index=True)
    is_escalated = Column(Boolean, default=False, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Index("idx_alert_status_priority", Alert.status, Alert.priority, Alert.created_at)
