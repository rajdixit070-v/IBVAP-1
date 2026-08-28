import json
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.person_watchlist import PersonWatchlist
from app.models.audit_log import SecurityAuditLog
from app.schemas.face import PersonWatchlistCreate, PersonWatchlistUpdate, PersonWatchlistResponse

router = APIRouter()

@router.get("/", response_model=List[PersonWatchlistResponse])
def list_watchlist_persons(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    List registered identities in the Authorized / Watchlist database.
    Note: Raw biometric embedding vectors are automatically omitted from output for privacy.
    """
    query = db.query(PersonWatchlist)
    if category:
        query = query.filter(PersonWatchlist.category == category)
    if status:
        query = query.filter(PersonWatchlist.status == status)
    if search:
        query = query.filter(
            (PersonWatchlist.display_name.ilike(f"%{search}%")) |
            (PersonWatchlist.person_id.ilike(f"%{search}%"))
        )

    return query.order_by(PersonWatchlist.updated_at.desc()).all()

@router.post("/", response_model=PersonWatchlistResponse, status_code=201)
def create_watchlist_person(data: PersonWatchlistCreate, db: Session = Depends(get_db)):
    """
    Register a new person to the Authorized Personnel or Watchlist registry.
    """
    pid = data.person_id.strip().upper()
    existing = db.query(PersonWatchlist).filter(PersonWatchlist.person_id == pid).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Person ID '{pid}' is already registered.")

    # If embedding vector not provided, generate standardized dummy unit vector for registration
    if data.embedding and len(data.embedding) == 128:
        embedding_vec = data.embedding
    else:
        # Generate normalized unit vector
        dummy = np.random.uniform(-0.1, 0.1, 128)
        norm = np.linalg.norm(dummy)
        embedding_vec = (dummy / norm).tolist()

    person = PersonWatchlist(
        person_id=pid,
        display_name=data.display_name.strip(),
        category=data.category,
        status=data.status,
        embedding_json=json.dumps(embedding_vec),
        photo_ref=data.photo_ref,
        notes=data.notes,
        created_by="operator"
    )
    db.add(person)

    audit = SecurityAuditLog(
        username="operator",
        action="PERSON_WATCHLIST_CREATED",
        resource_type="PERSON",
        resource_id=pid,
        details=f'{{"person_id": "{pid}", "name": "{data.display_name}", "category": "{data.category}"}}'
    )
    db.add(audit)
    db.commit()
    db.refresh(person)

    return person

@router.get("/{person_id}", response_model=PersonWatchlistResponse)
def get_watchlist_person(person_id: int, db: Session = Depends(get_db)):
    """
    Get identity record details.
    """
    person = db.query(PersonWatchlist).filter(PersonWatchlist.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")
    return person

@router.put("/{person_id}", response_model=PersonWatchlistResponse)
def update_watchlist_person(person_id: int, data: PersonWatchlistUpdate, db: Session = Depends(get_db)):
    """
    Update identity details, status, or category.
    """
    person = db.query(PersonWatchlist).filter(PersonWatchlist.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")

    if data.display_name is not None:
        person.display_name = data.display_name.strip()
    if data.category is not None:
        person.category = data.category
    if data.status is not None:
        person.status = data.status
    if data.notes is not None:
        person.notes = data.notes
    if data.photo_ref is not None:
        person.photo_ref = data.photo_ref
    if data.embedding and len(data.embedding) == 128:
        person.embedding_json = json.dumps(data.embedding)

    person.updated_at = datetime.utcnow()

    audit = SecurityAuditLog(
        username="operator",
        action="PERSON_WATCHLIST_UPDATED",
        resource_type="PERSON",
        resource_id=person.person_id,
        details=f'{{"person_id": "{person.person_id}", "status": "{person.status}"}}'
    )
    db.add(audit)
    db.commit()
    db.refresh(person)

    return person

@router.delete("/{person_id}")
def delete_watchlist_person(person_id: int, db: Session = Depends(get_db)):
    """
    Delete identity from registry.
    """
    person = db.query(PersonWatchlist).filter(PersonWatchlist.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")

    pid = person.person_id
    db.delete(person)

    audit = SecurityAuditLog(
        username="operator",
        action="PERSON_WATCHLIST_DELETED",
        resource_type="PERSON",
        resource_id=pid,
        details=f'{{"person_id": "{pid}"}}'
    )
    db.add(audit)
    db.commit()

    return {"status": "DELETED", "person_id": pid}
