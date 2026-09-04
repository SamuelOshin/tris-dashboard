"""
Notification Service.
Pure business logic - raises domain exceptions, no try-except.
"""

from datetime import UTC, datetime

from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import NotFoundError
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.notifications.models.notification import Notification, generate_notif_id
from app.api.modules.v1.notifications.schemas.notification_schemas import (
    UnreadCountResponse,
)


class NotificationService:
    """Service handling notification creation, filtering, and read-state management."""

    @staticmethod
    def _build_user_recipient_condition(user: User):
        """Build condition to match notifications for user, user's role, or global broadcast."""
        return or_(
            Notification.recipient_user_id == user.user_id,
            Notification.recipient_role == user.role,
            Notification.recipient_user_id.is_(None) & Notification.recipient_role.is_(None),
        )

    @classmethod
    async def get_user_notifications(
        cls,
        db: AsyncSession,
        user: User,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
        category: str | None = None,
        severity: str | None = None,
    ) -> list[Notification]:
        """Query notifications accessible to the authenticated user."""
        stmt = (
            select(Notification)
            .where(cls._build_user_recipient_condition(user))
            .order_by(Notification.created_at.desc())
        )

        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))
        if category:
            stmt = stmt.where(Notification.category == category)
        if severity:
            stmt = stmt.where(Notification.severity == severity)

        stmt = stmt.limit(limit).offset(offset)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_unread_count(cls, db: AsyncSession, user: User) -> UnreadCountResponse:
        """Count unread notifications accessible to the user."""
        stmt = (
            select(func.count(Notification.notification_id))
            .where(cls._build_user_recipient_condition(user))
            .where(Notification.is_read.is_(False))
        )
        count = (await db.execute(stmt)).scalar() or 0
        return UnreadCountResponse(unread_count=count)

    @classmethod
    async def mark_as_read(cls, db: AsyncSession, user: User, notification_id: str) -> Notification:
        """Mark a single notification as read."""
        stmt = (
            select(Notification)
            .where(Notification.notification_id == notification_id)
            .where(cls._build_user_recipient_condition(user))
        )
        notif = (await db.execute(stmt)).scalar_one_or_none()
        if not notif:
            raise NotFoundError(f"Notification '{notification_id}' not found.")

        if not notif.is_read:
            notif.is_read = True
            notif.read_at = datetime.now(UTC)
            db.add(notif)
            await db.flush()
        return notif

    @classmethod
    async def mark_all_as_read(cls, db: AsyncSession, user: User) -> int:
        """Mark all unread notifications for user as read."""
        stmt = (
            select(Notification)
            .where(cls._build_user_recipient_condition(user))
            .where(Notification.is_read.is_(False))
        )
        unread_notifs = (await db.execute(stmt)).scalars().all()
        now = datetime.now(UTC)
        for n in unread_notifs:
            n.is_read = True
            n.read_at = now
            db.add(n)
        if unread_notifs:
            await db.flush()
        return len(unread_notifs)

    @staticmethod
    async def emit(
        db: AsyncSession,
        title: str,
        message: str,
        category: str = "SYSTEM",
        severity: str = "INFO",
        recipient_user_id: str | None = None,
        recipient_role: str | None = None,
        link_url: str | None = None,
        metadata_json: dict | None = None,
    ) -> Notification:
        """Emit and persist a new notification record."""
        notif = Notification(
            notification_id=generate_notif_id(),
            title=title,
            message=message,
            category=category,
            severity=severity,
            recipient_user_id=recipient_user_id,
            recipient_role=recipient_role,
            link_url=link_url,
            metadata_json=metadata_json,
            is_read=False,
            created_at=datetime.now(UTC),
        )
        db.add(notif)
        await db.flush()
        return notif
