"""
Exposure-based detectors: BOM cost escalation, supplier concentration, inventory coverage under
rising prices, high spend, and lead-time / delivery deterioration.

Same contract as detectors_price: one Signal each, `not_evaluable` when the data is missing.
"""

import math
import statistics
from collections import defaultdict
from datetime import date, timedelta

from app.api.modules.v1.manufacturing.service.analytics_types import (
    CLEAR,
    NOT_EVALUABLE,
    TRIGGERED,
    BomRow,
    DetectionConfig,
    InventoryRow,
    MonthPoint,
    OpsRow,
    PurchaseRow,
    Signal,
)
from app.api.modules.v1.manufacturing.service.price_series import pct_change, price_on_or_before


def _no_data(code: str, name: str, reason: str) -> Signal:
    return Signal(code, name, NOT_EVALUABLE, reason)


def active_bom(rows: list[BomRow], as_of: date) -> list[BomRow]:
    """BOM lines valid on the as-of date (open-ended dates count as valid)."""
    return [
        r
        for r in rows
        if (r.effective_from is None or r.effective_from <= as_of)
        and (r.effective_to is None or r.effective_to >= as_of)
    ]


def bom_cost_escalation(
    material_id: str,
    all_bom: list[BomRow],
    series_by_material: dict[str, list[MonthPoint]],
    as_of: date,
    cfg: DetectionConfig,
    currency_of: dict[str, str | None] | None = None,
) -> Signal:
    code, name = "bom_cost_escalation", "Product material cost rising"
    lines = active_bom(all_bom, as_of)
    mine = [r for r in lines if r.material_id == material_id]
    if not mine:
        return _no_data(code, name, "This material is not on any bill of materials.")
    then = as_of - timedelta(days=cfg.bom_window_days)
    by_product: dict[str, list[BomRow]] = defaultdict(list)
    for r in lines:
        by_product[r.product_sku].append(r)

    products, incomplete, mixed_currency = [], 0, 0
    for sku in sorted({r.product_sku for r in mine}):
        if (
            currency_of is not None
            and len({currency_of.get(r.material_id) for r in by_product[sku]}) > 1
        ):
            mixed_currency += 1  # components priced in different currencies cannot be added up
            continue
        costs_now, costs_then = {}, {}
        for r in by_product[sku]:
            series = series_by_material.get(r.material_id, [])
            now_p, then_p = price_on_or_before(series, as_of), price_on_or_before(series, then)
            if now_p is None or then_p is None:
                break
            costs_now[r.material_id] = r.bom_quantity * now_p.price
            costs_then[r.material_id] = r.bom_quantity * then_p.price
        else:
            total_now, total_then = sum(costs_now.values()), sum(costs_then.values())
            change = pct_change(total_now, total_then)
            rise = total_now - total_then
            share = (costs_now[material_id] - costs_then[material_id]) / rise if rise > 0 else 0.0
            products.append(
                {
                    "product_sku": sku,
                    "description": next(
                        (r.product_description for r in by_product[sku] if r.product_description),
                        None,
                    ),
                    "unit_cost_now": round(total_now, 4),
                    "unit_cost_before": round(total_then, 4),
                    "change_pct": None if change is None else round(change, 2),
                    "material_share_of_rise": round(share, 3),
                    "material_unit_cost": round(costs_now[material_id], 4),
                    "triggered": change is not None
                    and change >= cfg.bom_escalation_pct
                    and share >= cfg.bom_contribution_share,
                }
            )
            continue
        incomplete += 1  # a component had no price history
    if not products:
        return _no_data(
            code,
            name,
            "Every product using this material has a component with no price history"
            + (" or is priced in mixed currencies." if mixed_currency else "."),
        )
    hits = [p for p in products if p["triggered"]]
    if hits:
        worst = max(hits, key=lambda p: p["change_pct"])
        text = (
            f"Material cost of {worst['product_sku']} rose {worst['change_pct']:.1f}% over "
            f"{cfg.bom_window_days} days, and this material accounts for "
            f"{worst['material_share_of_rise'] * 100:.0f}% of the rise."
        )
    else:
        text = (
            f"No product using this material rose {cfg.bom_escalation_pct:g}% or more over "
            f"{cfg.bom_window_days} days with this material driving it."
        )
    return Signal(
        code,
        name,
        TRIGGERED if hits else CLEAR,
        text,
        max((p["change_pct"] or 0.0 for p in products), default=None),
        cfg.bom_escalation_pct,
        {
            "products": products,
            "products_skipped_incomplete_prices": incomplete,
            "products_skipped_mixed_currency": mixed_currency,
        },
    )


