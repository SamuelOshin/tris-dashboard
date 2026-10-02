"""
Financial exposure HTTP gateway. HTTP transport only: parse input, call the service, respond.

Both endpoints only read. A scenario is calculated and returned, never stored, so they are open
to every role that can see the Manufacturing section.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.core.dependencies import DbSession, ManufacturingViewUser
from app.api.modules.v1.manufacturing.schemas.exposure_schemas import ScenarioRequest
from app.api.modules.v1.manufacturing.service import exposure_service as exposure
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/manufacturing/exposure", tags=["Manufacturing Exposure"])

AsOf = Annotated[date | None, Query(description="Use data up to this date")]
Dataset = Annotated[str | None, Query(max_length=100)]
Material = Annotated[str | None, Query(max_length=50)]


@router.get("", response_model=None)
async def financial_exposure(
    _user: ManufacturingViewUser,
    db: DbSession,
    horizon_days: Annotated[int, Query()] = 30,
    as_of: AsOf = None,
    dataset_id: Dataset = None,
    material_id: Material = None,
):
    """Exposure from the stored forecasts, rolled up by supplier, product and category."""
    data = await exposure.calculate_exposure(db, horizon_days, as_of, dataset_id, material_id)
    return success_response(status.HTTP_200_OK, "Financial exposure", data)


@router.post("/scenario", response_model=None)
async def scenario_exposure(
    body: ScenarioRequest,
    _user: ManufacturingViewUser,
    db: DbSession,
    as_of: AsOf = None,
    dataset_id: Dataset = None,
):
    """Recalculate exposure under a what-if scenario. Nothing is stored or changed."""
    data = await exposure.calculate_exposure(
        db, body.horizon_days, as_of, dataset_id, body.material_id, body.scenario.to_scenario()
    )
    return success_response(status.HTTP_200_OK, "Scenario exposure", data)
