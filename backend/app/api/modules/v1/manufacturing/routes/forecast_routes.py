"""
Forecasting HTTP gateway. HTTP transport only: parse input, call the service, respond.

Reading stored forecasts is open to the roles that can see the Manufacturing section; running
a forecast (which stores a new run) needs an analytics-execution role (admin or reviewer).
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.core.dependencies import (
    AnalyticsExecutionUser,
    DbSession,
    ManufacturingViewUser,
)
from app.api.modules.v1.manufacturing.service import forecast_service as forecasts
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/manufacturing/forecasting", tags=["Manufacturing Forecasting"])

AsOf = Annotated[date | None, Query(description="Use data up to this date")]
Dataset = Annotated[str | None, Query(max_length=100)]


@router.get("/materials", response_model=None)
async def forecastable_materials(
    _user: ManufacturingViewUser, db: DbSession, as_of: AsOf = None, dataset_id: Dataset = None
):
    """Materials with purchase history and the horizons their history supports."""
    data = await forecasts.list_forecastable_materials(db, as_of, dataset_id)
    return success_response(status.HTTP_200_OK, "Forecastable materials", data)


@router.get("/materials/{material_id}", response_model=None)
async def material_forecasts(
    material_id: str,
    _user: ManufacturingViewUser,
    db: DbSession,
    as_of: AsOf = None,
    dataset_id: Dataset = None,
):
    """History plus the latest stored forecast per horizon (or why one is withheld)."""
    data = await forecasts.get_forecasts(db, material_id, as_of, dataset_id)
    return success_response(status.HTTP_200_OK, "Material forecasts", data)


@router.post("/materials/{material_id}/run", response_model=None)
async def run_material_forecast(
    material_id: str,
    user: AnalyticsExecutionUser,
    db: DbSession,
    as_of: AsOf = None,
    dataset_id: Dataset = None,
):
    """Run the 30- and 90-day forecasts and store each one produced as a new run."""
    data = await forecasts.run_forecasts(db, user, material_id, as_of, dataset_id)
    return success_response(status.HTTP_201_CREATED, "Forecast run stored", data)


@router.get("/materials/{material_id}/runs", response_model=None)
async def material_runs(
    material_id: str,
    _user: ManufacturingViewUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    dataset_id: Dataset = None,
):
    """Stored runs for the material, newest first (optionally for one dataset)."""
    data = await forecasts.list_runs(db, material_id, limit, dataset_id)
    return success_response(status.HTTP_200_OK, "Forecast runs", {"runs": data})


@router.get("/runs/{run_id}", response_model=None)
async def forecast_run(run_id: str, _user: ManufacturingViewUser, db: DbSession):
    """One stored run with its model metadata and candidate comparison."""
    return success_response(status.HTTP_200_OK, "Forecast run", await forecasts.get_run(db, run_id))
