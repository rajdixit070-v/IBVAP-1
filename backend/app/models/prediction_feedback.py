from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from datetime import datetime
from app.database import Base

class PredictionFeedback(Base):
    __tablename__ = "prediction_feedback"

    id = Column(Integer, primary_key=True, index=True)
    feedback_id = Column(String(50), unique=True, index=True, nullable=False)
    warning_id = Column(String(50), index=True, nullable=False)
    
    # Feedback Type: USEFUL_FORECAST, FALSE_PREDICTION, INCONCLUSIVE
    feedback_type = Column(String(30), nullable=False)
    operator_username = Column(String(50), default="operator")
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

Index("idx_pred_fb_warn_op", PredictionFeedback.warning_id, PredictionFeedback.operator_username)
