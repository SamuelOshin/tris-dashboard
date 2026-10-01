"""
Material-cost analytics HTTP gateway. HTTP transport only: parse input, call the service,
respond. Viewing is open to the roles that can see the Manufacturing section.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.core.dependencies import DbSession, ManufacturingViewUser
from app.api.modules.v1.manufacturing.service import analytics_service as analytics
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/manufacturing/analytics", tags=["Manufacturing Analytics"])

AsOf = Annotated[date | None, Query(description="Analyse data up to this date")]
Dataset = Annotated[str | None, Query(max_length=100)]


@router.get("/overview", response_model=None)
async def material_cost_overview(
    _user: ManufacturingViewUser,
    db: DbSession,
    as_of: AsOf = None,
    category: Annotated[str | None, Query(max_length=100)] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    supplier_id: Annotated[str | None, Query(max_length=50)] = None,
    product_sku: Annotated[str | None, Query(max_length=50)] = None,
    signal: Annotated[str | None, Query(max_length=50)] = None,
    dataset_id: Dataset = None,
):
    """Every material with its detection signals, computed from stored data."""
    data = await analytics.get_overview(
        db, as_of, category, search, supplier_id, product_sku, signal, dataset_id
    )
    return success_response(status.HTTP_200_OK, "Material cost overview", data)


@router.get("/materials/{material_id}", response_model=None)
async def material_detail(
    material_id: str,
    _user: ManufacturingViewUser,
    db: DbSession,
    as_of: AsOf = None,
    dataset_id: Dataset = None,
):
    """Full detection evidence for one material."""
    data = await analytics.get_material_detail(db, material_id, as_of, dataset_id)
    return success_response(status.HTTP_200_OK, "Material detail", data)
