from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.vehicle_watchlist import VehicleWatchlist
from app.models.audit_log import SecurityAuditLog
from app.schemas.anpr import VehicleWatchlistCreate, VehicleWatchlistUpdate, VehicleWatchlistResponse
from app.services.anpr.ocr_engine import normalize_plate_number

router = APIRouter()

@router.get("", response_model=List[VehicleWatchlistResponse])
@router.get("/", response_model=List[VehicleWatchlistResponse])
def list_vehicles(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List registered vehicles in the vehicle database / watchlist.
    """
    query = db.query(VehicleWatchlist)
    if status:
        query = query.filter(VehicleWatchlist.status == status)
    if category:
        query = query.filter(VehicleWatchlist.watchlist_category == category)
    if search:
        s = search.strip().upper()
        query = query.filter(
            (VehicleWatchlist.plate_number.ilike(f"%{s}%")) |
            (VehicleWatchlist.normalized_plate_number.ilike(f"%{s}%")) |
            (VehicleWatchlist.owner_name.ilike(f"%{search}%"))
        )

    return query.order_by(VehicleWatchlist.updated_at.desc()).all()

@router.post("", response_model=VehicleWatchlistResponse, status_code=201)
@router.post("/", response_model=VehicleWatchlistResponse, status_code=201)
def create_vehicle_entry(
    data: VehicleWatchlistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Register a new vehicle to the Authorized / Watchlist / Monitor database.
    """
    norm = normalize_plate_number(data.plate_number)
    if not norm or len(norm) < 3:
        raise HTTPException(status_code=400, detail="Invalid license plate format.")

    existing = db.query(VehicleWatchlist).filter(
        VehicleWatchlist.normalized_plate_number == norm
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail=f"Vehicle with plate '{norm}' is already registered.")

    vehicle = VehicleWatchlist(
        plate_number=data.plate_number.strip().upper(),
        normalized_plate_number=norm,
        vehicle_type=data.vehicle_type,
        owner_name=data.owner_name,
        status=data.status,
        watchlist_category=data.watchlist_category,
        notes=data.notes,
        created_by=current_user.username
    )
    db.add(vehicle)

    # Audit Log
    audit = SecurityAuditLog(
        username=current_user.username,
        action="VEHICLE_WATCHLIST_CREATED",
        resource_type="VEHICLE",
        resource_id=norm,
        details=f'{{"plate": "{norm}", "status": "{data.status}", "category": "{data.watchlist_category}"}}'
    )
    db.add(audit)
    db.commit()
    db.refresh(vehicle)

    return vehicle

@router.get("/{vehicle_id}", response_model=VehicleWatchlistResponse)
def get_vehicle_entry(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get vehicle details.
    """
    vehicle = db.query(VehicleWatchlist).filter(VehicleWatchlist.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    return vehicle

@router.put("/{vehicle_id}", response_model=VehicleWatchlistResponse)
def update_vehicle_entry(
    vehicle_id: int,
    data: VehicleWatchlistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update vehicle status, category, or notes.
    """
    vehicle = db.query(VehicleWatchlist).filter(VehicleWatchlist.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")

    if data.plate_number:
        norm = normalize_plate_number(data.plate_number)
        vehicle.plate_number = data.plate_number.strip().upper()
        vehicle.normalized_plate_number = norm
    if data.vehicle_type is not None:
        vehicle.vehicle_type = data.vehicle_type
    if data.owner_name is not None:
        vehicle.owner_name = data.owner_name
    if data.status is not None:
        vehicle.status = data.status
    if data.watchlist_category is not None:
        vehicle.watchlist_category = data.watchlist_category
    if data.notes is not None:
        vehicle.notes = data.notes

    vehicle.updated_at = datetime.utcnow()

    # Audit Log
    audit = SecurityAuditLog(
        username=current_user.username,
        action="VEHICLE_WATCHLIST_UPDATED",
        resource_type="VEHICLE",
        resource_id=vehicle.normalized_plate_number,
        details=f'{{"plate": "{vehicle.normalized_plate_number}", "status": "{vehicle.status}"}}'
    )
    db.add(audit)
    db.commit()
    db.refresh(vehicle)

    return vehicle

@router.delete("/{vehicle_id}")
def delete_vehicle_entry(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove vehicle from database registry.
    """
    vehicle = db.query(VehicleWatchlist).filter(VehicleWatchlist.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")

    plate = vehicle.normalized_plate_number
    db.delete(vehicle)

    audit = SecurityAuditLog(
        username=current_user.username,
        action="VEHICLE_WATCHLIST_DELETED",
        resource_type="VEHICLE",
        resource_id=plate,
        details=f'{{"plate": "{plate}"}}'
    )
    db.add(audit)
    db.commit()

    return {"status": "DELETED", "plate_number": plate}
