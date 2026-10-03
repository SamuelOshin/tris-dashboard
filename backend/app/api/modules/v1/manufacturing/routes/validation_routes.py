"""
Retrospective validation HTTP gateway. HTTP transport only: parse input, call the service, respond.

Running validation (which stores a run) needs a validation-run role (admin or reviewer). Reading
runs and cases is open to every role that can see Manufacturing, including read-only reviewers.
"""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.core.custom_exceptions.exceptions import ValidationError
from app.api.core.dependencies import DbSession, ManufacturingViewUser, ValidationRunUser
from app.api.modules.v1.manufacturing.schemas.validation_schemas import RunValidationRequest
from app.api.modules.v1.manufacturing.service import validation_service as validation
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/manufacturing/validation", tags=["Manufacturing Validation"])


@router.post("/runs", response_model=None)
async def run_validation(body: RunValidationRequest, user: ValidationRunUser, db: DbSession):
    """Run the retrospective validation protocol and store the run with all its cases."""
    data = await validation.run_validation(db, user, body.to_config(), body.note)
    return success_response(status.HTTP_201_CREATED, "Validation run stored", data)


@router.get("/runs", response_model=None)
async def list_runs(_user: ManufacturingViewUser, db: DbSession):
    """Every validation run, newest first, including runs that did not finish."""
    return success_response(status.HTTP_200_OK, "Validation runs", await validation.list_runs(db))


@router.get("/runs/{run_id}", response_model=None)
async def get_run(run_id: str, _user: ManufacturingViewUser, db: DbSession):
    """A run with its metrics, limitations and the problems found."""
    return success_response(
        status.HTTP_200_OK, "Validation run", await validation.get_run(db, run_id)
    )


@router.get("/runs/{run_id}/cases", response_model=None)
async def list_cases(
    run_id: str,
    _user: ManufacturingViewUser,
    db: DbSession,
    kind: Annotated[str, Query()] = "all",
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Stored cases of a run with outcomes, optionally only one kind (false alarms, misses)."""
    if kind not in validation.CASE_KINDS:
        raise ValidationError(f"kind must be one of {list(validation.CASE_KINDS)}.")
    data = await validation.list_cases(db, run_id, kind, limit, offset)
    return success_response(status.HTTP_200_OK, "Validation cases", data)
