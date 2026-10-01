"""
Material-cost detection engine: turns loaded manufacturing data into per-material metrics and
detector signals. Pure and deterministic: the same data, as-of date and thresholds always give
the same result, and nothing here reads the clock or the database.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from app.api.modules.v1.manufacturing.service import detectors_exposure as exposure
from app.api.modules.v1.manufacturing.service import detectors_price as price
from app.api.modules.v1.manufacturing.service.analytics_types import (
    NOT_EVALUABLE,
    TRIGGERED,
    BomRow,
    DetectionConfig,
    MaterialData,
    MonthPoint,
    Signal,
)
from app.api.modules.v1.manufacturing.service.price_series import (
    dominant_currency,
    month_end,
    monthly_series,
    pct_change,
    price_on_or_before,
    standard_cost_on,
)


@dataclass
class MaterialResult:
    """One material's metrics, signals and the evidence series behind them."""

    material_id: str
    description: str
    category: str | None
    unit_of_measure: str
    currency: str | None
    metrics: dict[str, Any] = field(default_factory=dict)
    signals: list[Signal] = field(default_factory=list)
    series: list[MonthPoint] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    supplier_ids: list[str] = field(default_factory=list)
    dataset_ids: list[str] = field(default_factory=list)

    @property
    def triggered(self) -> list[Signal]:
        return [s for s in self.signals if s.status == TRIGGERED]


def _spend(data: MaterialData, currency: str | None, as_of: date, days: int) -> float:
    start = as_of - timedelta(days=days)
    return sum(
        p.quantity * p.unit_price
        for p in data.purchases
        if p.currency == currency and p.purchase_date > start
    )


def _metrics(
    data: MaterialData,
    series: list[MonthPoint],
    currency: str | None,
    as_of: date,
    position: dict | None,
    cfg: DetectionConfig,
) -> dict[str, Any]:
    latest = series[-1] if series else None
    prev = series[-2] if len(series) > 1 else None
    then = price_on_or_before(series, as_of - timedelta(days=90))
    std = standard_cost_on(data.costs, month_end(latest.month), currency) if latest else None
    spend_by_supplier, _ = exposure.spend_by_supplier(
        [p for p in data.purchases if p.currency == currency], as_of, cfg.concentration_window_days
    )
    total = sum(spend_by_supplier.values())
    top = max(spend_by_supplier.items(), key=lambda kv: kv[1]) if spend_by_supplier else None
    top_ops = sorted(
        (
            o
            for o in data.ops
            if o.lead_time_days is not None and (top is None or o.supplier_id == top[0])
        ),
        key=lambda o: o.metric_date,
    )
    change_1m = pct_change(latest.price, prev.price) if latest and prev else None
    change_3m = pct_change(latest.price, then.price) if latest and then else None
    vs_std = pct_change(latest.price, std) if latest and std else None

    def rounded(value: float | None, digits: int) -> float | None:
        return None if value is None else round(value, digits)

    return {
        "latest_price": rounded(latest.price if latest else None, 4),
        "latest_price_month": latest.month.isoformat() if latest else None,
        "price_change_1m_pct": rounded(change_1m, 2),
        "price_change_3m_pct": rounded(change_3m, 2),
        "standard_cost": rounded(std, 4),
        "vs_standard_pct": rounded(vs_std, 2),
        "history_months": len(series),
        "purchase_lines": len(data.purchases),
        "top_supplier": top[0] if top else None,
        "top_supplier_share_pct": rounded(top[1] / total * 100, 1) if top and total else None,
        "coverage_days": position["coverage_days"] if position else None,
        "inventory_value": position["inventory_value"] if position else None,
        "latest_lead_time_days": top_ops[-1].lead_time_days if top_ops else None,
        "bom_product_count": len({b.product_sku for b in exposure.active_bom(data.bom, as_of)}),
    }


