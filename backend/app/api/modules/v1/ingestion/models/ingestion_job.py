"""
Ingestion Job SQLModel Table.
Tracks asynchronous workbook ingestion lifecycles, progress telemetry, and audit logs.
Pure ORM model — no business logic.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class IngestionJob(SQLModel, table=True):
    """Tracks asynchronous workbook ingestion lifecycles, progress, and audit logs."""

    __tablename__ = "ingestion_jobs"

    job_id: str = Field(primary_key=True, index=True, max_length=50)
    status: str = Field(default="PENDING", index=True, max_length=30)
    # Lifecycle: PENDING -> PROCESSING -> COMPLETED | COMPLETED_WITH_ERRORS | FAILED

    filename: str | None = Field(default=None, max_length=255, nullable=True)
    file_size_bytes: int = Field(default=0)
    uploaded_by: str = Field(foreign_key="users.user_id", index=True, max_length=50)
    duplicate_strategy: str = Field(default="skip", max_length=20)  # skip | update | fail

    total_rows: int = Field(default=0)
    processed_rows: int = Field(default=0)
    inserted_rows: int = Field(default=0)
    updated_rows: int = Field(default=0)
    skipped_rows: int = Field(default=0)
    error_rows: int = Field(default=0)

    summary_report: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )
    error_log: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False),
    )  # [{sheet: str, row: int, field: str, error: str, raw_value: dict}]

    started_at: datetime | None = Field(default=None, nullable=True)
    completed_at: datetime | None = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
