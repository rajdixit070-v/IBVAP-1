from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.database import Base

class SecurityAuditLog(Base):
    __tablename__ = "security_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False) # ZONE_CREATED, ZONE_UPDATED, ZONE_DELETED, EVENT_ACKNOWLEDGED, EVENT_DISMISSED, CONFIG_CHANGED
    resource_type = Column(String(50), nullable=False) # ZONE, EVENT, RISK_CONFIG
    resource_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

# Alias for consistent naming
AuditLog = SecurityAuditLog
