"""
Administration tables of the manufacturing extension (work plan Section 10).

`forecast_model_settings` keeps every change of whether a forecast model may be used, one row per
change, so a model can be switched off without losing any history (the newest row of a model is
its current state). `dataset_registry` names each dataset that has been imported, with the
attestation of whether it is synthetic or authorised data.

Pure ORM models — no business logic.
"""

from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime
from sqlmodel import Field, SQLModel


class ForecastModelSetting(SQLModel, table=True):
    """One change of a forecast model's availability. Insert-only; the newest row wins."""

    __tablename__ = "forecast_model_settings"

    id: int | None = Field(default=None, primary_key=True)
    model_code: str = Field(index=True, max_length=50)
    enabled: bool = Field(sa_column=Column(Boolean, nullable=False))
    note: str | None = Field(default=None, nullable=True, max_length=500)
    changed_by: str = Field(foreign_key="users.user_id", index=True, max_length=50)
    changed_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=DateTime(timezone=True),
        index=True,
    )


class DatasetRegistryEntry(SQLModel, table=True):
    """A named dataset, registered when it is first imported."""

    __tablename__ = "dataset_registry"

    dataset_id: str = Field(primary_key=True, max_length=100)
    label: str = Field(default="unlabelled", max_length=20)  # unlabelled | synthetic | authorized
    source_type: str = Field(default="file upload", max_length=40)
    description: str | None = Field(default=None, nullable=True, max_length=500)
    registered_by: str = Field(foreign_key="users.user_id", max_length=50)
    registered_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
    label_set_by: str | None = Field(
        default=None, foreign_key="users.user_id", nullable=True, max_length=50
    )
    label_set_at: datetime | None = Field(
        default=None, nullable=True, sa_type=DateTime(timezone=True)
    )