def spend_by_supplier(
    purchases: list[PurchaseRow], as_of: date, window_days: int
) -> tuple[dict[str, float], float]:
    """(spend per supplier, spend with no supplier recorded) over the trailing window."""
    start = as_of - timedelta(days=window_days)
    spend: dict[str, float] = defaultdict(float)
    unattributed = 0.0
    for p in purchases:
        if p.purchase_date <= start:
            continue
        amount = p.quantity * p.unit_price
        if p.supplier_id:
            spend[p.supplier_id] += amount
        else:
            unattributed += amount
    return dict(spend), unattributed


def supplier_concentration(
    purchases: list[PurchaseRow], as_of: date, cfg: DetectionConfig
) -> Signal:
    code, name = "supplier_concentration", "Dependence on one supplier"
    spend, unattributed = spend_by_supplier(purchases, as_of, cfg.concentration_window_days)
    total = sum(spend.values())
    if total <= 0:
        return _no_data(code, name, "No purchases with a supplier in the last year.")
    shares = {s: v / total for s, v in spend.items()}
    top_supplier, top_share = max(shares.items(), key=lambda kv: kv[1])
    hhi = sum(v * v for v in shares.values())
    triggered = top_share >= cfg.concentration_top_share
    count = len(shares)
    text = (
        f"{top_supplier} supplies {top_share * 100:.0f}% of the last year's spend "
        f"({count} supplier{'s' if count != 1 else ''}); the limit is "
        f"{cfg.concentration_top_share * 100:.0f}%."
    )
    return Signal(
        code,
        name,
        TRIGGERED if triggered else CLEAR,
        text,
        round(top_share * 100, 1),
        cfg.concentration_top_share * 100,
        {
            "top_supplier": top_supplier,
            "shares": {s: round(v, 4) for s, v in sorted(shares.items())},
            "hhi": round(hhi, 4),
            "spend_without_supplier": round(unattributed, 2),
        },
    )


def inventory_position(
    inventory: list[InventoryRow], purchases: list[PurchaseRow], as_of: date, cfg: DetectionConfig
) -> dict | None:
    """Latest stock and how many days it lasts at the recent purchase rate (a usage proxy)."""
    if not inventory:
        return None
    latest = max(inventory, key=lambda r: r.snapshot_date)
    start = as_of - timedelta(days=cfg.usage_window_days)
    bought = sum(p.quantity for p in purchases if p.purchase_date > start)
    per_day = bought / cfg.usage_window_days
    if latest.days_of_supply is not None:
        coverage, source = latest.days_of_supply, "reported by the source"
    elif per_day > 0:
        coverage, source = (
            latest.quantity_on_hand / per_day,
            "stock divided by recent purchase rate",
        )
    else:
        coverage, source = None, "no recent purchases to estimate usage"
    return {
        "snapshot_date": latest.snapshot_date.isoformat(),
        "quantity_on_hand": latest.quantity_on_hand,
        "inventory_value": latest.inventory_value,
        "coverage_days": None if coverage is None else round(coverage, 1),
        "coverage_source": source,
        "usage_per_day": round(per_day, 4),
    }


def inventory_cost_exposure(
    position: dict | None, series: list[MonthPoint], as_of: date, cfg: DetectionConfig
) -> Signal:
    code, name = "inventory_cost_exposure", "Low stock while prices rise"
    if position is None:
        return _no_data(code, name, "No inventory position has been loaded for this material.")
    coverage = position["coverage_days"]
    if coverage is None:
        return _no_data(code, name, "Stock coverage cannot be estimated without recent purchases.")
    now_p = price_on_or_before(series, as_of)
    then_p = price_on_or_before(series, as_of - timedelta(days=90))
    rise = pct_change(now_p.price, then_p.price) if now_p and then_p else None
    if rise is None:
        return _no_data(code, name, "Needs a price from about 90 days ago to measure the trend.")
    triggered = coverage < cfg.low_coverage_days and rise >= cfg.inventory_price_rise_pct
    text = (
        f"Stock covers {coverage:.0f} days (below {cfg.low_coverage_days:g}) while the price "
        f"is up {rise:.1f}% over about 90 days, so replacement will cost more."
        if triggered
        else f"Stock covers {coverage:.0f} days and the price moved {rise:+.1f}% over about 90 "
        f"days; the signal needs under {cfg.low_coverage_days:g} days and "
        f"+{cfg.inventory_price_rise_pct:g}% or more."
    )
    return Signal(
        code,
        name,
        TRIGGERED if triggered else CLEAR,
        text,
        coverage,
        cfg.low_coverage_days,
        {**position, "price_change_90d_pct": round(rise, 2)},
    )


