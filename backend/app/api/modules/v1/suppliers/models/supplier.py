"""
Supplier Master SQLModel Table.
Pure ORM model — no business logic.
"""

from datetime import UTC, date, datetime

from sqlmodel import Field, SQLModel


class Supplier(SQLModel, table=True):
    """Suppliers master directory table."""

    __tablename__ = "suppliers"

    supplier_id: str = Field(primary_key=True, index=True, max_length=50)
    name: str = Field(index=True, max_length=255)
    category: str = Field(index=True, max_length=100)
    risk_tier: str = Field(default="Medium", index=True, max_length=50)
    bank_account: str | None = Field(default=None, nullable=True, max_length=100)
    routing_number: str | None = Field(default=None, nullable=True, max_length=50)
    bank_change_date: date | None = Field(default=None, nullable=True)
    bank_change_reason: str | None = Field(default=None, nullable=True)
    status: str = Field(default="Active", max_length=50)
    notes: str | None = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
