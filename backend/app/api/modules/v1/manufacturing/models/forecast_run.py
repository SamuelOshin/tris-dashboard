"""
Forecast run SQLModel table. One row per forecast actually produced, never updated: a re-run
makes a new row, so a historical forecast can always be shown exactly as it was.
Pure ORM model — no business logic.
"""

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, SQLModel


class ForecastRun(SQLModel, table=True):
    """A stored forecast with the model metadata needed to reproduce and audit it."""

    __tablename__ = "forecast_runs"

    run_id: str = Field(primary_key=True, max_length=50)
    material_id: str = Field(foreign_key="materials.material_id", index=True, max_length=50)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    as_of: date = Field(index=True)  # the cutoff: no data after this date was used
    currency: str | None = Field(default=None, nullable=True, max_length=10)
    horizon_days: int
    horizon_months: int
    model_code: str = Field(max_length=50)
    model_name: str = Field(max_length=100)
    model_version: str = Field(max_length=20)
    dataset_version: str = Field(max_length=40)  # fingerprint of the exact data the model saw
    history_months: int
    history_start: date
    history_end: date
    forecast_month: date
    forecast_value: float
    lower_bound: float | None = Field(default=None, nullable=True)
    upper_bound: float | None = Field(default=None, nullable=True)
    interval_level: float | None = Field(default=None, nullable=True)
    path: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    candidates: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    selection_rationale: str = Field(max_length=2000)
    config: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_by: str = Field(foreign_key="users.user_id", index=True, max_length=50)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True), index=True
    )
