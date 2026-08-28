from sqlalchemy import Column, Integer, String, DateTime, Index
from datetime import datetime
from app.database import Base

class IncidentRelationship(Base):
    __tablename__ = "incident_relationships"

    id = Column(Integer, primary_key=True, index=True)
    relationship_id = Column(String(50), unique=True, index=True, nullable=False)
    parent_id = Column(String(50), index=True, nullable=False)
    child_id = Column(String(50), index=True, nullable=False)
    
    # Relationship Type: PARENT_CHILD, RELATED, CLUSTER
    relationship_type = Column(String(30), default="RELATED", index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

Index("idx_inc_rel_parent_child", IncidentRelationship.parent_id, IncidentRelationship.child_id)
