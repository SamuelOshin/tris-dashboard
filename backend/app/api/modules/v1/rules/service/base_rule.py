"""
Abstract Base Strategy Rule Class for TRIS.
Every detection rule implements this contract.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.rules.models.rule_config import RuleConfig
from app.api.modules.v1.rules.schemas.rule_schemas import RuleEvaluationSignal
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.api.modules.v1.transactions.models.transaction import Transaction


class BaseRule(ABC):
    """Abstract Strategy Rule Interface."""

    rule_code: str
    name: str

    @abstractmethod
    async def evaluate(
        self,
        transaction: Transaction,
        supplier: Supplier,
        rule_config: RuleConfig,
        session: AsyncSession,
        context: Dict[str, Any],
    ) -> RuleEvaluationSignal:
        """
        Evaluates a single rule against a target transaction.

        Args:
            transaction: Transaction entity being evaluated.
            supplier: Supplier entity related to the transaction.
            rule_config: Persisted rule configuration containing thresholds and weight.
            session: Async database session.
            context: Shared evaluation context (e.g. precomputed baselines).

        Returns:
            RuleEvaluationSignal: Outcome of the rule evaluation.
        """
        pass
