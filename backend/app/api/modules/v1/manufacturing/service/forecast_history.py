"""
Forecast history preparation and the no-hindsight guard (decision D5).

The guard sits at the entry to every fit and forecast: a point dated after the cutoff is
rejected outright, never trimmed silently. A caller that builds its series wrongly therefore
fails loudly instead of producing a forecast that has seen the future.
"""

import hashlib
import json
from datetime import date

from app.api.core.custom_exceptions.exceptions import DataLeakageError
from app.api.modules.v1.manufacturing.service.analytics_types import MonthPoint
from app.api.modules.v1.manufacturing.service.forecast_types import HistoryPoint


def _next_month(day: date) -> date:
    return date(day.year + (day.month == 12), day.month % 12 + 1, 1)


def assert_no_leakage(points: list[MonthPoint] | list[HistoryPoint], cutoff: date) -> None:
    """
    Reject any history point dated after the cutoff.

    Raises:
        DataLeakageError: If a point's month starts after the cutoff date.
    """
    leaked = [p.month for p in points if p.month > cutoff]
    if leaked:
        raise DataLeakageError(
            f"{len(leaked)} data point(s) dated after the cutoff {cutoff.isoformat()} were "
            f"offered to the model (first: {min(leaked).isoformat()}). Data from after the cutoff "
            "must never be used to fit or forecast."
        )


def trailing_consecutive_run(points: list[MonthPoint]) -> list[HistoryPoint]:
    """
    The latest unbroken run of calendar months. A missing month ends the run: gaps are never
    filled with invented values, so only the unbroken recent stretch is used.
    """
    ordered = sorted(points, key=lambda p: p.month)
    run: list[HistoryPoint] = []
    for point in reversed(ordered):
        if run and _next_month(point.month) != run[0].month:
            break
        run.insert(0, HistoryPoint(point.month, point.price))
    return run


def dataset_version(points: list[HistoryPoint], cutoff: date, currency: str | None) -> str:
    """Fingerprint of exactly the data a forecast saw, so a run can be reproduced and compared."""
    payload = json.dumps(
        {
            "cutoff": cutoff.isoformat(),
            "currency": currency,
            "series": [(p.month.isoformat(), round(p.price, 8)) for p in points],
        },
        sort_keys=True,
    )
    return "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def add_months(day: date, count: int) -> date:
    """First day of the month `count` months after the month of `day`."""
    month_index = day.year * 12 + (day.month - 1) + count
    return date(month_index // 12, month_index % 12 + 1, 1)
