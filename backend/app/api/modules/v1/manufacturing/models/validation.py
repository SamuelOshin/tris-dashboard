"""
Retrospective validation tables (decision D5). Insert-only: a run, each frozen forecast, each
revealed outcome and the final summary are separate rows that are never updated or deleted, so a
failed or unsuccessful run is kept exactly as it happened.

A run with no summary row did not finish (it is shown as incomplete, never removed).
Pure ORM models — no business logic.
"""

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Column, DateTime
from sqlmodel import Field, SQLModel


class ValidationRun(SQLModel, table=True):
    """A retrospective validation run: its settings and the versions it used."""

    __tablename__ = "validation_runs"

    run_id: str = Field(primary_key=True, max_length=50)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    data_end: date  # the latest purchase date in the data when the run started
    config: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    versions: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    note: str | None = Field(default=None, nullable=True, max_length=500)
    created_by: str = Field(foreign_key="users.user_id", index=True, max_length=50)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True), index=True
    )


class ValidationCase(SQLModel, table=True):
    """A forecast and warning signal frozen at a cutoff, before the actual was read."""

    __tablename__ = "validation_cases"

    case_id: str = Field(primary_key=True, max_length=50)
    run_id: str = Field(foreign_key="validation_runs.run_id", index=True, max_length=50)
    material_id: str = Field(foreign_key="materials.material_id", index=True, max_length=50)
    cutoff: date = Field(index=True)
    horizon_days: int
    status: str = Field(max_length=20)  # frozen | withheld
    withheld_reason: str | None = Field(default=None, nullable=True, max_length=500)
    target_month: date | None = Field(default=None, nullable=True)
    currency: str | None = Field(default=None, nullable=True, max_length=10)
    last_observed_price: float | None = Field(default=None, nullable=True)
    forecast_value: float | None = Field(default=None, nullable=True)
    lower_bound: float | None = Field(default=None, nullable=True)
    upper_bound: float | None = Field(default=None, nullable=True)
    naive_value: float | None = Field(default=None, nullable=True)
    model_code: str | None = Field(default=None, nullable=True, max_length=50)
    model_name: str | None = Field(default=None, nullable=True, max_length=100)
    model_version: str | None = Field(default=None, nullable=True, max_length=20)
    dataset_version: str | None = Field(default=None, nullable=True, max_length=40)
    history_months: int | None = Field(default=None, nullable=True)
    risk_score: float | None = Field(default=None, nullable=True)
    risk_level: str | None = Field(default=None, nullable=True, max_length=20)
    alert: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    risk_factors: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    frozen_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )


class ValidationOutcome(SQLModel, table=True):
    """What actually happened for a frozen case, written only after the case was stored."""

    __tablename__ = "validation_outcomes"

    outcome_id: str = Field(primary_key=True, max_length=50)
    case_id: str = Field(
        foreign_key="validation_cases.case_id", unique=True, index=True, max_length=50
    )
    run_id: str = Field(foreign_key="validation_runs.run_id", index=True, max_length=50)
    status: str = Field(max_length=20)  # evaluated | not_evaluable
    reason: str | None = Field(default=None, nullable=True, max_length=500)
    metrics: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    classification: str | None = Field(default=None, nullable=True, max_length=2)
    revealed_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )


class ValidationSummary(SQLModel, table=True):
    """The aggregate result and the honest list of limitations, written when a run finishes."""

    __tablename__ = "validation_summaries"

    run_id: str = Field(foreign_key="validation_runs.run_id", primary_key=True, max_length=50)
    metrics: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    limitations: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    problems: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    completed_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )


class ValidationFailure(SQLModel, table=True):
    """Why a run stopped before it finished. Written once, next to the run it belongs to."""

    __tablename__ = "validation_failures"

    failure_id: str = Field(primary_key=True, max_length=50)
    run_id: str = Field(foreign_key="validation_runs.run_id", index=True, max_length=50)
    error_type: str = Field(max_length=100)
    message: str = Field(max_length=1000)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
