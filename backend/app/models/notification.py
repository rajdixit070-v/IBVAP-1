from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), default="all", index=True)
    alert_id = Column(String(50), nullable=True)
    incident_id = Column(String(50), nullable=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String(20), default="HIGH", index=True)
    read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

Index("idx_notification_user_read", Notification.user_id, Notification.read, Notification.created_at)
