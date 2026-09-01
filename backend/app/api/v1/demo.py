from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.demo.demo_service import DemoService
from app.services.demo.demo_seeder import (
    seed_demo_data,
    purge_demo_data,
    simulate_live_threat,
    get_demo_status
)

router = APIRouter(prefix="/demo", tags=["Demo & Threat Simulation"])

class RunScenarioRequest(BaseModel):
    scenario_id: str
    step_index: Optional[int] = 1
    auto_run_all: Optional[bool] = False

@router.get("/status")
def get_status(db: Session = Depends(get_db)):
    """Returns whether demo mode is currently active and database row counts."""
    service_status = DemoService.get_status()
    seeder_status = get_demo_status(db)
    return {
        "demo_active": service_status["demo_active"] or seeder_status["demo_active"],
        **service_status,
        "counts": seeder_status.get("counts", {})
    }

@router.get("/scenarios")
def get_scenarios():
    """Requirement 87: Returns list of pre-packaged deterministic demo scenarios."""
    return [
        {
            "id": "HACKATHON_MASTER_FLOW",
            "name": "16-Step Master Intrusion & Incident Workflow",
            "total_steps": 16,
            "description": "Complete end-to-end tactical intrusion, AI detection, polygon breach, multi-factor risk scoring, alert dispatch, and incident resolution."
        },
        {
            "id": "VEHICLE_ANPR_FLOW",
            "name": "Vehicle ANPR & Tactical Speeding Workflow",
            "total_steps": 1,
            "description": "High-confidence OCR license plate extraction and watchlist cross-matching at checkpoint."
        },
        {
            "id": "MULTI_CAMERA_HANDOVER",
            "name": "Multi-Camera Handover & Re-Identification",
            "total_steps": 1,
            "description": "Seamless zero-line cross-camera tracking handoff and global track continuity."
        },
        {
            "id": "SYSTEM_FAILURE_RECOVERY",
            "name": "Camera Failure & Automatic Self-Healing",
            "total_steps": 3,
            "description": "Simulated hardware link failure, exponential backoff, and transparent stream restoration."
        }
    ]

@router.post("/reset")
def reset_demo(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Resets demonstration state to initial baseline."""
    return DemoService.reset_demo(db)

@router.post("/run-scenario")
def run_scenario(
    req: RunScenarioRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Executes a single step or full sequence of a deterministic demonstration scenario."""
    if req.auto_run_all:
        results = []
        if req.scenario_id == "HACKATHON_MASTER_FLOW":
            total_steps = 16
            for s in range(1, total_steps + 1):
                results.append(DemoService.execute_step(req.scenario_id, s, db))
            return {
                "status": "COMPLETED",
                "scenario_id": req.scenario_id,
                "total_steps": total_steps,
                "results": results
            }
        else:
            step_res = DemoService.execute_step(req.scenario_id, 1, db)
            return {
                "status": "COMPLETED",
                "scenario_id": req.scenario_id,
                "total_steps": 1,
                "results": [step_res]
            }

    step_res = DemoService.execute_step(req.scenario_id, req.step_index or 1, db)
    return step_res

@router.post("/load", status_code=status.HTTP_201_CREATED)
def load_demo(db: Session = Depends(get_db)):
    """Seeds rich border surveillance demonstration data across all modules."""
    return seed_demo_data(db)

@router.post("/clean")
def clean_demo(db: Session = Depends(get_db)):
    """Purges all operational demo data back to clean 0-row state."""
    return purge_demo_data(db)

@router.post("/simulate-threat")
def simulate_threat(db: Session = Depends(get_db)):
    """Injects an immediate live high-priority border intruder event with sound and alert."""
    return simulate_live_threat(db)

