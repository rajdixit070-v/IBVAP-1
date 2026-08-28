from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime
from datetime import datetime
from app.database import Base

class IncidentPlaybook(Base):
    __tablename__ = "incident_playbooks"

    id = Column(Integer, primary_key=True, index=True)
    playbook_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. PB-VIRTUAL-FENCE
    name = Column(String(100), nullable=False)
    event_type = Column(String(60), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # JSON list of checklist step definitions:
    # [{"step_id": 1, "title": "Verify source camera feed", "required": true, "action": "VERIFY_STREAM"}]
    steps_json = Column(Text, default="[]")
    
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
