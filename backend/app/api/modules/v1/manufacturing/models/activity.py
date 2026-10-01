"""
Purchase, inventory and price-variance SQLModel tables.
Pure ORM models — no business logic.
"""

from datetime import UTC, date, datetime

from sqlalchemy import CheckConstraint, DateTime
from sqlmodel import Field, SQLModel


class PurchaseRecord(SQLModel, table=True):
    """A material purchase line: what was bought, how much, at what unit price."""

    __tablename__ = "purchase_records"
    __table_args__ = (
        CheckConstraint("quantity > 0 AND unit_price >= 0", name="ck_purchase_records_values"),
    )

    id: int | None = Field(default=None, primary_key=True)
    purchase_reference: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    material_id: str = Field(foreign_key="materials.material_id", index=True, max_length=50)
    supplier_id: str | None = Field(
        default=None, foreign_key="suppliers.supplier_id", index=True, nullable=True, max_length=50
    )
    purchase_date: date = Field(index=True)
    quantity: float
    unit_price: float
    currency: str = Field(default="USD", max_length=10)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )


class InventoryRecord(SQLModel, table=True):
    """Point-in-time inventory position for a material."""

    __tablename__ = "inventory_records"
    __table_args__ = (
        CheckConstraint(
            "quantity_on_hand >= 0 AND (inventory_value IS NULL OR inventory_value >= 0) "
            "AND (days_of_supply IS NULL OR days_of_supply >= 0)",
            name="ck_inventory_records_non_negative",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    material_id: str = Field(foreign_key="materials.material_id", index=True, max_length=50)
    snapshot_date: date = Field(index=True)
    quantity_on_hand: float
    inventory_value: float | None = Field(default=None, nullable=True)
    currency: str = Field(default="USD", max_length=10)
    days_of_supply: float | None = Field(default=None, nullable=True)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )


class VarianceInput(SQLModel, table=True):
    """Purchase price variance (PPV) or the inputs needed to derive it, per material and period."""

    __tablename__ = "variance_inputs"
    __table_args__ = (
        CheckConstraint("period_end >= period_start", name="ck_variance_inputs_period"),
    )

    id: int | None = Field(default=None, primary_key=True)
    material_id: str = Field(foreign_key="materials.material_id", index=True, max_length=50)
    period_start: date = Field(index=True)
    period_end: date
    standard_price: float | None = Field(default=None, nullable=True)
    actual_price: float | None = Field(default=None, nullable=True)
    quantity_purchased: float | None = Field(default=None, nullable=True)
    reported_ppv_amount: float | None = Field(default=None, nullable=True)
    currency: str = Field(default="USD", max_length=10)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
