"""
Transaction SQLModel Table.
Pure ORM model — no business logic.
"""

from datetime import UTC, date, datetime

from sqlmodel import Field, SQLModel


class Transaction(SQLModel, table=True):
    """Transactions financial ledger table."""

    __tablename__ = "transactions"

    transaction_id: str = Field(primary_key=True, index=True, max_length=50)
    supplier_id: str = Field(foreign_key="suppliers.supplier_id", index=True, max_length=50)
    invoice_number: str = Field(index=True, max_length=100)
    amount: float = Field(index=True)
    currency: str = Field(default="USD", max_length=10)
    invoice_date: date = Field(index=True)
    due_date: date | None = Field(default=None, nullable=True)
    posting_date: date | None = Field(default=None, nullable=True)
    approval_required: bool = Field(default=True)
    approval_status: str = Field(default="Approved", index=True, max_length=50)
    payment_status: str = Field(default="Pending", index=True, max_length=50)
    description: str | None = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
