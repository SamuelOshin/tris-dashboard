"""
Bill-of-materials, production, demand and supplier-operations SQLModel tables.
Pure ORM models — no business logic.
"""

from datetime import UTC, date, datetime

from sqlalchemy import CheckConstraint, DateTime
from sqlmodel import Field, SQLModel


class BOMEntry(SQLModel, table=True):
    """One component line of a finished product bill of materials."""

    __tablename__ = "bom_entries"
    __table_args__ = (CheckConstraint("bom_quantity > 0", name="ck_bom_entries_quantity"),)

    id: int | None = Field(default=None, primary_key=True)
    product_sku: str = Field(index=True, max_length=50)
    product_description: str | None = Field(default=None, nullable=True, max_length=500)
    material_id: str = Field(foreign_key="materials.material_id", index=True, max_length=50)
    bom_quantity: float
    unit_of_measure: str = Field(max_length=20)
    effective_from: date | None = Field(default=None, nullable=True)
    effective_to: date | None = Field(default=None, nullable=True)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )


class ProductionRecord(SQLModel, table=True):
    """Planned and/or actual production volume for a product over a period."""

    __tablename__ = "production_records"
    __table_args__ = (
        CheckConstraint("period_end >= period_start", name="ck_production_records_period"),
        CheckConstraint(
            "planned_volume IS NOT NULL OR actual_volume IS NOT NULL",
            name="ck_production_records_has_volume",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    product_sku: str = Field(index=True, max_length=50)
    period_start: date = Field(index=True)
    period_end: date
    planned_volume: float | None = Field(default=None, nullable=True)
    actual_volume: float | None = Field(default=None, nullable=True)
    unit_of_measure: str = Field(max_length=20)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )


class DemandForecast(SQLModel, table=True):
    """Demand forecast supplied by the source system (an input, not a TRIS prediction)."""

    __tablename__ = "demand_forecasts"
    __table_args__ = (
        CheckConstraint("period_end >= period_start", name="ck_demand_forecasts_period"),
        CheckConstraint(
            "product_sku IS NOT NULL OR material_id IS NOT NULL",
            name="ck_demand_forecasts_has_subject",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    product_sku: str | None = Field(default=None, index=True, nullable=True, max_length=50)
    material_id: str | None = Field(
        default=None, foreign_key="materials.material_id", index=True, nullable=True, max_length=50
    )
    period_start: date = Field(index=True)
    period_end: date
    forecast_quantity: float
    unit_of_measure: str = Field(max_length=20)
    forecast_source: str | None = Field(default=None, nullable=True, max_length=100)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )


class SupplierOperationsMetric(SQLModel, table=True):
    """Supplier operational performance (lead time and related authorized metrics)."""

    __tablename__ = "supplier_operations_metrics"
    __table_args__ = (
        CheckConstraint(
            "(lead_time_days IS NULL OR lead_time_days >= 0) "
            "AND (on_time_delivery_rate IS NULL OR "
            "(on_time_delivery_rate >= 0 AND on_time_delivery_rate <= 1))",
            name="ck_supplier_ops_metrics_values",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    supplier_id: str = Field(foreign_key="suppliers.supplier_id", index=True, max_length=50)
    material_id: str | None = Field(
        default=None, foreign_key="materials.material_id", index=True, nullable=True, max_length=50
    )
    metric_date: date = Field(index=True)
    lead_time_days: float | None = Field(default=None, nullable=True)
    on_time_delivery_rate: float | None = Field(default=None, nullable=True)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
