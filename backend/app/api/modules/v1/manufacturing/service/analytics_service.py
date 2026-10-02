"""
Material-cost analytics service: builds the overview table and the per-material detail from
stored data. Every figure is computed on request from the database; nothing is cached or
hard-coded. Pure business logic — raises domain exceptions directly.
"""

from dataclasses import asdict
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.custom_exceptions.exceptions import NotFoundError, ValidationError
from app.api.modules.v1.manufacturing.service import analytics_loader as loader
from app.api.modules.v1.manufacturing.service.analytics_types import (
    DEFAULT_CONFIG,
    TRIGGERED,
    DetectionConfig,
    Signal,
)
from app.api.modules.v1.manufacturing.service.detection_engine import (
    MaterialResult,
    compute_results,
)
from app.api.modules.v1.manufacturing.service.detectors_exposure import (
    active_bom,
    spend_by_supplier,
)
from app.api.modules.v1.manufacturing.service.price_series import month_end, standard_cost_on

SIGNAL_NAMES: dict[str, str] = {
    "rapid_price_increase": "Rapid price increase",
    "abnormal_price": "Price unusual for this material",
    "standard_cost_deviation": "Paying above standard cost",
    "ppv_trend": "Purchase price variance worsening",
    "procurement_anomaly": "Unusual purchase lines",
    "bom_cost_escalation": "Product material cost rising",
    "supplier_concentration": "Dependence on one supplier",
    "inventory_cost_exposure": "Low stock while prices rise",
    "high_spend": "Among the highest-spend materials",
    "lead_time_deterioration": "Supplier lead time or delivery getting worse",
}
PENDING_CAPABILITIES = ["Cost forecast", "Financial exposure"]


def _signal_dto(signal: Signal, with_details: bool) -> dict[str, Any]:
    dto = {
        "code": signal.code,
        "name": signal.name,
        "status": signal.status,
        "explanation": signal.explanation,
    }
    if with_details:
        dto.update(value=signal.value, threshold=signal.threshold, details=signal.details)
    return dto


def _row_dto(result: MaterialResult) -> dict[str, Any]:
    return {
        "material_id": result.material_id,
        "description": result.description,
        "category": result.category,
        "unit_of_measure": result.unit_of_measure,
        "currency": result.currency,
        "suppliers": result.supplier_ids,
        **result.metrics,
        "triggered_count": len(result.triggered),
        "signals": [_signal_dto(s, with_details=False) for s in result.signals],
        "notes": result.notes,
    }


async def _resolve_as_of(
    session: AsyncSession, as_of: date | None, dataset_id: str | None
) -> date | None:
    return as_of or await loader.latest_purchase_date(session, dataset_id)


def _matches(
    result: MaterialResult,
    category: str | None,
    search: str | None,
    supplier_id: str | None,
    product_sku: str | None,
    signal: str | None,
    products_of: dict[str, set[str]],
) -> bool:
    if category and result.category != category:
        return False
    if supplier_id and supplier_id not in result.supplier_ids:
        return False
    if product_sku and product_sku not in products_of.get(result.material_id, set()):
        return False
    if signal and not any(s.code == signal and s.status == TRIGGERED for s in result.signals):
        return False
    if search:
        needle = search.strip().lower()
        if needle not in result.material_id.lower() and needle not in result.description.lower():
            return False
    return True


