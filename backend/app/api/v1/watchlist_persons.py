import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.person_watchlist import PersonWatchlist
from app.models.audit_log import SecurityAuditLog
from app.schemas.face import PersonWatchlistCreate, PersonWatchlistUpdate, PersonWatchlistResponse
from app.services.face.embedding_engine import validate_embedding

router = APIRouter()

@router.get("/", response_model=List[PersonWatchlistResponse])
def list_watchlist_persons(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
def create_watchlist_person(
    data: PersonWatchlistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Register a new person to the Authorized Personnel or Watchlist registry.
    Embedding vector is optional — records can be created manually and biometric
    embeddings added later via face recognition verification events.
    """
    pid = data.person_id.strip().upper()
    existing = db.query(PersonWatchlist).filter(PersonWatchlist.person_id == pid).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Person ID '{pid}' is already registered.")

    # Biometric embedding handling: If embedding is provided, validate it; otherwise auto-generate normalized 128-d reference vector
    if data.embedding is not None and len(data.embedding) > 0:
        is_valid, error_msg = validate_embedding(data.embedding, expected_dim=128)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg or "A valid 128-dimensional biometric embedding vector must be provided."
            )
        embedding_vec = data.embedding
    else:
        import math
        val = float(1.0 / math.sqrt(128))
        embedding_vec = [val] * 128

    person = PersonWatchlist(
        person_id=pid,
        display_name=data.display_name.strip(),
        category=data.category,
        status=data.status,
        embedding_json=json.dumps(embedding_vec),
        photo_ref=data.photo_ref,
        notes=data.notes,
        created_by=current_user.username
    )
    db.add(person)

    audit = SecurityAuditLog(
        username=current_user.username,
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
def get_watchlist_person(
    person_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get identity record details.
    """
    person = db.query(PersonWatchlist).filter(PersonWatchlist.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")
    return person

@router.put("/{person_id}", response_model=PersonWatchlistResponse)
def update_watchlist_person(
    person_id: int,
    data: PersonWatchlistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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
    if data.embedding is not None:
        is_valid, error_msg = validate_embedding(data.embedding, expected_dim=128)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg or "Embedding must be a valid 128-dimensional vector.")
        person.embedding_json = json.dumps(data.embedding)

    person.updated_at = datetime.utcnow()

    audit = SecurityAuditLog(
        username=current_user.username,
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
def delete_watchlist_person(
    person_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete identity from registry.
    """
    person = db.query(PersonWatchlist).filter(PersonWatchlist.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found.")

    pid = person.person_id
    db.delete(person)

    audit = SecurityAuditLog(
        username=current_user.username,
        action="PERSON_WATCHLIST_DELETED",
        resource_type="PERSON",
        resource_id=pid,
        details=f'{{"person_id": "{pid}"}}'
    )
    db.add(audit)
    db.commit()

    return {"status": "DELETED", "person_id": pid}
