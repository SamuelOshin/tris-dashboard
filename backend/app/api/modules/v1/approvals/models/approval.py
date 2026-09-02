"""
Approval SQLModel Table.
Pure ORM model — no business logic.
"""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class Approval(SQLModel, table=True):
    """Internal controls approval tracking table."""

    __tablename__ = "approvals"

    approval_id: str = Field(primary_key=True, index=True, max_length=50)
    transaction_id: str = Field(
        foreign_key="transactions.transaction_id",
        index=True,
        max_length=50,
    )
    required_level: str = Field(max_length=50)
    approver_name: str | None = Field(default=None, nullable=True, max_length=200)
    approver_role: str | None = Field(default=None, nullable=True, max_length=100)
    approval_status: str = Field(default="Missing", index=True, max_length=50)
    approval_date: datetime | None = Field(default=None, nullable=True)
    notes: str | None = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
