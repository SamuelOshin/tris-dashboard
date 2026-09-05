"""
Notification Gateway Routes.
HTTP transport only - max 50 lines per handler, no business logic, no try-except.
"""

from fastapi import APIRouter, Query, status

from app.api.core.dependencies import AuthenticatedUser, DbSession, PrivilegedUser
from app.api.modules.v1.notifications.schemas.notification_schemas import (
    NotificationCreateRequest,
    NotificationResponse,
)
from app.api.modules.v1.notifications.service.notification_service import NotificationService
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=None)
async def list_notifications(
    current_user: AuthenticatedUser,
    db: DbSession,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    unread_only: bool = Query(default=False),
    category: str | None = Query(default=None),
    severity: str | None = Query(default=None),
):
    """Retrieve notifications for the authenticated user."""
    notifs = await NotificationService.get_user_notifications(
        db=db,
        user=current_user,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
        category=category,
        severity=severity,
    )
    data = [
        NotificationResponse.model_validate(n, from_attributes=True).model_dump() for n in notifs
    ]
    return success_response(
        status_code=status.HTTP_200_OK,
        message=f"Retrieved {len(data)} notifications",
        data=data,
    )


@router.get("/unread-count", response_model=None)
async def get_unread_count(
    current_user: AuthenticatedUser,
    db: DbSession,
):
    """Retrieve lightweight count of unread notifications for header badge."""
    count_data = await NotificationService.get_unread_count(db=db, user=current_user)
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Unread notification count retrieved",
        data=count_data.model_dump(),
    )


@router.patch("/{notification_id}/read", response_model=None)
async def mark_notification_read(
    notification_id: str,
    current_user: AuthenticatedUser,
    db: DbSession,
):
    """Mark a specific notification as read."""
    notif = await NotificationService.mark_as_read(
        db=db, user=current_user, notification_id=notification_id
    )
    data = NotificationResponse.model_validate(notif, from_attributes=True).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Notification marked as read",
        data=data,
    )


@router.post("/mark-all-read", response_model=None)
async def mark_all_notifications_read(
    current_user: AuthenticatedUser,
    db: DbSession,
):
    """Mark all unread notifications for current user as read."""
    updated_count = await NotificationService.mark_all_as_read(db=db, user=current_user)
    return success_response(
        status_code=status.HTTP_200_OK,
        message=f"Marked {updated_count} notifications as read",
        data={"updated_count": updated_count},
    )


@router.post("", response_model=None, status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: NotificationCreateRequest,
    current_user: PrivilegedUser,
    db: DbSession,
):
    """Manually emit a notification (internal/admin use)."""
    notif = await NotificationService.emit(
        db=db,
        title=payload.title,
        message=payload.message,
        category=payload.category,
        severity=payload.severity,
        recipient_user_id=payload.recipient_user_id,
        recipient_role=payload.recipient_role,
        link_url=payload.link_url,
        metadata_json=payload.metadata_json,
    )
    data = NotificationResponse.model_validate(notif, from_attributes=True).model_dump()
    return success_response(
        status_code=status.HTTP_201_CREATED,
        message="Notification emitted successfully",
        data=data,
    )
