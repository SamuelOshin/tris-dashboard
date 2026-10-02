"""
Measures the nine risk-score factors for one material. Pure functions: they receive values that
are already limited to the as-of date and return a `Reading` (a number, or None with the reason).

Nothing is guessed: a factor whose data is missing is `None` and is left out of the score.
"""

from datetime import date
from statistics import pstdev

from app.api.modules.v1.manufacturing.service.analytics_types import BomRow, MonthPoint
from app.api.modules.v1.manufacturing.service.detectors_exposure import active_bom
from app.api.modules.v1.manufacturing.service.forecast_history import add_months
from app.api.modules.v1.manufacturing.service.risk_types import (
    BOM_EXPOSURE,
    DEMAND,
    INVENTORY_COVERAGE,
    LEAD_TIME,
    PREDICTED_INCREASE,
    PRICE_CHANGE,
    STANDARD_COST_DEVIATION,
    SUPPLIER_CONCENTRATION,
    VOLATILITY,
    ForecastRef,
    Reading,
)

VOLATILITY_MIN_CHANGES = 6  # month-to-month changes needed
VOLATILITY_WINDOW = 12  # latest monthly changes used
DEMAND_MIN_POINTS = 6  # monthly points: latest 3 against the 3 before


def _missing(reason: str) -> Reading:
    return Reading(None, reason)


def price_change(metrics: dict) -> Reading:
    value = metrics.get("price_change_3m_pct")
    if value is None:
        return _missing("There is no price from about three months earlier to compare with.")
    direction = "above" if value >= 0 else "below"
    return Reading(
        value,
        f"The latest monthly price is {abs(value):.1f}% {direction} the price three months ago.",
    )


def volatility(series: list[MonthPoint]) -> Reading:
    """Spread of month-to-month price changes. Only consecutive calendar months are compared."""
    changes = [
        (b.price / a.price - 1) * 100
        for a, b in zip(series, series[1:], strict=False)
        if a.price and add_months(a.month, 1) == b.month
    ][-VOLATILITY_WINDOW:]
    if len(changes) < VOLATILITY_MIN_CHANGES:
        return _missing(
            f"Needs {VOLATILITY_MIN_CHANGES} changes between consecutive months of purchases; "
            f"found {len(changes)}."
        )
    value = pstdev(changes)
    return Reading(
        value,
        f"Monthly prices moved by a typical {value:.1f}% from one month to the next "
        f"(over the last {len(changes)} changes).",
    )


def predicted_increase(forecast: ForecastRef | None) -> Reading:
    if forecast is None:
        return _missing("No forecast has been stored for this material and date.")
    direction = "above" if forecast.change_pct >= 0 else "below"
    return Reading(
        forecast.change_pct,
        f"The stored {forecast.horizon_days}-day forecast is {abs(forecast.change_pct):.1f}% "
        f"{direction} the latest price.",
    )


def bom_exposure(
    material_id: str,
    bom: list[BomRow],
    price_of: dict[str, float | None],
    currency_of: dict[str, str | None],
    as_of: date,
) -> Reading:
    """The largest share this material has in the material cost of any product that uses it."""
    lines = active_bom(bom, as_of)
    products = sorted({r.product_sku for r in lines if r.material_id == material_id})
    if not products:
        return _missing("This material is not on any bill of materials.")
    best: tuple[float, str] | None = None
    for sku in products:
        parts = [r for r in lines if r.product_sku == sku]
        prices = [price_of.get(r.material_id) for r in parts]
        currencies = {currency_of.get(r.material_id) for r in parts}
        if any(p is None for p in prices) or len(currencies) != 1:
            continue  # a product cannot be costed with a missing price or mixed currencies
        total = sum(r.bom_quantity * p for r, p in zip(parts, prices, strict=True))
        mine = sum(
            r.bom_quantity * price_of[material_id] for r in parts if r.material_id == material_id
        )
        if total > 0 and (best is None or mine / total > best[0]):
            best = (mine / total, sku)
    if best is None:
        return _missing(
            "No product using this material can be costed: a component price is missing."
        )
    return Reading(
        best[0] * 100,
        f"The material is {best[0] * 100:.0f}% of the material cost of {best[1]}, "
        f"the product where it matters most (of {len(products)} using it).",
    )


def demand_trend(series: list[MonthPoint]) -> Reading:
    """Latest 3 calendar months of purchased quantity against the 3 before. A month without
    purchases counts as zero; the history must reach back to the start of the 6-month window."""
    if not series:
        return _missing("There are no purchases to measure.")
    last = series[-1].month
    months = [add_months(last, -i) for i in range(5, -1, -1)]  # oldest first
    if series[0].month > months[0]:
        return _missing(f"Needs {DEMAND_MIN_POINTS} calendar months of purchase history.")
    quantity = {p.month: p.quantity for p in series}
    earlier = sum(quantity.get(m, 0.0) for m in months[:3]) / 3
    recent = sum(quantity.get(m, 0.0) for m in months[3:]) / 3
    if earlier <= 0:
        return _missing("There were no purchases in the three months before the latest three.")
    value = (recent / earlier - 1) * 100
    direction = "up" if value >= 0 else "down"
    return Reading(
        value,
        f"Purchased quantity over the latest 3 months is {abs(value):.0f}% {direction} "
        "on the 3 months before.",
    )


def supplier_concentration(metrics: dict) -> Reading:
    share, supplier = metrics.get("top_supplier_share_pct"), metrics.get("top_supplier")
    if share is None:
        return _missing("There is no supplier spend in the last year to measure.")
    return Reading(share, f"{supplier} accounts for {share:.0f}% of the spend over the last year.")


def inventory_coverage(metrics: dict) -> Reading:
    days = metrics.get("coverage_days")
    if days is None:
        return _missing("There is no stock level and usage to work out coverage.")
    return Reading(days, f"Current stock covers about {days:.0f} days of usage.")


def lead_time(metrics: dict) -> Reading:
    days = metrics.get("latest_lead_time_days")
    if days is None:
        return _missing("No supplier lead time is on record.")
    return Reading(days, f"The main supplier's latest lead time is {days:.0f} days.")


def standard_cost_deviation(metrics: dict) -> Reading:
    value = metrics.get("vs_standard_pct")
    if value is None:
        return _missing("There is no standard cost in force to compare with.")
    direction = "above" if value >= 0 else "below"
    return Reading(value, f"The latest price is {abs(value):.1f}% {direction} the standard cost.")


def read_all(
    material_id: str,
    metrics: dict,
    series: list[MonthPoint],
    forecast: ForecastRef | None,
    bom: list[BomRow],
    price_of: dict[str, float | None],
    currency_of: dict[str, str | None],
    as_of: date,
) -> dict[str, Reading]:
    """Every factor reading for one material."""
    return {
        PRICE_CHANGE: price_change(metrics),
        VOLATILITY: volatility(series),
        PREDICTED_INCREASE: predicted_increase(forecast),
        BOM_EXPOSURE: bom_exposure(material_id, bom, price_of, currency_of, as_of),
        DEMAND: demand_trend(series),
        SUPPLIER_CONCENTRATION: supplier_concentration(metrics),
        INVENTORY_COVERAGE: inventory_coverage(metrics),
        LEAD_TIME: lead_time(metrics),
        STANDARD_COST_DEVIATION: standard_cost_deviation(metrics),
    }
