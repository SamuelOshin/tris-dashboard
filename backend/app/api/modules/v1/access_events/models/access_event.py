"""
Access Event Telemetry SQLModel Table.
Pure ORM model — no business logic.
"""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class AccessEvent(SQLModel, table=True):
    """Identity and access event telemetry logs."""

    __tablename__ = "access_events"

    event_id: str = Field(primary_key=True, index=True, max_length=50)
    user_id: str = Field(index=True, max_length=100)
    event_time: datetime = Field(index=True)
    system: str = Field(index=True, max_length=100)
    action: str = Field(max_length=100)
    resource: str = Field(max_length=100)
    supplier_id: str | None = Field(default=None, nullable=True, max_length=50)
    result: str = Field(default="Success", max_length=50)
    location_context: str | None = Field(default=None, nullable=True, max_length=200)
    notes: str | None = Field(default=None, nullable=True)
    flagged: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
