"""
Transaction Business Logic Service.
Pure business logic — raises domain exceptions, no try-except.
"""

from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import NotFoundError
from app.api.modules.v1.transactions.models.transaction import Transaction


class TransactionService:
    """Service handling financial transaction operations."""

    @staticmethod
    async def get_all_transactions(
        session: AsyncSession,
        supplier_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Transaction]:
        """Retrieve paginated transactions, optionally filtered by supplier."""
        stmt = select(Transaction)
        if supplier_id:
            stmt = stmt.where(Transaction.supplier_id == supplier_id)

        stmt = stmt.order_by(Transaction.invoice_date.desc()).offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_transaction_by_id(
        transaction_id: str,
        session: AsyncSession,
    ) -> Transaction:
        """
        Retrieve a single transaction by ID.

        Raises:
            NotFoundError: If transaction does not exist.
        """
        tx = await session.get(Transaction, transaction_id)
        if not tx:
            raise NotFoundError(f"Transaction '{transaction_id}' not found")
        return tx
