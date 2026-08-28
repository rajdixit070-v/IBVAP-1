from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse

router = APIRouter()

@router.get("/", response_model=List[NotificationResponse])
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    List SOC in-app notifications.
    """
    query = db.query(Notification)
    if unread_only:
        query = query.filter(Notification.read == False)
    return query.order_by(Notification.created_at.desc()).limit(limit).all()

@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    """
    Mark a notification as read.
    """
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if n:
        n.read = True
        db.commit()
        db.refresh(n)
    return n

@router.put("/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db)):
    """
    Mark all unread notifications as read.
    """
    db.query(Notification).filter(Notification.read == False).update({"read": True})
    db.commit()
    return {"status": "SUCCESS", "message": "All notifications marked as read."}
