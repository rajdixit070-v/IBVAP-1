from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Index
from datetime import datetime
from app.database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. ORG-IBVAP
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    status = Column(String(20), default="ACTIVE", index=True) # ACTIVE, INACTIVE
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Region(Base):
    __tablename__ = "regions"

    id = Column(Integer, primary_key=True, index=True)
    region_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. REG-NORTH
    org_id = Column(String(50), index=True, nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(20), index=True, nullable=False)
    description = Column(String(255), nullable=True)
    status = Column(String(20), default="ACTIVE", index=True) # ACTIVE, INACTIVE
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. SITE-BORDER-NORTH
    region_id = Column(String(50), index=True, nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(20), index=True, nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(200), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timezone = Column(String(50), default="UTC")
    status = Column(String(20), default="ACTIVE", index=True) # ACTIVE, INACTIVE, MAINTENANCE, DEGRADED
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BOP(Base):
    __tablename__ = "bops"

    id = Column(Integer, primary_key=True, index=True)
    bop_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. BOP-001 or BOP Alpha
    site_id = Column(String(50), index=True, nullable=False)
    name = Column(String(100), nullable=False) # e.g. BOP Alpha
    code = Column(String(20), index=True, nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(200), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    status = Column(String(20), default="ACTIVE", index=True) # ACTIVE, INACTIVE, MAINTENANCE, DEGRADED
    operational_priority = Column(String(20), default="NORMAL", index=True) # CRITICAL, HIGH, NORMAL, LOW
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SiteUserScope(Base):
    __tablename__ = "site_user_scopes"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), index=True, nullable=False)
    scope_type = Column(String(20), nullable=False) # GLOBAL, REGION, SITE, BOP
    scope_id = Column(String(50), nullable=False) # '*', region_id, site_id, or bop_id
    role = Column(String(30), default="SITE_ADMIN", nullable=False) # SUPER_ADMIN, REGIONAL_ADMIN, SITE_ADMIN, BOP_OPERATOR, ANALYST
    assigned_by = Column(String(50), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Index("idx_user_scope_lookup", SiteUserScope.username, SiteUserScope.scope_type, SiteUserScope.scope_id)

class ConfigurationScope(Base):
    __tablename__ = "configuration_scopes"

    id = Column(Integer, primary_key=True, index=True)
    scope_level = Column(String(20), nullable=False) # GLOBAL, SITE, BOP, ZONE, CAMERA
    scope_id = Column(String(50), index=True, nullable=False) # '*', site_id, bop_id, zone_id, camera_id
    config_key = Column(String(100), index=True, nullable=False)
    config_value_json = Column(Text, nullable=False)
    overridden_by = Column(String(50), default="admin")
    reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Index("idx_config_scope_key", ConfigurationScope.scope_level, ConfigurationScope.scope_id, ConfigurationScope.config_key)
