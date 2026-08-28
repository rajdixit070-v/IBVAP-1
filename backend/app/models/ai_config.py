from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime
from datetime import datetime
from app.database import Base

class CameraAIConfig(Base):
    __tablename__ = "camera_ai_configs"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String(50), unique=True, index=True, nullable=False)
    enabled = Column(Boolean, default=True, index=True)
    
    # Model configuration
    model_name = Column(String(50), default="yolov8n") # yolov8n, yolov8s, yolov8m, specialized_border
    target_fps = Column(Float, default=10.0)             # Decoupled inference rate (e.g. 10 FPS)
    input_size = Column(Integer, default=640)           # 640x640 resize strategy
    device = Column(String(20), default="auto")          # auto, cpu, cuda
    
    # Configurable Confidence Thresholds
    conf_person = Column(Float, default=0.40)
    conf_vehicle = Column(Float, default=0.45)
    conf_animal = Column(Float, default=0.35)
    conf_drone = Column(Float, default=0.30)
    conf_other = Column(Float, default=0.40)
    
    # Tracker parameters
    track_thresh = Column(Float, default=0.45)
    match_thresh = Column(Float, default=0.70)
    max_lost_frames = Column(Integer, default=30)       # ~3 seconds at 10 FPS
    max_trajectory_length = Column(Integer, default=30)  # Bounded history
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
