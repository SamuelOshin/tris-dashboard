"""
Material master data SQLModel tables.
Pure ORM models — no business logic.
"""

from datetime import UTC, date, datetime

from sqlalchemy import CheckConstraint, DateTime, UniqueConstraint
from sqlmodel import Field, SQLModel


class Material(SQLModel, table=True):
    """A raw material, component or purchased input tracked by the manufacturing extension."""

    __tablename__ = "materials"

    material_id: str = Field(primary_key=True, max_length=50)
    description: str = Field(max_length=500)
    category: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    unit_of_measure: str = Field(max_length=20)
    is_active: bool = Field(default=True)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )


class MaterialSupplier(SQLModel, table=True):
    """Links a material to a supplier. Reuses the existing suppliers table for identity."""

    __tablename__ = "material_suppliers"
    __table_args__ = (UniqueConstraint("material_id", "supplier_id", name="uq_material_supplier"),)

    id: int | None = Field(default=None, primary_key=True)
    material_id: str = Field(foreign_key="materials.material_id", index=True, max_length=50)
    supplier_id: str = Field(foreign_key="suppliers.supplier_id", index=True, max_length=50)
    is_primary: bool = Field(default=False)
    risk_indicator: str | None = Field(default=None, nullable=True, max_length=20)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )


class MaterialCost(SQLModel, table=True):
    """Standard, actual and budget cost for a material, versioned over time."""

    __tablename__ = "material_costs"
    __table_args__ = (
        UniqueConstraint("material_id", "version", name="uq_material_cost_version"),
        CheckConstraint(
            "(standard_cost IS NULL OR standard_cost >= 0) "
            "AND (actual_cost IS NULL OR actual_cost >= 0) "
            "AND (budget_cost IS NULL OR budget_cost >= 0)",
            name="ck_material_costs_non_negative",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    material_id: str = Field(foreign_key="materials.material_id", index=True, max_length=50)
    version: int = Field(default=1)
    effective_from: date = Field(index=True)
    effective_to: date | None = Field(default=None, nullable=True)
    standard_cost: float | None = Field(default=None, nullable=True)
    actual_cost: float | None = Field(default=None, nullable=True)
    budget_cost: float | None = Field(default=None, nullable=True)
    currency: str = Field(default="USD", max_length=10)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