def _notes(data: MaterialData, currency: str | None) -> list[str]:
    notes = []
    others = sorted({p.currency for p in data.purchases if p.currency != currency})
    if others:
        count = sum(1 for p in data.purchases if p.currency != currency)
        notes.append(
            f"{count} purchase line(s) in {', '.join(others)} were left out because this "
            f"material is mostly bought in {currency}; currencies are never mixed or converted."
        )
    if not data.purchases:
        notes.append("No purchases on record up to this date.")
    return notes


def compute_results(
    materials: list[MaterialData], all_bom: list[BomRow], as_of: date, cfg: DetectionConfig
) -> list[MaterialResult]:
    """
    Run every detector for every material.

    Args:
        materials: Material data, already limited to business dates up to `as_of`.
        all_bom: Every bill-of-materials line (products need all their components).
        as_of: The date the analysis describes; nothing later is used.
        cfg: Detector thresholds.

    Returns:
        One MaterialResult per material, in the order given.
    """
    prepared = {}
    for m in materials:
        currency = dominant_currency(m.purchases)
        in_currency = [p for p in m.purchases if p.currency == currency]
        prepared[m.material_id] = (currency, in_currency, monthly_series(in_currency))
    series_by_material = {mid: series for mid, (_, _, series) in prepared.items()}
    spends = {
        m.material_id: _spend(m, prepared[m.material_id][0], as_of, cfg.spend_window_days)
        for m in materials
    }
    currency_of = {mid: cur for mid, (cur, _, _) in prepared.items()}
    # Spend is only ever ranked and shared against materials bought in the same currency.
    ranked_by_currency: dict[str | None, list[str]] = {}
    totals: dict[str | None, float] = {}
    for mid, amount in sorted(spends.items(), key=lambda kv: -kv[1]):
        if amount > 0:
            ranked_by_currency.setdefault(currency_of[mid], []).append(mid)
            totals[currency_of[mid]] = totals.get(currency_of[mid], 0.0) + amount

    results = []
    for m in materials:
        currency, in_currency, series = prepared[m.material_id]
        position = exposure.inventory_position(m.inventory, in_currency, as_of, cfg)
        pool = ranked_by_currency.get(currency, [])
        rank = pool.index(m.material_id) + 1 if m.material_id in pool else None
        total_spend = totals.get(currency, 0.0)
        signals = [
            price.rapid_price_increase(series, cfg),
            price.abnormal_price(series, cfg),
            price.standard_cost_deviation(m, series, currency, cfg),
            price.ppv_trend(m, series, currency, cfg),
            price.procurement_anomalies(in_currency, as_of, cfg),
            exposure.bom_cost_escalation(
                m.material_id, all_bom, series_by_material, as_of, cfg, currency_of
            ),
            exposure.supplier_concentration(in_currency, as_of, cfg),
            exposure.inventory_cost_exposure(position, series, as_of, cfg),
            exposure.high_spend(spends[m.material_id], rank or 0, len(pool), total_spend, cfg)
            if rank
            else Signal(
                "high_spend",
                "Among the highest-spend materials",
                NOT_EVALUABLE,
                "No purchases in the last year to rank.",
            ),
            exposure.lead_time_deterioration(m.ops, as_of, cfg),
        ]
        metrics = _metrics(m, series, currency, as_of, position, cfg)
        metrics["spend_window_total"] = round(spends[m.material_id], 2)
        metrics["spend_share_pct"] = (
            round(spends[m.material_id] / total_spend * 100, 2) if total_spend > 0 else None
        )
        results.append(
            MaterialResult(
                material_id=m.material_id,
                description=m.description,
                category=m.category,
                unit_of_measure=m.unit_of_measure,
                currency=currency,
                metrics=metrics,
                signals=signals,
                series=series,
                notes=_notes(m, currency),
                supplier_ids=sorted({p.supplier_id for p in m.purchases if p.supplier_id}),
                dataset_ids=sorted(m.dataset_ids),
            )
        )
    return results
