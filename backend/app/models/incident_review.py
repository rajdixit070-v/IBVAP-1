from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, Index
from datetime import datetime
from app.database import Base

class IncidentReview(Base):
    __tablename__ = "incident_reviews"

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(String(50), unique=True, index=True, nullable=False)
    incident_id = Column(String(50), unique=True, index=True, nullable=False)
    
    # Outcome: TRUE_EVENT, FALSE_ALARM, ENVIRONMENTAL, INFRASTRUCTURE, AUTHORIZED_ACTIVITY, UNKNOWN
    outcome_category = Column(String(50), nullable=False)
    root_cause = Column(Text, nullable=True)
    preventative_actions = Column(Text, nullable=True)
    calibration_recommended = Column(Boolean, default=False)
    
    operator_username = Column(String(50), default="operator")
    reviewed_at = Column(DateTime, default=datetime.utcnow, index=True)

Index("idx_inc_review_cat", IncidentReview.outcome_category)
