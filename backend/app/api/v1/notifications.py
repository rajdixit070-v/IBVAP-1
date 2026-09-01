from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse

router = APIRouter()

@router.get("/", response_model=List[NotificationResponse])
def list_notifications(
    unread_only: Optional[bool] = Query(None),
    is_read: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    List SOC in-app notifications.
    """
    query = db.query(Notification)
    if unread_only is True or is_read is False:
        query = query.filter(Notification.read == False)
    elif is_read is True or unread_only is False:
        query = query.filter(Notification.read == True)
    return query.order_by(Notification.created_at.desc()).limit(limit).all()

@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
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
@router.post("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Mark all unread notifications as read.
    """
    db.query(Notification).filter(Notification.read == False).update({"read": True})
    db.commit()
    return {"status": "SUCCESS", "message": "All notifications marked as read."}

@router.delete("/clear-all")
@router.post("/clear-all")
@router.delete("/")
def clear_all_notifications(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Deletes all notifications from the SOC notification feed.
    """
    deleted_count = db.query(Notification).delete()
    db.commit()
    return {"status": "SUCCESS", "message": f"All {deleted_count} notifications deleted."}

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Deletes a single notification.
    """
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if n:
        db.delete(n)
        db.commit()
        return {"status": "SUCCESS", "message": f"Notification {notification_id} deleted."}
    return {"status": "NOT_FOUND", "message": "Notification not found."}
