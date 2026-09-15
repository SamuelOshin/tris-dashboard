"""
Supplier HTTP Gateway Routes.
HTTP transport only — max 50 lines per handler, no business logic, no try-except.
"""

from typing import Optional

from fastapi import APIRouter, Query, status

from app.api.core.dependencies import AuthenticatedUser, DbSession
from app.api.core.permissions import PRIVILEGED_ROLES
from app.api.modules.v1.suppliers.schemas.supplier_schemas import (
    BaselineStatsResponse,
    SupplierResponse,
    SupplierResponseMasked,
)
from app.api.modules.v1.suppliers.service.baseline_service import BaselineService
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


def _serialise_supplier(supplier: object, current_user: object) -> dict:
    """Return full or masked supplier dict based on the requesting user's role."""
    if (
        current_user
        and hasattr(current_user, "role")
        and current_user.role.lower() in [r.value for r in PRIVILEGED_ROLES]
    ):
        return SupplierResponse.model_validate(supplier).model_dump()
    return SupplierResponseMasked.from_supplier(supplier).model_dump()


@router.get("", response_model=None)
async def list_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: AuthenticatedUser = None,
    db: DbSession = None,
):
    """
    Retrieve list of suppliers.
    Sensitive financial fields are masked for non-privileged roles.
    """
    suppliers = await BaselineService.get_all_suppliers(session=db, skip=skip, limit=limit)
    data = [_serialise_supplier(s, current_user) for s in suppliers]
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Suppliers retrieved successfully",
        data=data,
    )


@router.get("/{supplier_id}", response_model=None)
async def get_supplier(
    supplier_id: str,
    current_user: AuthenticatedUser = None,
    db: DbSession = None,
):
    """
    Retrieve a single supplier by unique ID.
    Sensitive financial fields are masked for non-privileged roles.
    """
    supplier = await BaselineService.get_supplier_by_id(supplier_id=supplier_id, session=db)
    data = _serialise_supplier(supplier, current_user)
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Supplier details retrieved successfully",
        data=data,
    )


@router.get("/{supplier_id}/baseline", response_model=None)
async def get_supplier_baseline(
    supplier_id: str,
    exclude_tx: Optional[str] = Query(None, description="Transaction ID to exclude from baseline"),
    current_user: AuthenticatedUser = None,
    db: DbSession = None,
):
    """
    Compute mathematical descriptive baseline with strict transaction exclusion.
    Requires authenticated session.
    """
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
