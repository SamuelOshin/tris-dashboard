"""
Saved ERP/BOM mapping profile SQLModel table.
Pure ORM model — no business logic.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, SQLModel


class MappingProfile(SQLModel, table=True):
    """A reusable mapping from a source file's columns to one canonical manufacturing table."""

    __tablename__ = "mapping_profiles"

    profile_id: str = Field(primary_key=True, max_length=50)
    name: str = Field(unique=True, index=True, max_length=120)
    description: str | None = Field(default=None, nullable=True, max_length=500)
    # generic | sap_style | dynamics_style — the preset the mapping started from
    source_profile: str = Field(max_length=30)
    # Key of the canonical table the file is mapped into (for example "purchase_records")
    target: str = Field(index=True, max_length=50)
    # {canonical_field: source_column}
    field_mapping: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    # {canonical_field: constant value used when the file has no such column}
    defaults: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_by: str = Field(foreign_key="users.user_id", index=True, max_length=50)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
