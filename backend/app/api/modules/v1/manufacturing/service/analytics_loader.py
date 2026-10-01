"""
Loads manufacturing records from the database into the plain containers the detectors use.

Only rows dated on or before the as-of date are loaded (business dates: purchase date,
snapshot date, period end, effective-from). This keeps every figure reproducible for a given
date and means later data cannot influence an earlier analysis.
"""

from datetime import date

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.manufacturing.models import (
    BOMEntry,
    InventoryRecord,
    Material,
    MaterialCost,
    PurchaseRecord,
    SupplierOperationsMetric,
    VarianceInput,
)
from app.api.modules.v1.manufacturing.service.analytics_types import (
    BomRow,
    CostRow,
    InventoryRow,
    MaterialData,
    OpsRow,
    PurchaseRow,
    VarianceRow,
)


async def latest_purchase_date(session: AsyncSession, dataset_id: str | None) -> date | None:
    stmt = select(func.max(PurchaseRecord.purchase_date))
    if dataset_id:
        stmt = stmt.where(PurchaseRecord.dataset_id == dataset_id)
    return (await session.execute(stmt)).scalar_one()


async def earliest_purchase_date(session: AsyncSession, dataset_id: str | None) -> date | None:
    stmt = select(func.min(PurchaseRecord.purchase_date))
    if dataset_id:
        stmt = stmt.where(PurchaseRecord.dataset_id == dataset_id)
    return (await session.execute(stmt)).scalar_one()


async def dataset_tags(session: AsyncSession) -> list[str]:
    """Dataset names used on stored purchase lines (for the filter list)."""
    rows = await session.execute(
        select(PurchaseRecord.dataset_id).where(PurchaseRecord.dataset_id.is_not(None)).distinct()
    )
    return sorted(r[0] for r in rows.fetchall())


def _scoped(stmt, model, dataset_id: str | None):
    return stmt.where(model.dataset_id == dataset_id) if dataset_id else stmt


async def load_material_data(
    session: AsyncSession, as_of: date, dataset_id: str | None
) -> tuple[list[MaterialData], list[BomRow]]:
    """
    Load every material with its records up to `as_of`.

    With a dataset filter, only materials that have purchases in that dataset are returned
    and only that dataset's records are used.
    """
    materials = {
        m.material_id: MaterialData(m.material_id, m.description, m.category, m.unit_of_measure)
        for m in (await session.execute(select(Material).order_by(Material.material_id)))
        .scalars()
        .all()
    }

    purchases = await session.execute(
        _scoped(
            select(PurchaseRecord).where(PurchaseRecord.purchase_date <= as_of),
            PurchaseRecord,
            dataset_id,
        )
    )
    for p in purchases.scalars():
        data = materials.get(p.material_id)
        if data is None:
            continue
        data.purchases.append(
            PurchaseRow(
                p.purchase_date,
                p.quantity,
                p.unit_price,
                p.supplier_id,
                p.purchase_reference,
                p.currency,
            )
        )
        if p.dataset_id:
            data.dataset_ids.add(p.dataset_id)

    costs = await session.execute(
        _scoped(
            select(MaterialCost).where(MaterialCost.effective_from <= as_of),
            MaterialCost,
            dataset_id,
        )
    )
    for c in costs.scalars():
        if c.material_id in materials:
            materials[c.material_id].costs.append(
                CostRow(c.version, c.effective_from, c.effective_to, c.standard_cost, c.currency)
            )

    variances = await session.execute(
        _scoped(
            select(VarianceInput).where(VarianceInput.period_end <= as_of),
            VarianceInput,
            dataset_id,
        )
    )
    for v in variances.scalars():
        if v.material_id in materials:
            materials[v.material_id].variances.append(
                VarianceRow(
                    v.period_start,
                    v.period_end,
                    v.standard_price,
                    v.actual_price,
                    v.quantity_purchased,
                    v.reported_ppv_amount,
                )
            )

    inventory = await session.execute(
        _scoped(
            select(InventoryRecord).where(InventoryRecord.snapshot_date <= as_of),
            InventoryRecord,
            dataset_id,
        )
    )
    for i in inventory.scalars():
        if i.material_id in materials:
            materials[i.material_id].inventory.append(
                InventoryRow(
                    i.snapshot_date, i.quantity_on_hand, i.inventory_value, i.days_of_supply
                )
            )

    await _attach_operations(session, materials, as_of, dataset_id)

    bom_rows = await session.execute(_scoped(select(BOMEntry), BOMEntry, dataset_id))
    all_bom = [
        BomRow(
            b.product_sku,
            b.product_description,
            b.material_id,
            b.bom_quantity,
            b.unit_of_measure,
            b.effective_from,
            b.effective_to,
        )
        for b in bom_rows.scalars()
    ]
    for row in all_bom:
        if row.material_id in materials:
            materials[row.material_id].bom.append(row)

    loaded = list(materials.values())
    if dataset_id:
        loaded = [m for m in loaded if m.purchases]
    return loaded, all_bom


async def _attach_operations(
    session: AsyncSession, materials: dict[str, MaterialData], as_of: date, dataset_id: str | None
) -> None:
    """Supplier operations apply to a material directly, or through the suppliers it buys from."""
    # Suppliers come from dated purchase lines only. The material-supplier link table carries no
    # business date, so using it could let a later link influence an earlier analysis.
    suppliers_of: dict[str, set[str]] = {
        data.material_id: {p.supplier_id for p in data.purchases if p.supplier_id}
        for data in materials.values()
    }

    rows = await session.execute(
        _scoped(
            select(SupplierOperationsMetric).where(SupplierOperationsMetric.metric_date <= as_of),
            SupplierOperationsMetric,
            dataset_id,
        )
    )
    for r in rows.scalars():
        ops = OpsRow(r.metric_date, r.supplier_id, r.lead_time_days, r.on_time_delivery_rate)
        for material_id, data in materials.items():
            if r.material_id == material_id or (
                r.material_id is None and r.supplier_id in suppliers_of[material_id]
            ):
                data.ops.append(ops)
