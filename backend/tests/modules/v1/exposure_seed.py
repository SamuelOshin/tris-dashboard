"""Shared seed helpers for the Ticket 8 tests (not a test module)."""

from datetime import UTC, date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.manufacturing.models import (
    BOMEntry,
    ForecastRun,
    InventoryRecord,
    Material,
    ProductionRecord,
    PurchaseRecord,
    SupplierOperationsMetric,
)
from app.api.modules.v1.suppliers.models.supplier import Supplier

AS_OF = date(2026, 4, 30)  # end of month, so April counts as a complete month
AS_OF_Q = {"as_of": AS_OF.isoformat()}
EXPOSURE = "/api/v1/manufacturing/exposure"
FORECASTS = "/api/v1/manufacturing/forecasting"


async def ensure_supplier(session: AsyncSession, supplier_id: str) -> None:
    if await session.get(Supplier, supplier_id) is None:
        session.add(Supplier(supplier_id=supplier_id, name=f"{supplier_id} Ltd", category="Raw"))
        await session.commit()


async def seed_material(
    session: AsyncSession,
    material_id: str = "MAT-A",
    *,
    months: int = 16,
    start: tuple[int, int] = (2025, 1),
    price: float = 100.0,
    suppliers: tuple[tuple[str, float], ...] = (("SUP-1", 30.0), ("SUP-2", 20.0)),
    currency: str = "USD",
    category: str | None = "Metals",
    dataset_id: str | None = None,
) -> None:
    """A material with `months` consecutive monthly purchases (one line per supplier)."""
    session.add(
        Material(
            material_id=material_id,
            description=f"{material_id} part",
            category=category,
            unit_of_measure="kg",
        )
    )
    for supplier_id, _ in suppliers:
        await ensure_supplier(session, supplier_id)
    await session.commit()
    year, month = start
    for _ in range(months):
        for supplier_id, quantity in suppliers:
            session.add(
                PurchaseRecord(
                    material_id=material_id,
                    supplier_id=supplier_id,
                    purchase_date=date(year, month, 15),
                    quantity=quantity,
                    unit_price=price,
                    currency=currency,
                    dataset_id=dataset_id,
                )
            )
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    await session.commit()


async def store_run(
    session: AsyncSession,
    material_id: str,
    horizon_days: int,
    path_values: list[float],
    *,
    last_price: float = 100.0,
    currency: str | None = "USD",
    as_of: date = AS_OF,
    created_at: datetime | None = None,
    dataset_id: str | None = None,
) -> str:
    """Store a forecast run with exactly the given values (the 'stored baseline prediction')."""
    stamp = created_at or datetime.now(UTC)
    run = ForecastRun(
        run_id=f"FRC-{material_id}-{horizon_days}-{int(stamp.timestamp() * 1000)}",
        material_id=material_id,
        dataset_id=dataset_id,
        as_of=as_of,
        currency=currency,
        horizon_days=horizon_days,
        horizon_months=len(path_values),
        model_code="naive",
        model_name="Naive",
        model_version="1.0",
        dataset_version="sha256:test",
        history_months=16,
        history_start=date(2025, 1, 1),
        history_end=date(2026, 4, 1),
        forecast_month=date(2026, 4 + len(path_values), 1),
        forecast_value=path_values[-1],
        path=[
            {"month": f"2026-{5 + i:02d}-01", "value": v, "lower": None, "upper": None}
            for i, v in enumerate(path_values)
        ],
        candidates=[],
        selection_rationale="test fixture",
        config={"last_observed_price": last_price},
        created_by="USR-TEST-001",
        created_at=stamp,
    )
    session.add(run)
    await session.commit()
    return run.run_id


async def seed_inventory(session: AsyncSession, material_id: str, quantity: float) -> None:
    session.add(
        InventoryRecord(
            material_id=material_id, snapshot_date=date(2026, 4, 28), quantity_on_hand=quantity
        )
    )
    await session.commit()


async def seed_lead_time(session: AsyncSession, supplier_id: str, days: float) -> None:
    session.add(
        SupplierOperationsMetric(
            supplier_id=supplier_id, metric_date=date(2026, 4, 20), lead_time_days=days
        )
    )
    await session.commit()


async def seed_bom(session: AsyncSession, product: str, material_id: str, quantity: float) -> None:
    session.add(
        BOMEntry(
            product_sku=product,
            material_id=material_id,
            bom_quantity=quantity,
            unit_of_measure="kg",
        )
    )
    await session.commit()


async def seed_production(
    session: AsyncSession,
    product: str,
    volume: float,
    period: tuple[date, date] = (date(2026, 4, 1), date(2026, 4, 30)),
) -> None:
    """One period of actual production for the product (default: April 2026)."""
    session.add(
        ProductionRecord(
            product_sku=product,
            period_start=period[0],
            period_end=period[1],
            actual_volume=volume,
            unit_of_measure="pcs",
        )
    )
    await session.commit()
