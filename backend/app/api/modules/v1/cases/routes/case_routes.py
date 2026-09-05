"""
Case Lifecycle HTTP Gateway Routes.
HTTP transport only — max 50 lines per handler, no business logic, no try-except.
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status

from app.api.core.dependencies import DbSession, require_roles
from app.api.core.permissions import CASE_READ_ROLES, CASE_TRANSITION_ROLES
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.cases.schemas.case_schemas import (
    CaseResponse,
    CaseTransitionRequest,
)
from app.api.modules.v1.cases.service.case_service import CaseService
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.get("", response_model=None)
async def list_cases(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    supplier_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: Annotated[User, Depends(require_roles(CASE_READ_ROLES))] = None,
    db: DbSession = None,
):
    """Retrieve filtered list of risk cases. Requires authenticated session."""
    cases = await CaseService.get_all_cases(
        session=db,
        status=status_filter,
        priority=priority_filter,
        supplier_id=supplier_id,
        skip=skip,
        limit=limit,
    )
    data = [CaseResponse.model_validate(c).model_dump() for c in cases]
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Cases retrieved successfully",
        data=data,
    )


@router.get("/{case_id}", response_model=None)
async def get_case(
    case_id: str,
    current_user: Annotated[User, Depends(require_roles(CASE_READ_ROLES))] = None,
    db: DbSession = None,
):
    """Retrieve case with chronological immutable audit history. Requires authenticated session."""
    case_data = await CaseService.get_case_by_id(case_id=case_id, session=db)
    data = CaseResponse.model_validate(case_data).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Case details retrieved successfully",
        data=data,
    )


@router.post("/{case_id}/transition", response_model=None)
async def transition_case(
    case_id: str,
    payload: CaseTransitionRequest,
    current_user: Annotated[User, Depends(require_roles(CASE_TRANSITION_ROLES))],
    db: DbSession = None,
):
    """Execute governed case state transition with verified closure validation."""
    payload.actor = current_user.name or current_user.username

    updated = await CaseService.transition_case(
        case_id=case_id,
        transition=payload,
        session=db,
    )
    data = CaseResponse.model_validate(updated).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message=f"Case transitioned to '{payload.to_status}' successfully",
        data=data,
    )
