from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from app.database import Base

class ModelHealth(Base):
    __tablename__ = "model_health"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), unique=True, index=True, nullable=False) # e.g. "Activity Time-Series Forecaster"
    model_version = Column(String(20), default="1.0.0")
    
    # Status: HEALTHY, DEGRADED, TRAINING
    status = Column(String(30), default="HEALTHY")
    last_trained_at = Column(DateTime, default=datetime.utcnow)
    training_data_points = Column(Integer, default=1440)
    historical_days = Column(Integer, default=30)
    
    data_quality_score = Column(Float, default=0.92) # 0.0 to 1.0
    mae_score = Column(Float, default=1.85) # Mean Absolute Error
    rmse_score = Column(Float, default=2.45) # Root Mean Squared Error
    confidence_avg = Column(Float, default=0.78)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
