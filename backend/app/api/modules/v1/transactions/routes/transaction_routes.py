"""
Transaction HTTP Gateway Routes.
HTTP transport only — max 50 lines per handler, no business logic, no try-except.
"""

from typing import Optional

from fastapi import APIRouter, Query, status

from app.api.core.dependencies import AuthenticatedUser, DbSession
from app.api.modules.v1.transactions.schemas.transaction_schemas import TransactionResponse
from app.api.modules.v1.transactions.service.transaction_service import TransactionService
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("", response_model=None)
async def list_transactions(
    supplier_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: AuthenticatedUser = None,
    db: DbSession = None,
):
    """
    Retrieve paginated transactions with optional supplier filtering.
    Requires authenticated session.
    """
    txs = await TransactionService.get_all_transactions(
        session=db,
        supplier_id=supplier_id,
        skip=skip,
        limit=limit,
    )
    data = [TransactionResponse.model_validate(t).model_dump() for t in txs]
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Transactions retrieved successfully",
        data=data,
    )


@router.get("/{transaction_id}", response_model=None)
async def get_transaction(
    transaction_id: str,
    current_user: AuthenticatedUser = None,
    db: DbSession = None,
):
    """Retrieve single transaction by ID. Requires authenticated session."""
    tx = await TransactionService.get_transaction_by_id(
        transaction_id=transaction_id,
        session=db,
    )
    data = TransactionResponse.model_validate(tx).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Transaction retrieved successfully",
        data=data,
    )
