"""
Access Event Telemetry Service.
Pure business logic - raises domain exceptions, no try-except.
"""

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import NotFoundError
from app.api.modules.v1.access_events.models.access_event import AccessEvent
from app.api.modules.v1.access_events.schemas.access_event_schemas import AccessEventStatsResponse


class AccessEventService:
    """Service providing query and aggregation operations for access events."""

    @staticmethod
    async def get_access_events(
        db: AsyncSession,
        limit: int = 50,
        offset: int = 0,
        is_off_hours: bool | None = None,
        supplier_id: str | None = None,
        user_id: str | None = None,
    ) -> list[AccessEvent]:
        """
        Retrieve access events with optional filters for off-hours, supplier, and user.
        """
        stmt = select(AccessEvent).order_by(AccessEvent.event_time.desc())

        if is_off_hours is not None:
            stmt = stmt.where(AccessEvent.flagged == is_off_hours)
        if supplier_id:
            stmt = stmt.where(AccessEvent.supplier_id == supplier_id)
        if user_id:
            stmt = stmt.where(AccessEvent.user_id == user_id)

        stmt = stmt.limit(limit).offset(offset)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_access_event_by_id(db: AsyncSession, event_id: str) -> AccessEvent:
        """
        Retrieve a single access event by ID.
        """
        event = await db.get(AccessEvent, event_id)
        if not event:
            raise NotFoundError(f"Access event '{event_id}' was not found.")
        return event

    @staticmethod
    async def get_access_event_stats(db: AsyncSession) -> AccessEventStatsResponse:
        """
        Compute summary telemetry statistics for zero-trust monitoring.
        """
        total_stmt = select(func.count(AccessEvent.event_id))
        total_events = (await db.execute(total_stmt)).scalar() or 0

        off_hours_stmt = select(func.count(AccessEvent.event_id)).where(
            AccessEvent.flagged.is_(True)
        )
        off_hours_events = (await db.execute(off_hours_stmt)).scalar() or 0

        users_stmt = select(func.count(func.distinct(AccessEvent.user_id)))
        unique_users = (await db.execute(users_stmt)).scalar() or 0

        systems_stmt = select(func.count(func.distinct(AccessEvent.system)))
        unique_systems = (await db.execute(systems_stmt)).scalar() or 0

        return AccessEventStatsResponse(
            total_events=total_events,
            off_hours_events=off_hours_events,
            unique_users=unique_users,
            unique_systems=unique_systems,
        )
