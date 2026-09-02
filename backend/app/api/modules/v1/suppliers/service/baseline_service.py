"""
Supplier and Baseline Statistics Service.
Implements descriptive statistics calculation with strict target transaction exclusion.
Pure business logic — raises domain exceptions directly.
"""

import statistics
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import NotFoundError
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.api.modules.v1.transactions.models.transaction import Transaction


class BaselineService:
    """Business logic service for suppliers and transaction baselines."""

    @staticmethod
    async def get_all_suppliers(
        session: AsyncSession,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Supplier]:
        """Retrieve paginated list of all active suppliers."""
        statement = select(Supplier).offset(skip).limit(limit)
        result = await session.execute(statement)
        return list(result.scalars().all())

    @staticmethod
    async def get_supplier_by_id(
        supplier_id: str,
        session: AsyncSession,
    ) -> Supplier:
        """
        Retrieve a single supplier by unique ID.

        Raises:
            NotFoundError: If supplier does not exist.
        """
        supplier = await session.get(Supplier, supplier_id)
        if not supplier:
            raise NotFoundError(f"Supplier '{supplier_id}' not found")
        return supplier

    @staticmethod
    async def calculate_baseline(
        supplier_id: str,
        session: AsyncSession,
        exclude_transaction_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Calculates transparent descriptive baseline statistics for a supplier.
        Strictly excludes the specified target transaction ID to prevent statistical bias.

        Args:
            supplier_id: Supplier ID (e.g. 'SUP-001').
            session: Async database session.
            exclude_transaction_id: Transaction to exclude (e.g. 'TX-1999').

        Returns:
            Dict[str, Any]: Descriptive stats (mean, median, min, max, std_dev, count).

        Raises:
            NotFoundError: If supplier does not exist.
        """
        supplier = await session.get(Supplier, supplier_id)
        if not supplier:
            raise NotFoundError(f"Supplier '{supplier_id}' not found")

        # Query all transactions belonging to this supplier
        statement = (
            select(Transaction)
            .where(Transaction.supplier_id == supplier_id)
            .order_by(Transaction.invoice_date.asc())
        )
        result = await session.execute(statement)
        all_transactions = list(result.scalars().all())

        # Enforce strict target exclusion
        baseline_txs = [
            tx
            for tx in all_transactions
            if exclude_transaction_id is None or tx.transaction_id != exclude_transaction_id
        ]

        amounts = [tx.amount for tx in baseline_txs]
        tx_ids = [tx.transaction_id for tx in baseline_txs]

        if not amounts:
            return {
                "supplier_id": supplier.supplier_id,
                "supplier_name": supplier.name,
                "invoice_count": 0,
                "mean_amount": 0.0,
                "median_amount": 0.0,
                "min_amount": 0.0,
                "max_amount": 0.0,
                "std_dev": 0.0,
                "excluded_transaction_id": exclude_transaction_id,
                "baseline_transaction_ids": [],
            }

        mean_val = round(statistics.mean(amounts), 2)
        median_val = round(statistics.median(amounts), 2)
        min_val = round(min(amounts), 2)
        max_val = round(max(amounts), 2)
        std_dev_val = round(statistics.stdev(amounts), 2) if len(amounts) > 1 else 0.0

        return {
            "supplier_id": supplier.supplier_id,
            "supplier_name": supplier.name,
            "invoice_count": len(amounts),
            "mean_amount": mean_val,
            "median_amount": median_val,
            "min_amount": min_val,
            "max_amount": max_val,
            "std_dev": std_dev_val,
            "excluded_transaction_id": exclude_transaction_id,
            "baseline_transaction_ids": tx_ids,
        }
