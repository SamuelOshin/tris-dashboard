"""
Ingestion Pydantic DTO Validation Schemas.
Pure schemas for request parsing and API response serialization — no business logic.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class IngestionUploadResponse(BaseModel):
    """Response returned upon accepting a workbook for asynchronous processing."""

    job_id: str = Field(..., description="Unique ingestion tracking identifier")
    status: str = Field(..., description="Current job status (e.g. PENDING)")
    filename: str | None = Field(None, description="Original uploaded filename")
    duplicate_strategy: str = Field(..., description="Configured duplicate handling strategy")
    check_status_url: str = Field(..., description="URL endpoint to poll for status and telemetry")


class IngestionJobResponse(BaseModel):
    """Detailed telemetry and audit report for an ingestion job."""

    job_id: str
    status: Literal["PENDING", "PROCESSING", "COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"]
    filename: str | None = None
    file_size_bytes: int = 0
    uploaded_by: str
    duplicate_strategy: str

    total_rows: int = 0
    processed_rows: int = 0
    inserted_rows: int = 0
    updated_rows: int = 0
    skipped_rows: int = 0
    error_rows: int = 0

    summary_report: dict[str, Any] = Field(default_factory=dict)
    error_log: list[dict[str, Any]] = Field(default_factory=list)

    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
