"""
Material-cost case HTTP gateway. HTTP transport only: parse input, call the service, respond.

Opening or linking a case needs an analytics-execution role (admin or reviewer). Reading the
context of a case follows the existing case read roles. Everything after the case exists uses
the ordinary case endpoints (`/cases/...`) unchanged.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.core.dependencies import (
    AnalyticsExecutionUser,
    DbSession,
    ManufacturingViewUser,
    require_roles,
)
from app.api.core.permissions import CASE_READ_ROLES
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.manufacturing.schemas.material_case_schemas import OpenMaterialCaseRequest
from app.api.modules.v1.manufacturing.service import material_case_service as material_cases
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/manufacturing/material-cases", tags=["Manufacturing Cases"])


@router.post("", response_model=None)
async def open_material_case(
    body: OpenMaterialCaseRequest, user: AnalyticsExecutionUser, db: DbSession
):
    """Open a case from a High or Critical stored score, or link the score to an open case."""
    data = await material_cases.open_case(db, user, body.score_id, body.link_case_id, body.note)
    created = data["mode"] == "created"
    return success_response(
        status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        "Case opened" if created else "Risk score linked to the case",
        data,
    )


@router.get("/for-material/{material_id}", response_model=None)
async def material_cases_list(material_id: str, _user: ManufacturingViewUser, db: DbSession):
    """The cases opened for a material, newest first."""
    data = await material_cases.cases_for_material(db, material_id)
    return success_response(status.HTTP_200_OK, "Material cases", data)


@router.get("/{case_id}/context", response_model=None)
async def material_case_context(
    case_id: str,
    _user: Annotated[User, Depends(require_roles(CASE_READ_ROLES))],
    db: DbSession,
):
    """What was known when the case was opened, whether it reproduces, and the score now."""
    data = await material_cases.case_context(db, case_id)
    return success_response(status.HTTP_200_OK, "Material case context", data)
