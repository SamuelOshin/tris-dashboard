"""
Material risk scoring tables (decision D4). Their own tables: nothing here is stored in, or
shares a row with, any rule-engine table. Rows are never updated: a new weight set
is a new version and every scoring run is a new row, so any past score can be reproduced exactly.
Pure ORM models — no business logic.
"""

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, SQLModel


class MaterialRiskWeightSet(SQLModel, table=True):
    """One version of the factor weights, scales and risk bands. The newest version is active."""

    __tablename__ = "material_risk_weight_sets"

    version: int = Field(primary_key=True)
    config: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    note: str = Field(max_length=500)
    created_by: str = Field(max_length=50)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )


class MaterialRiskScore(SQLModel, table=True):
    """A stored risk score with every factor, the weights used and the inputs it was based on."""

    __tablename__ = "material_risk_scores"

    score_id: str = Field(primary_key=True, max_length=50)
    material_id: str = Field(foreign_key="materials.material_id", index=True, max_length=50)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    as_of: date = Field(index=True)  # the cutoff: no data after this date was used
    currency: str | None = Field(default=None, nullable=True, max_length=10)
    method_version: str = Field(max_length=20)
    weight_version: int = Field(foreign_key="material_risk_weight_sets.version", index=True)
    score: float
    level: str = Field(max_length=20)
    data_coverage_pct: float
    factors: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    summary: str = Field(max_length=1000)
    config: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    forecast_run_id: str | None = Field(default=None, nullable=True, max_length=50)
    inputs_version: str = Field(max_length=40)  # fingerprint of the factor readings used
    created_by: str = Field(foreign_key="users.user_id", index=True, max_length=50)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True), index=True
    )