def high_spend(spend: float, rank: int, ranked: int, total: float, cfg: DetectionConfig) -> Signal:
    code, name = "high_spend", "Among the highest-spend materials"
    if ranked < cfg.high_spend_min_materials:
        return _no_data(
            code,
            name,
            f"Needs at least {cfg.high_spend_min_materials} materials with purchases to rank "
            f"spend; found {ranked}.",
        )
    cutoff = max(1, math.ceil(ranked * cfg.high_spend_top_fraction))
    share = spend / total if total > 0 else 0.0
    triggered = rank <= cutoff
    text = (
        f"Ranks {rank} of {ranked} by last-year spend ({share * 100:.1f}% of the total); the top "
        f"{cutoff} are flagged."
    )
    return Signal(
        code,
        name,
        TRIGGERED if triggered else CLEAR,
        text,
        round(share * 100, 2),
        None,
        {"rank": rank, "ranked_materials": ranked, "spend": round(spend, 2)},
    )


def _window_means(
    rows: list[OpsRow], attr: str, as_of: date, days: int
) -> tuple[float | None, int, float | None, int]:
    recent_start, prior_start = as_of - timedelta(days=days), as_of - timedelta(days=2 * days)
    recent = [getattr(r, attr) for r in rows if recent_start < r.metric_date <= as_of]
    prior = [getattr(r, attr) for r in rows if prior_start < r.metric_date <= recent_start]
    recent = [v for v in recent if v is not None]
    prior = [v for v in prior if v is not None]
    mean = statistics.fmean
    return (
        mean(recent) if recent else None,
        len(recent),
        mean(prior) if prior else None,
        len(prior),
    )


def _supplier_changes(
    rows: list[OpsRow], as_of: date, cfg: DetectionConfig
) -> tuple[list[str], bool]:
    """Describe lead-time and on-time changes for one supplier; True if either got worse."""
    parts, worse = [], False
    r_mean, r_n, p_mean, p_n = _window_means(rows, "lead_time_days", as_of, cfg.ops_window_days)
    if min(r_n, p_n) >= cfg.ops_min_points:
        change = pct_change(r_mean, p_mean)
        if change is not None:
            parts.append(f"lead time {p_mean:.1f} → {r_mean:.1f} days ({change:+.0f}%)")
            worse = worse or change >= cfg.lead_time_increase_pct
    r_mean, r_n, p_mean, p_n = _window_means(
        rows, "on_time_delivery_rate", as_of, cfg.ops_window_days
    )
    if min(r_n, p_n) >= cfg.ops_min_points:
        parts.append(f"on-time delivery {p_mean * 100:.0f}% → {r_mean * 100:.0f}%")
        worse = worse or (p_mean - r_mean) >= cfg.otd_drop
    return parts, worse


def lead_time_deterioration(ops: list[OpsRow], as_of: date, cfg: DetectionConfig) -> Signal:
    """
    Checked supplier by supplier, so a stable supplier cannot hide a deteriorating one.
    Triggered if any supplier's lead time rose, or its on-time delivery fell, past the limits.
    """
    code, name = "lead_time_deterioration", "Supplier lead time or delivery getting worse"
    if not ops:
        return _no_data(code, name, "No supplier operations data has been loaded.")
    by_supplier: dict[str, list[OpsRow]] = defaultdict(list)
    for row in ops:
        by_supplier[row.supplier_id].append(row)
    findings = []
    for supplier in sorted(by_supplier):
        parts, worse = _supplier_changes(by_supplier[supplier], as_of, cfg)
        if parts:
            findings.append({"supplier_id": supplier, "worse": worse, "changes": parts})
    if not findings:
        return _no_data(
            code,
            name,
            f"Needs {cfg.ops_min_points} readings in each of the last two "
            f"{cfg.ops_window_days}-day periods for at least one supplier.",
        )
    worse_ones = [f for f in findings if f["worse"]]
    chosen = worse_ones or findings
    described = "; ".join(f"{f['supplier_id']} {', '.join(f['changes'])}" for f in chosen)
    count = len(findings)
    text = (
        f"Worse: {described}."
        if worse_ones
        else f"Stable across {count} supplier{'s' if count != 1 else ''}: {described}."
    )
    return Signal(
        code,
        name,
        TRIGGERED if worse_ones else CLEAR,
        text,
        float(len(worse_ones)),
        None,
        {"suppliers": findings},
    )
