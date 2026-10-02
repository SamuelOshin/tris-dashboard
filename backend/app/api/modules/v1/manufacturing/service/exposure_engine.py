"""
Financial exposure and what-if scenarios. Pure functions: no database, no clock, no writes.

Exposure (decision D5 and the consolidated instruction, section 5.3):

    baseline_spend     = baseline_unit_cost * expected_usage
    forecast_spend     = forecast_unit_cost * expected_usage
    projected_exposure = forecast_spend - baseline_spend

A scenario adjusts the inputs of that calculation for display only. It reads the stored forecast
values and returns new numbers; it has no way to write them back (see FINANCIAL_EXPOSURE_METHOD.md).
"""

from collections import defaultdict
from datetime import date
from typing import Any

from app.api.modules.v1.manufacturing.service.analytics_types import PurchaseRow
from app.api.modules.v1.manufacturing.service.exposure_types import (
    DAYS_PER_MONTH,
    UNALLOCATED,
    UNASSIGNED,
    ExposureConfig,
    ExposureInput,
    Scenario,
)
from app.api.modules.v1.manufacturing.service.forecast_history import add_months


def usage_window(last_month: date, first_month: date, cfg: ExposureConfig) -> list[date]:
    """The complete calendar months used to estimate usage, oldest first (none before purchases)."""
    months = [add_months(last_month, -i) for i in range(cfg.usage_window_months)]
    return [m for m in reversed(months) if m >= first_month]


def usage_and_supplier_shares(
    purchases: list[PurchaseRow], currency: str | None, window: list[date]
) -> tuple[float, dict[str, float]]:
    """
    Average monthly purchased quantity over the window, and each supplier's share of it.

    Months in the window without purchases count as zero usage (purchasing is lumpy), but months
    before the material's first purchase are not part of the window.
    """
    months = set(window)
    by_supplier: dict[str, float] = defaultdict(float)
    for p in purchases:
        if p.currency == currency and p.purchase_date.replace(day=1) in months:
            by_supplier[p.supplier_id or UNASSIGNED] += p.quantity
    total = sum(by_supplier.values())
    if not window or total <= 0:
        return 0.0, {}
    return total / len(window), {s: q / total for s, q in by_supplier.items()}


def _cover(on_hand: float | None, daily_usage: float, lead: float | None) -> dict[str, Any]:
    """Days the stock lasts against the supplier lead time. None when an input is unknown."""
    if on_hand is None or lead is None:
        return {
            "evaluable": False,
            "cover_days": None,
            "lead_time_days": lead,
            "uncovered_days": 0.0,
            "uncovered_quantity": 0.0,
        }
    cover_days = on_hand / daily_usage if daily_usage > 0 else None
    uncovered = max(0.0, lead - cover_days) if cover_days is not None else 0.0
    return {
        "evaluable": True,
        "cover_days": cover_days,
        "lead_time_days": lead,
        "uncovered_days": uncovered,
        "uncovered_quantity": uncovered * daily_usage,
    }


def _shares(inp: ExposureInput) -> dict[str, dict[str, float]]:
    total_weight = sum(inp.product_weights.values())
    products = (
        {k: w / total_weight for k, w in inp.product_weights.items()}
        if total_weight > 0
        else {UNALLOCATED: 1.0}
    )
    return {
        "supplier": inp.supplier_shares or {UNASSIGNED: 1.0},
        "product": products,
        "category": {inp.category or "Uncategorised": 1.0},
    }


def _forecast_unit(inp: ExposureInput) -> float:
    """Average stored forecast price across the horizon months (the whole window is priced)."""
    values = inp.forecast.path_values
    return sum(values) / len(values) if values else inp.forecast.end_value


def baseline_exposure(inp: ExposureInput) -> dict[str, Any]:
    """Exposure of one material from its stored forecast, with no scenario applied."""
    f = inp.forecast
    usage = inp.monthly_usage * f.horizon_months
    baseline_unit, forecast_unit = f.last_observed_price, _forecast_unit(inp)
    baseline_spend, forecast_spend = baseline_unit * usage, forecast_unit * usage
    exposure = forecast_spend - baseline_spend
    return {
        "material_id": inp.material_id,
        "description": inp.description,
        "category": inp.category,
        "unit_of_measure": inp.unit_of_measure,
        "currency": f.currency,
        "forecast": {
            "run_id": f.run_id,
            "model": f"{f.model_name} v{f.model_version}",
            "horizon_days": f.horizon_days,
            "horizon_months": f.horizon_months,
            "as_of": f.as_of.isoformat(),
            "stored_at": f.created_at,
        },
        "baseline_unit_cost": baseline_unit,
        "forecast_unit_cost": forecast_unit,
        "forecast_end_unit_cost": f.end_value,
        "expected_usage": usage,
        "usage_basis": {
            "method": "trailing_purchases",
            "monthly_usage": inp.monthly_usage,
            "months_used": inp.usage_months,
        },
        "baseline_spend": baseline_spend,
        "forecast_spend": forecast_spend,
        "projected_exposure": exposure,
        "exposure_pct": (exposure / baseline_spend * 100) if baseline_spend else None,
        "supply_cover": _cover(
            inp.inventory_on_hand, inp.monthly_usage / DAYS_PER_MONTH, inp.lead_time_days
        ),
        "shares": _shares(inp),
    }


