"""
Risk Case and Immutable Case History SQLModel Tables.
Pure ORM model — no business logic.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class RiskCase(SQLModel, table=True):
    """Governed risk cases table."""

    __tablename__ = "risk_cases"

    case_id: str = Field(primary_key=True, index=True, max_length=50)
    case_number: str = Field(unique=True, index=True, max_length=50)
    priority: str = Field(default="Medium", index=True, max_length=20)
    status: str = Field(default="New", index=True, max_length=50)
    supplier_id: str | None = Field(
        default=None, foreign_key="suppliers.supplier_id", index=True, nullable=True
    )
    transaction_id: str | None = Field(
        default=None, foreign_key="transactions.transaction_id", index=True, nullable=True
    )
    assigned_to: str | None = Field(default=None, index=True, nullable=True, max_length=200)
    department: str | None = Field(default=None, max_length=100, nullable=True)

    trigger_signals: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False),
    )
    evaluation_snapshot: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )

    # 8-Field Mandatory Verified Closure Elements
    root_cause: str | None = Field(default=None, nullable=True)
    corrective_action: str | None = Field(default=None, nullable=True)
    closure_type: str | None = Field(default=None, nullable=True, max_length=100)
    closure_evidence: str | None = Field(default=None, nullable=True, max_length=255)
    verified_by: str | None = Field(default=None, nullable=True, max_length=200)
    closure_date: datetime | None = Field(default=None, nullable=True)
    follow_up_requirement: str | None = Field(default=None, nullable=True)
    recurrence_monitoring: str | None = Field(default=None, nullable=True, max_length=200)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class CaseHistory(SQLModel, table=True):
    """Immutable audit trail for all case lifecycle transitions and notes."""

    __tablename__ = "case_history"

    history_id: int | None = Field(default=None, primary_key=True)
    case_id: str = Field(foreign_key="risk_cases.case_id", index=True, max_length=50)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        index=True,
    )
    actor: str = Field(max_length=200)
    action: str = Field(max_length=100)
    previous_status: str | None = Field(default=None, nullable=True, max_length=50)
    new_status: str | None = Field(default=None, nullable=True, max_length=50)
    note: str | None = Field(default=None, nullable=True)
