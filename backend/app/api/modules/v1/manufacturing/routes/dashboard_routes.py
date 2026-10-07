"""
Dashboard HTTP gateway. HTTP transport only: parse input, call the service, respond.

Both endpoints only read stored results, so they are open to every role that can see the
Manufacturing section.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.core.dependencies import DbSession, ManufacturingViewUser
from app.api.modules.v1.manufacturing.service import dashboard_service as dashboard
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/manufacturing/dashboard", tags=["Manufacturing Dashboard"])

AsOf = Annotated[date | None, Query(description="Use data up to this date")]
Dataset = Annotated[str | None, Query(max_length=100)]


@router.get("/summary", response_model=None)
async def dashboard_summary(
    _user: ManufacturingViewUser, db: DbSession, as_of: AsOf = None, dataset_id: Dataset = None
):
    """Headline figures, risk trend and top exposures for the main dashboard."""
    data = await dashboard.summary(db, as_of, dataset_id)
    return success_response(status.HTTP_200_OK, "Manufacturing summary", data)


@router.get("/material-results", response_model=None)
async def material_results(
    _user: ManufacturingViewUser, db: DbSession, as_of: AsOf = None, dataset_id: Dataset = None
):
    """Stored score, forecasts, exposure and open case for every material."""
    data = await dashboard.material_results(db, as_of, dataset_id)
    return success_response(status.HTTP_200_OK, "Stored results by material", data)
