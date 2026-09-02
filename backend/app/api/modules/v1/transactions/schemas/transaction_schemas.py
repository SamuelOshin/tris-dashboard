"""
Transaction Pydantic DTO Schemas.
Pure request/response serialization — no business logic.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TransactionResponse(BaseModel):
    """Transaction response DTO."""

    model_config = ConfigDict(from_attributes=True)

    transaction_id: str
    supplier_id: str
    invoice_number: str
    amount: float
    currency: str
    invoice_date: date
    due_date: Optional[date] = None
    posting_date: Optional[date] = None
    approval_required: bool
    approval_status: str
    payment_status: str
    description: Optional[str] = None
    created_at: datetime
