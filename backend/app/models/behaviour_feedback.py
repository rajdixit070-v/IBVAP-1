from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from datetime import datetime
from app.database import Base

class BehaviourFeedback(Base):
    __tablename__ = "behaviour_feedback"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), nullable=False, index=True)
    feedback_type = Column(String(30), nullable=False) # CORRECT_DETECTION, FALSE_POSITIVE, NEEDS_REVIEW
    operator_username = Column(String(50), nullable=False, default="operator")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

Index("idx_feedback_event_op", BehaviourFeedback.event_id, BehaviourFeedback.operator_username)
