"""
Small, pure helpers shared by the detectors: monthly price series, standard cost lookup and
percentage change. Everything here works on already date-limited data.
"""

from collections import Counter, defaultdict
from datetime import date, timedelta

from app.api.modules.v1.manufacturing.service.analytics_types import (
    CostRow,
    MonthPoint,
    PurchaseRow,
)


def dominant_currency(purchases: list[PurchaseRow]) -> str | None:
    """The currency most purchase lines use; mixed currencies are never averaged together."""
    if not purchases:
        return None
    return Counter(p.currency for p in purchases).most_common(1)[0][0]


def month_start(day: date) -> date:
    return day.replace(day=1)


def monthly_series(purchases: list[PurchaseRow]) -> list[MonthPoint]:
    """Quantity-weighted average unit price per calendar month, oldest first."""
    buckets: dict[date, list[PurchaseRow]] = defaultdict(list)
    for row in purchases:
        buckets[month_start(row.purchase_date)].append(row)
    series = []
    for month in sorted(buckets):
        rows = buckets[month]
        quantity = sum(r.quantity for r in rows)
        price = sum(r.quantity * r.unit_price for r in rows) / quantity
        series.append(MonthPoint(month, price, quantity))
    return series


def pct_change(new: float, old: float) -> float | None:
    """Percentage change from old to new, or None when old is zero."""
    if old == 0:
        return None
    return (new / old - 1.0) * 100.0


def price_on_or_before(series: list[MonthPoint], day: date) -> MonthPoint | None:
    """Latest monthly point whose month started on or before `day`."""
    eligible = [p for p in series if p.month <= day]
    return eligible[-1] if eligible else None


def standard_cost_on(costs: list[CostRow], day: date, currency: str | None) -> float | None:
    """Standard cost in force on `day` (highest version wins), in the given currency."""
    candidates = [
        c
        for c in costs
        if c.standard_cost is not None
        and c.effective_from <= day
        and (c.effective_to is None or c.effective_to >= day)
        and (currency is None or c.currency == currency)
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda c: (c.effective_from, c.version)).standard_cost


def month_end(month: date) -> date:
    following = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
    return following - timedelta(days=1)


def label(month: date) -> str:
    return month.strftime("%b %Y")
