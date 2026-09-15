"""Remediation Replay Route Handlers.

HTTP gateway only — parses input, calls service, returns standardized responses.
Max 50 lines per handler. No business logic. No try-except.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.dependencies import get_current_user
from app.api.db.database import get_db
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.remediation.schemas.remediation_schemas import (
    ProposedControlCreate,
    ReplayRequest,
)
from app.api.modules.v1.remediation.service.remediation_service import (
    RemediationService,
)
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/remediation", tags=["Remediation Replay"])


@router.get(
    "/controls",
    summary="List proposed controls",
    description="Retrieves all proposed corrective controls available for replay simulation.",
)
async def list_proposed_controls(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    """Lists all configured proposed controls."""
    controls = await RemediationService.list_proposed_controls(session=db)
    return success_response(
        status_code=http_status.HTTP_200_OK,
        message="Proposed controls retrieved successfully",
        data=[c.model_dump() for c in controls],
    )


@router.post(
    "/controls",
    summary="Create proposed control",
    description=(
        "Creates a new proposed control definition stored separately from active RuleConfig."
    ),
)
async def create_proposed_control(
    payload: ProposedControlCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    """Registers a new proposed corrective control."""
    control = await RemediationService.create_proposed_control(
        control_in=payload,
        session=db,
        user_id=current_user.user_id,
    )
    return success_response(
        status_code=http_status.HTTP_201_CREATED,
        message="Proposed control created successfully",
        data=control.model_dump(),
    )


@router.get(
    "/controls/{control_id}",
    summary="Get proposed control by ID",
    description="Retrieves a specific proposed control configuration.",
)
async def get_proposed_control(
    control_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    """Retrieves a single proposed control by identifier."""
    control = await RemediationService.get_proposed_control(control_id=control_id, session=db)
    return success_response(
        status_code=http_status.HTTP_200_OK,
        message="Proposed control retrieved successfully",
        data=control.model_dump(),
    )


@router.post(
    "/replay",
    summary="Run remediation replay simulation",
    description=(
        "Evaluates a proposed corrective control against the reconstructed historical event "
        "state of a transaction at an event timestamp without mutating original records."
    ),
)
async def run_remediation_replay(
    payload: ReplayRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    """Executes a replay evaluation against historical reconstructed state."""
    result = await RemediationService.replay(
        transaction_id=payload.transaction_id,
        session=db,
        event_timestamp=payload.event_timestamp,
        control_id=payload.control_id,
        case_id=payload.case_id,
        executed_by=current_user.username,
        persist=payload.persist,
    )
    return success_response(
        status_code=http_status.HTTP_200_OK,
        message=f"Remediation replay complete. Determination: {result.replay_determination}",
        data=result.model_dump(),
    )


@router.get(
    "/replays",
    summary="List past replay simulation results",
    description="Retrieves historical replay results with optional transaction and case filtering.",
)
async def list_replay_results(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    transaction_id: str | None = Query(default=None, description="Filter by transaction ID"),
    case_id: str | None = Query(default=None, description="Filter by case ID"),
) -> JSONResponse:
    """Lists past replay results matching query parameters."""
    replays = await RemediationService.list_replays(
        session=db,
        transaction_id=transaction_id,
        case_id=case_id,
    )
    return success_response(
        status_code=http_status.HTTP_200_OK,
        message="Replay simulation results retrieved successfully",
        data=[r.model_dump() for r in replays],
    )


@router.get(
    "/replays/{replay_id}",
    summary="Get replay simulation result by ID",
    description="Retrieves the detailed outcome and payload of a specific replay simulation.",
)
async def get_replay_result(
    replay_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    """Retrieves a single past replay result."""
    replay = await RemediationService.get_replay(replay_id=replay_id, session=db)
    return success_response(
        status_code=http_status.HTTP_200_OK,
        message="Replay result retrieved successfully",
        data=replay.model_dump(),
    )
