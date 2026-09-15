"""Proposed Control SQLModel Table.

Pure ORM model — no business logic.
Stored completely separately from RuleConfig (active/historical detection rules).
Never overwrites or version-merges into RuleConfig history.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class ProposedControl(SQLModel, table=True):
    """Configurable proposed corrective control definition.

    Stored separately from active/historical rule configuration (rule_configs).
    Used exclusively for remediation replay simulations.
    """

    __tablename__ = "proposed_controls"

    control_id: str = Field(primary_key=True, max_length=50)
    name: str = Field(max_length=255)
    description: str = Field(max_length=1000)
    amount_threshold: float = Field(default=50000.0)
    bank_change_window_days: int = Field(default=7)
    required_approval_level: str = Field(default="Level 2", max_length=50)
    action_policy: str = Field(default="BLOCK/PREVENT", max_length=50)
    parameters: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )
    version: int = Field(default=1)
    is_active: bool = Field(default=True, index=True)
    created_by: str | None = Field(default=None, max_length=100, nullable=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