async def get_overview(
    session: AsyncSession,
    as_of: date | None = None,
    category: str | None = None,
    search: str | None = None,
    supplier_id: str | None = None,
    product_sku: str | None = None,
    signal: str | None = None,
    dataset_id: str | None = None,
    cfg: DetectionConfig = DEFAULT_CONFIG,
) -> dict[str, Any]:
    """
    Overview of every material with its detection signals.

    Returns a payload with `has_data=False` (and no figures) when no purchases have been
    ingested, so the page can show an honest empty state rather than zeros.
    """
    if signal and signal not in SIGNAL_NAMES:
        raise ValidationError(
            f"Unknown signal '{signal}'. Choose one of: {', '.join(sorted(SIGNAL_NAMES))}."
        )
    effective_as_of = await _resolve_as_of(session, as_of, dataset_id)
    base = {
        "computed_at": datetime.now(UTC).isoformat(),
        "pending_capabilities": PENDING_CAPABILITIES,
        "signal_catalog": [{"code": c, "name": n} for c, n in SIGNAL_NAMES.items()],
        "datasets": await loader.dataset_tags(session),
    }
    if effective_as_of is None:
        return {
            **base,
            "has_data": False,
            "as_of": None,
            "materials": [],
            "summary": None,
            "filter_options": None,
            "thresholds": asdict(cfg),
        }

    first_purchase = await loader.earliest_purchase_date(session, dataset_id)
    if effective_as_of < first_purchase:
        # Data exists, just not yet by this date: say so instead of showing the "no data" state.
        return {
            **base,
            "has_data": True,
            "as_of": effective_as_of.isoformat(),
            "first_purchase_date": first_purchase.isoformat(),
            "materials": [],
            "summary": None,
            "filter_options": None,
            "notice": (
                f"No purchases are recorded on or before {effective_as_of.isoformat()}. "
                f"The earliest purchase is {first_purchase.isoformat()}."
            ),
            "thresholds": asdict(cfg),
        }

    materials, all_bom = await loader.load_material_data(session, effective_as_of, dataset_id)
    results = compute_results(materials, all_bom, effective_as_of, cfg)
    products_of: dict[str, set[str]] = {}
    for line in active_bom(all_bom, effective_as_of):
        products_of.setdefault(line.material_id, set()).add(line.product_sku)

    shown = [
        r
        for r in results
        if _matches(r, category, search, supplier_id, product_sku, signal, products_of)
    ]
    signal_counts = {code: 0 for code in SIGNAL_NAMES}
    for r in shown:
        for s in r.triggered:
            signal_counts[s.code] += 1
    spend_by_currency: dict[str, float] = {}
    for r in shown:
        if r.currency:
            spend_by_currency[r.currency] = (
                spend_by_currency.get(r.currency, 0.0) + r.metrics["spend_window_total"]
            )
    return {
        **base,
        "has_data": True,
        "as_of": effective_as_of.isoformat(),
        "first_purchase_date": first_purchase.isoformat(),
        "notice": None,
        "materials": [_row_dto(r) for r in shown],
        "summary": {
            "materials_total": len(results),
            "materials_shown": len(shown),
            "materials_with_signals": sum(1 for r in shown if r.triggered),
            "signals_by_code": signal_counts,
            "spend_window_days": cfg.spend_window_days,
            # One total only when every material is in the same currency; never a mixed sum.
            "spend_window_total": (
                round(next(iter(spend_by_currency.values())), 2)
                if len(spend_by_currency) == 1
                else None
            ),
            "spend_by_currency": {c: round(v, 2) for c, v in sorted(spend_by_currency.items())},
            "currencies": sorted({r.currency for r in shown if r.currency}),
        },
        "filter_options": {
            "categories": sorted({r.category for r in results if r.category}),
            "suppliers": sorted({s for r in results for s in r.supplier_ids}),
            "products": sorted({p for ps in products_of.values() for p in ps}),
        },
        "thresholds": asdict(cfg),
    }


async def get_material_detail(
    session: AsyncSession,
    material_id: str,
    as_of: date | None = None,
    dataset_id: str | None = None,
    cfg: DetectionConfig = DEFAULT_CONFIG,
) -> dict[str, Any]:
    """Full evidence for one material: every signal with its numbers, series and exposures."""
    effective_as_of = await _resolve_as_of(session, as_of, dataset_id)
    if effective_as_of is None:
        raise NotFoundError("No manufacturing data has been loaded yet.")
    materials, all_bom = await loader.load_material_data(session, effective_as_of, dataset_id)
    results = compute_results(materials, all_bom, effective_as_of, cfg)
    result = next((r for r in results if r.material_id == material_id), None)
    if result is None:
        raise NotFoundError(f"Material '{material_id}' was not found in the analysed data.")
    data = next(m for m in materials if m.material_id == material_id)

    spend, unattributed = spend_by_supplier(
        [p for p in data.purchases if p.currency == result.currency],
        effective_as_of,
        cfg.concentration_window_days,
    )
    total = sum(spend.values())
    return {
        "computed_at": datetime.now(UTC).isoformat(),
        "as_of": effective_as_of.isoformat(),
        **_row_dto(result),
        "signals": [_signal_dto(s, with_details=True) for s in result.signals],
        "price_series": [
            {
                "month": p.month.isoformat(),
                "unit_price": round(p.price, 4),
                "quantity": round(p.quantity, 2),
                "standard_cost": standard_cost_on(data.costs, month_end(p.month), result.currency),
            }
            for p in result.series
        ],
        "supplier_spend": [
            {"supplier_id": s, "spend": round(v, 2), "share_pct": round(v / total * 100, 1)}
            for s, v in sorted(spend.items(), key=lambda kv: -kv[1])
        ]
        if total
        else [],
        "spend_without_supplier": round(unattributed, 2),
        "dataset_ids": result.dataset_ids,
        "pending_capabilities": PENDING_CAPABILITIES,
    }
