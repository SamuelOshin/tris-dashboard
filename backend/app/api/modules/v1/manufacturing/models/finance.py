"""
Financial plan SQLModel table.
Pure ORM model — no business logic.
"""

from datetime import UTC, date, datetime

from sqlalchemy import CheckConstraint, DateTime
from sqlmodel import Field, SQLModel


class FinancialPlanRecord(SQLModel, table=True):
    """Budget, forecast and actual material cost for a period."""

    __tablename__ = "financial_plan_records"
    __table_args__ = (
        CheckConstraint("period_end >= period_start", name="ck_financial_plan_records_period"),
        CheckConstraint(
            "budget_amount IS NOT NULL OR forecast_amount IS NOT NULL OR actual_amount IS NOT NULL",
            name="ck_financial_plan_records_has_amount",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    material_id: str | None = Field(
        default=None, foreign_key="materials.material_id", index=True, nullable=True, max_length=50
    )
    product_sku: str | None = Field(default=None, index=True, nullable=True, max_length=50)
    period_start: date = Field(index=True)
    period_end: date
    budget_amount: float | None = Field(default=None, nullable=True)
    forecast_amount: float | None = Field(default=None, nullable=True)
    actual_amount: float | None = Field(default=None, nullable=True)
    currency: str = Field(default="USD", max_length=10)
    dataset_id: str | None = Field(default=None, index=True, nullable=True, max_length=100)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
