"""
Ticket 4 — Canonical manufacturing schema.

Verifies the 11 tables exist, reuse the existing suppliers table for supplier identity, and
reject structurally invalid data at the database level.
"""

from datetime import date

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.manufacturing.models import (
    BOMEntry,
    DemandForecast,
    FinancialPlanRecord,
    InventoryRecord,
    Material,
    MaterialCost,
    MaterialSupplier,
    ProductionRecord,
    PurchaseRecord,
    SupplierOperationsMetric,
    VarianceInput,
)
from app.api.modules.v1.suppliers.models.supplier import Supplier

EXPECTED_TABLES = {
    "materials",
    "material_suppliers",
    "material_costs",
    "purchase_records",
    "inventory_records",
    "variance_inputs",
    "bom_entries",
    "production_records",
    "demand_forecasts",
    "supplier_operations_metrics",
    "financial_plan_records",
}


async def _seed_material(session: AsyncSession) -> None:
    session.add(Material(material_id="MAT-1", description="Steel coil", unit_of_measure="kg"))
    session.add(
        Supplier(
            supplier_id="SUP-M1",
            name="Metals Co",
            category="Metals",
            risk_tier="Low",
            bank_account="123456789012",
            routing_number="123456789",
            status="Active",
        )
    )
    await session.commit()


@pytest.mark.asyncio
async def test_all_manufacturing_tables_exist(db_session: AsyncSession):
    conn = await db_session.connection()
    names = await conn.run_sync(lambda c: set(inspect(c).get_table_names()))
    assert EXPECTED_TABLES <= names


@pytest.mark.asyncio
async def test_supplier_identity_is_reused_not_duplicated(db_session: AsyncSession):
    """Supplier links are foreign keys into the existing suppliers table."""
    conn = await db_session.connection()
    for table in ("material_suppliers", "purchase_records", "supplier_operations_metrics"):
        fks = await conn.run_sync(lambda c, t=table: inspect(c).get_foreign_keys(t))
        assert any(fk["referred_table"] == "suppliers" for fk in fks), table

    await _seed_material(db_session)
    db_session.add(MaterialSupplier(material_id="MAT-1", supplier_id="SUP-M1", is_primary=True))
    await db_session.commit()

    db_session.add(MaterialSupplier(material_id="MAT-1", supplier_id="SUP-UNKNOWN"))
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_material_supplier_link_is_unique(db_session: AsyncSession):
    await _seed_material(db_session)
    db_session.add(MaterialSupplier(material_id="MAT-1", supplier_id="SUP-M1"))
    await db_session.commit()
    db_session.add(MaterialSupplier(material_id="MAT-1", supplier_id="SUP-M1"))
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_valid_rows_accepted_across_tables(db_session: AsyncSession):
    await _seed_material(db_session)
    d1, d2 = date(2026, 1, 1), date(2026, 1, 31)
    db_session.add_all(
        [
            MaterialCost(material_id="MAT-1", version=1, effective_from=d1, standard_cost=10.0),
            MaterialCost(material_id="MAT-1", version=2, effective_from=d2, standard_cost=11.0),
            PurchaseRecord(
                material_id="MAT-1",
                supplier_id="SUP-M1",
                purchase_date=d1,
                quantity=100.0,
                unit_price=9.5,
            ),
            InventoryRecord(material_id="MAT-1", snapshot_date=d1, quantity_on_hand=500.0),
            VarianceInput(material_id="MAT-1", period_start=d1, period_end=d2, actual_price=9.5),
            BOMEntry(
                product_sku="SKU-1", material_id="MAT-1", bom_quantity=2.5, unit_of_measure="kg"
            ),
            ProductionRecord(
                product_sku="SKU-1",
                period_start=d1,
                period_end=d2,
                planned_volume=1000.0,
                unit_of_measure="unit",
            ),
            DemandForecast(
                material_id="MAT-1",
                period_start=d1,
                period_end=d2,
                forecast_quantity=800.0,
                unit_of_measure="kg",
            ),
            SupplierOperationsMetric(
                supplier_id="SUP-M1",
                metric_date=d1,
                lead_time_days=14.0,
                on_time_delivery_rate=0.92,
            ),
            FinancialPlanRecord(
                material_id="MAT-1", period_start=d1, period_end=d2, budget_amount=5000.0
            ),
        ]
    )
    await db_session.commit()


def _invalid_rows() -> list:
    d1, d2 = date(2026, 1, 1), date(2026, 1, 31)
    return [
        # quantity must be positive
        PurchaseRecord(material_id="MAT-1", purchase_date=d1, quantity=0, unit_price=5.0),
        # negative price
        PurchaseRecord(material_id="MAT-1", purchase_date=d1, quantity=1, unit_price=-1.0),
        # negative cost
        MaterialCost(material_id="MAT-1", version=9, effective_from=d1, standard_cost=-1.0),
        # period ends before it starts
        VarianceInput(material_id="MAT-1", period_start=d2, period_end=d1),
        # BOM quantity must be positive
        BOMEntry(product_sku="SKU-1", material_id="MAT-1", bom_quantity=0, unit_of_measure="kg"),
        # production needs at least one volume
        ProductionRecord(
            product_sku="SKU-1", period_start=d1, period_end=d2, unit_of_measure="unit"
        ),
        # demand forecast needs a subject
        DemandForecast(period_start=d1, period_end=d2, forecast_quantity=1.0, unit_of_measure="kg"),
        # on-time rate is a 0-1 fraction
        SupplierOperationsMetric(supplier_id="SUP-M1", metric_date=d1, on_time_delivery_rate=1.5),
        # plan needs at least one amount
        FinancialPlanRecord(material_id="MAT-1", period_start=d1, period_end=d2),
        # inventory cannot be negative
        InventoryRecord(material_id="MAT-1", snapshot_date=d1, quantity_on_hand=-5.0),
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("index", range(10))
async def test_invalid_rows_rejected_by_database(db_session: AsyncSession, index: int):
    await _seed_material(db_session)
    db_session.add(_invalid_rows()[index])
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_rows_cannot_reference_unknown_material(db_session: AsyncSession):
    db_session.add(
        PurchaseRecord(
            material_id="MAT-MISSING", purchase_date=date(2026, 1, 1), quantity=1.0, unit_price=1.0
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()
