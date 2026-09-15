"""
Supplier and Baseline Statistics Pydantic DTO Schemas.
Pure request/response serialisation — no business logic.
"""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


def _mask_financial_field(value: Optional[str]) -> Optional[str]:
    """Return last-4 digits masked as '••••XXXX', or None if absent."""
    if value is None:
        return None
    digits = "".join(c for c in value if c.isdigit())
    last4 = digits[-4:] if len(digits) >= 4 else digits
    return f"••••{last4}"


class SupplierResponse(BaseModel):
    """Supplier master detail response DTO — full field visibility (privileged roles only)."""

    model_config = ConfigDict(from_attributes=True)

    supplier_id: str
    name: str
    category: str
    risk_tier: str
    bank_account: Optional[str] = None
    routing_number: Optional[str] = None
    bank_change_date: Optional[date] = None
    bank_change_reason: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime


class SupplierResponseMasked(BaseModel):
    """Supplier response DTO with sensitive financial fields masked (standard roles)."""

    model_config = ConfigDict(from_attributes=True)

    supplier_id: str
    name: str
    category: str
    risk_tier: str
    bank_account: Optional[str] = None  # masked: ••••XXXX
    routing_number: Optional[str] = None  # masked: ••••XXXX
    bank_change_date: Optional[date] = None
    bank_change_reason: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime

    @classmethod
    def from_supplier(cls, supplier: object) -> "SupplierResponseMasked":
        """Build masked response — bank fields replaced with last-4 representation."""
        base = cls.model_validate(supplier)
        base.bank_account = _mask_financial_field(base.bank_account)
        base.routing_number = _mask_financial_field(base.routing_number)
        return base


class BaselineStatsResponse(BaseModel):
    """Descriptive statistics baseline response DTO."""

    supplier_id: str
    supplier_name: str
    invoice_count: int
    mean_amount: float
    median_amount: float
    min_amount: float
    max_amount: float
    std_dev: float
    excluded_transaction_id: Optional[str] = None
    baseline_transaction_ids: List[str] = []
