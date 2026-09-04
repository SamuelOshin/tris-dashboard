"""
Access Events HTTP Gateway Routes.
HTTP transport only - max 50 lines per handler, no business logic, no try-except.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.dependencies import get_current_user
from app.api.db.database import get_db
from app.api.modules.v1.access_events.schemas.access_event_schemas import (
    AccessEventResponse,
)
from app.api.modules.v1.access_events.service.access_event_service import AccessEventService
from app.api.modules.v1.auth.models.user import User
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/access-events", tags=["Zero-Trust Access Events"])


@router.get("", response_model=None)
async def list_access_events(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    is_off_hours: bool | None = Query(default=None),
    supplier_id: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
):
    """List security access event telemetry logs."""
    events = await AccessEventService.get_access_events(
        db=db,
        limit=limit,
        offset=offset,
        is_off_hours=is_off_hours,
        supplier_id=supplier_id,
        user_id=user_id,
    )
    data = [
        AccessEventResponse.model_validate(e, from_attributes=True).model_dump() for e in events
    ]
    return success_response(
        status_code=status.HTTP_200_OK,
        message=f"Retrieved {len(data)} access events",
        data=data,
    )


@router.get("/stats", response_model=None)
async def get_access_event_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get zero-trust access event summary statistics."""
    stats = await AccessEventService.get_access_event_stats(db=db)
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Access event telemetry stats retrieved",
        data=stats.model_dump(),
    )


@router.get("/{event_id}", response_model=None)
async def get_access_event(
    event_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieve single access event details by ID."""
    event = await AccessEventService.get_access_event_by_id(db=db, event_id=event_id)
    data = AccessEventResponse.model_validate(event, from_attributes=True).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Access event retrieved",
        data=data,
    )