def apply_scenario(inp: ExposureInput, base: dict[str, Any], s: Scenario) -> dict[str, Any]:
    """
    Recalculate one material's exposure under a scenario.

    The baseline dictionary and the stored forecast are only read. Returns the scenario figures,
    each separated into its cause so the result can be traced.
    """
    supplier_share = inp.supplier_shares.get(s.supplier_id, 0.0) if s.supplier_id else 0.0
    unit = (
        base["forecast_unit_cost"]
        * (1 + s.price_change_pct / 100)
        * (1 + supplier_share * s.supplier_price_change_pct / 100)
    )
    usage = base["expected_usage"] * (1 + s.demand_change_pct / 100)
    price_effect = (unit - base["baseline_unit_cost"]) * usage
    volume_effect = base["baseline_unit_cost"] * (usage - base["expected_usage"])

    on_hand = (
        None
        if inp.inventory_on_hand is None
        else inp.inventory_on_hand * (1 + s.inventory_change_pct / 100)
    )
    lead = None if inp.lead_time_days is None else inp.lead_time_days + s.lead_time_delay_days
    daily = inp.monthly_usage * (1 + s.demand_change_pct / 100) / DAYS_PER_MONTH
    cover = _cover(on_hand, daily, lead)
    # The shortfall cannot exceed what is used in the horizon, however long the delay.
    extra_qty = min(
        max(0.0, cover["uncovered_quantity"] - base["supply_cover"]["uncovered_quantity"]), usage
    )
    premium_cost = extra_qty * unit * s.spot_premium_pct / 100 if cover["evaluable"] else 0.0

    scenario_spend = unit * usage + premium_cost
    exposure = scenario_spend - base["baseline_spend"]
    notes = []
    wants_cover = s.lead_time_delay_days or s.inventory_change_pct or s.spot_premium_pct
    if wants_cover and not cover["evaluable"]:
        notes.append("Supply cover could not be evaluated: no stock snapshot or lead time on file.")
    if s.supplier_id and supplier_share == 0 and s.supplier_price_change_pct:
        notes.append(f"{s.supplier_id} supplied none of this material's recent usage.")
    return {
        "scenario_unit_cost": unit,
        "scenario_usage": usage,
        "price_effect": price_effect,
        "volume_effect": volume_effect,
        "premium_cost": premium_cost,
        "scenario_spend": scenario_spend,
        "scenario_exposure": exposure,
        "change_vs_baseline": exposure - base["projected_exposure"],
        "supply_cover": cover,
        "notes": notes,
    }


BASELINE_METRICS = ("baseline_spend", "forecast_spend", "projected_exposure")
SCENARIO_METRICS = ("scenario_spend", "scenario_exposure", "change_vs_baseline", "premium_cost")


def _metric(row: dict[str, Any], name: str) -> float:
    return row[name] if name in row else row["scenario"][name]


def rollup(rows: list[dict[str, Any]], dimension: str, with_scenario: bool) -> list[dict[str, Any]]:
    """
    Sum material results by supplier, product or category, separately for each currency.

    A material's figures are spread over the dimension by its shares (they add up to 1), so the
    groups always add back to the material total. Currencies are never added together.
    """
    metrics = BASELINE_METRICS + (SCENARIO_METRICS if with_scenario else ())
    sums: dict[str, dict[str, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
    counts: dict[tuple[str, str], int] = defaultdict(int)
    for row in rows:
        currency = row["currency"] or "—"
        for key, share in row["shares"][dimension].items():
            counts[(currency, key)] += 1
            bucket = sums[currency][key]
            for name in metrics:
                bucket[name] = bucket.get(name, 0.0) + _metric(row, name) * share
    result = []
    sort_by = "scenario_exposure" if with_scenario else "projected_exposure"
    for currency in sorted(sums):
        groups = [
            {"key": key, "materials": counts[(currency, key)], **vals}
            for key, vals in sums[currency].items()
        ]
        groups.sort(key=lambda g: g[sort_by], reverse=True)
        total = {name: sum(g[name] for g in groups) for name in metrics}
        result.append({"currency": currency, "groups": groups, "total": total})
    return result
