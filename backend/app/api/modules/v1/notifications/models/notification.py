"""
Notification SQLModel Table.
Pure ORM model - no business logic.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Column, Text
from sqlmodel import Field, SQLModel


def generate_notif_id() -> str:
    """Generate a unique notification identifier."""
    return f"NOTIF-{uuid.uuid4().hex[:12]}"


class Notification(SQLModel, table=True):
    """Persistent notification record."""

    __tablename__ = "notifications"

    notification_id: str = Field(
        default_factory=generate_notif_id,
        primary_key=True,
        index=True,
        max_length=50,
    )
    recipient_user_id: str | None = Field(default=None, nullable=True, index=True, max_length=100)
    recipient_role: str | None = Field(default=None, nullable=True, index=True, max_length=50)
    title: str = Field(max_length=200)
    message: str = Field(sa_column=Column(Text, nullable=False))
    category: str = Field(default="SYSTEM", index=True, max_length=50)
    severity: str = Field(default="INFO", index=True, max_length=20)
    link_url: str | None = Field(default=None, nullable=True, max_length=500)
    is_read: bool = Field(default=False, index=True)
    read_at: datetime | None = Field(default=None, nullable=True)
    metadata_json: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
