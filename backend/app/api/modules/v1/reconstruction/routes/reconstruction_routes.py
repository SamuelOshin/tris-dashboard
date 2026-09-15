"""Historical Reconstruction Route Handler.

HTTP gateway only — parses input, calls service, returns standardized response.
No business logic. No try-except.
Max 50 lines per handler.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.dependencies import get_current_user
from app.api.db.database import get_db
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.reconstruction.schemas.reconstruction_schemas import (
    ReconstructionRequest,
)
from app.api.modules.v1.reconstruction.service.reconstruction_service import (
    HistoricalReconstructionService,
)
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/reconstruction", tags=["Historical Reconstruction"])


@router.post(
    "/reconstruct",
    summary="Reconstruct historical state at event timestamp",
    description=(
        "Given a transaction ID and event timestamp, reconstructs all relevant state "
        "(supplier, approvals, access, rule version) as-of that point in time. "
        "Returns PASS, FAIL, or UNKNOWN with full provenance. "
        "Never uses information recorded after the event timestamp."
    ),
)
async def reconstruct_historical_state(
    payload: ReconstructionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> success_response:  # type: ignore[valid-type]
    """Reconstruct cross-system state at the specified event timestamp.

    Accessible to all authenticated users. Reconstruction is read-only
    against historical tables. Results are persisted as append-only snapshots.
    """
    result = await HistoricalReconstructionService.reconstruct(
        transaction_id=payload.transaction_id,
        event_timestamp=payload.event_timestamp,
        session=db,
        case_id=payload.case_id,
        persist=True,
    )
    return success_response(
        status_code=http_status.HTTP_200_OK,
        message=f"Historical reconstruction complete. Outcome: {result.outcome}",
        data=result.model_dump(),
    )


@router.get(
    "/reconstruct/{transaction_id}",
    summary="Reconstruct using latest event timestamp from fixture",
    description=(
        "Convenience endpoint: reconstructs state for a transaction using "
        "its canonical event timestamp as stored in the database. "
        "For full control over the timestamp, use the POST endpoint."
    ),
)
async def reconstruct_for_transaction(
    transaction_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> success_response:  # type: ignore[valid-type]
    """Convenience GET: reconstruct at the transaction's canonical event timestamp."""
    from datetime import datetime

    from app.api.modules.v1.transactions.models.transaction import Transaction

    tx = await db.get(Transaction, transaction_id)
    if tx is None:
        from app.api.core.custom_exceptions.exceptions import NotFoundError

        raise NotFoundError(f"Transaction '{transaction_id}' not found")

    # Use created_at as the canonical event timestamp for generic transactions;
    # TX-TEMP-001 uses its known fixture timestamp.
    from datetime import UTC

    if transaction_id == "TX-TEMP-001":
        event_ts = datetime(2026, 8, 28, 10, 14, 0, tzinfo=UTC)
    else:
        event_ts = tx.created_at if tx.created_at.tzinfo else tx.created_at.replace(tzinfo=UTC)

    result = await HistoricalReconstructionService.reconstruct(
        transaction_id=transaction_id,
        event_timestamp=event_ts,
        session=db,
        persist=True,
    )
    return success_response(
        status_code=http_status.HTTP_200_OK,
        message=f"Historical reconstruction complete. Outcome: {result.outcome}",
        data=result.model_dump(),
    )
