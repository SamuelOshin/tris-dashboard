"""
Rule Configuration SQLModel Table.
Pure ORM model — no business logic.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class RuleConfig(SQLModel, table=True):
    """Configurable detection rules table."""

    __tablename__ = "rule_configs"

    rule_id: int | None = Field(default=None, primary_key=True)
    rule_code: str = Field(unique=True, index=True, max_length=50)
    name: str = Field(max_length=255)
    description: str = Field(max_length=500)
    weight: int = Field(default=20)
    threshold_params: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )
    rule_version: int = Field(default=1)
    is_active: bool = Field(default=True, index=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
