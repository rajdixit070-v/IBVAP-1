import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.services.demo.demo_service import DemoService

logger = logging.getLogger("ibvap.api.demo")

router = APIRouter(prefix="/demo", tags=["Demo Mode & Evaluation Engine"])

class RunScenarioRequest(BaseModel):
    scenario_id: str = Field(default="HACKATHON_MASTER_FLOW", description="Scenario ID to execute")
    step_index: Optional[int] = Field(default=None, description="Specific step to execute (1-16) or None for auto-advance")
    auto_run_all: bool = Field(default=False, description="Run all steps in the scenario sequentially")

@router.get("/status")
def get_demo_status():
    """Returns current active demonstration state, history, and generated artifacts."""
    return DemoService.get_status()

@router.get("/scenarios")
def list_available_scenarios():
    """Lists available deterministic demonstration flows."""
    return [
        {
            "id": "HACKATHON_MASTER_FLOW",
            "name": "16-Step Master Intrusion & Incident Workflow",
            "steps_count": 16,
            "description": "Deterministic end-to-end chain: Camera -> AI Person Detection -> Track -> Virtual Fence Breach -> Multimodal Risk -> Alert Broadcast -> Evidence -> Incident Playbook -> Operator Resolution -> Audit."
        },
        {
            "id": "VEHICLE_ANPR_FLOW",
            "name": "Vehicle Classification & Speed ANPR",
            "steps_count": 5,
            "description": "Truck detection, plate OCR character voting, tactical zone speed threshold breach."
        },
        {
            "id": "MULTI_CAMERA_HANDOVER",
            "name": "Cross-Camera Re-Identification & Handover",
            "steps_count": 4,
            "description": "Subject moving from Camera 1 to Camera 2 with global track ID continuity."
        },
        {
            "id": "SYSTEM_FAILURE_RECOVERY",
            "name": "Stream Loss & Self-Healing Diagnostics",
            "steps_count": 3,
            "description": "Camera disconnection, self-diagnostic alert, exponential backoff reconnection."
        }
    ]

@router.post("/run-scenario")
def run_demo_scenario(
    req: RunScenarioRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Executes a step or entire scenario in the isolated demonstration engine."""
    if settings.ENV_MODE == "production" and not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo scenario execution is disabled in production environment."
        )

    if req.auto_run_all:
        results = []
        max_steps = 16 if req.scenario_id == "HACKATHON_MASTER_FLOW" else 5
        for s in range(1, max_steps + 1):
            res = DemoService.execute_step(req.scenario_id, s, db)
            results.append(res)
        return {
            "status": "COMPLETED",
            "scenario_id": req.scenario_id,
            "total_steps": len(results),
            "results": results
        }
    else:
        current_step = req.step_index or (DemoService.get_status()["current_step"] + 1)
        res = DemoService.execute_step(req.scenario_id, current_step, db)
        return res

@router.post("/reset")
def reset_demo_state(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Resets demo mode state and clears ephemeral demonstration artifacts."""
    if settings.ENV_MODE == "production" and not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo reset is disabled in production environment."
        )
    return DemoService.reset_demo(db)
