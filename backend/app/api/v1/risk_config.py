from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.models.risk_config import SystemRiskConfig
from app.models.audit_log import SecurityAuditLog
from app.schemas.risk import SystemRiskConfigSchema, SystemRiskConfigUpdate
from app.services.intelligence.risk_engine import risk_engine

router = APIRouter(prefix="/risk-config", tags=["Threat Risk Configuration"])

@router.get("/", response_model=SystemRiskConfigSchema)
def get_risk_configuration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves current system-wide risk factor weights, behavioural limits, and night hours."""
    config = db.query(SystemRiskConfig).first()
    if not config:
        config = SystemRiskConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.put("/", response_model=SystemRiskConfigSchema)
def update_risk_configuration(
    update_in: SystemRiskConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Updates risk factor weights, night hours, and loitering parameters."""
    config = db.query(SystemRiskConfig).first()
    if not config:
        config = SystemRiskConfig()
        db.add(config)

    for field, val in update_in.dict(exclude_unset=True).items():
        setattr(config, field, val)

    audit = SecurityAuditLog(
        username=current_user.username,
        action="RISK_CONFIG_UPDATED",
        resource_type="RISK_CONFIG",
        details="System risk scoring weights or behavioural parameters updated."
    )
    db.add(audit)

    db.commit()
    db.refresh(config)

    # Apply live to risk engine
    risk_engine.update_config(config)
    return config
