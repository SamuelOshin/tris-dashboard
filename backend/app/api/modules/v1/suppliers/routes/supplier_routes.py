"""
Supplier HTTP Gateway Routes.
HTTP transport only — max 50 lines per handler, no business logic, no try-except.
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.db.database import get_db
from app.api.modules.v1.suppliers.schemas.supplier_schemas import (
    BaselineStatsResponse,
    SupplierResponse,
)
from app.api.modules.v1.suppliers.service.baseline_service import BaselineService
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("", response_model=None)
async def list_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Retrieve list of suppliers."""
    suppliers = await BaselineService.get_all_suppliers(session=db, skip=skip, limit=limit)
    data = [SupplierResponse.model_validate(s).model_dump() for s in suppliers]
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Suppliers retrieved successfully",
        data=data,
    )


@router.get("/{supplier_id}", response_model=None)
async def get_supplier(
    supplier_id: str,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Retrieve a single supplier by unique ID."""
    supplier = await BaselineService.get_supplier_by_id(supplier_id=supplier_id, session=db)
    data = SupplierResponse.model_validate(supplier).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Supplier details retrieved successfully",
        data=data,
    )


@router.get("/{supplier_id}/baseline", response_model=None)
async def get_supplier_baseline(
    supplier_id: str,
    exclude_tx: Optional[str] = Query(None, description="Transaction ID to exclude from baseline"),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Compute mathematical descriptive baseline with strict transaction exclusion."""
    baseline = await BaselineService.calculate_baseline(
        supplier_id=supplier_id,
        session=db,
        exclude_transaction_id=exclude_tx,
    )
    data = BaselineStatsResponse.model_validate(baseline).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Supplier baseline statistics calculated successfully",
        data=data,
    )
