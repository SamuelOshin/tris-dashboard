"""
Supplier and Baseline Statistics Pydantic DTO Schemas.
Pure request/response serialization — no business logic.
"""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class SupplierResponse(BaseModel):
    """Supplier master detail response DTO."""

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
