"""
Price-based detectors: abrupt movement, abnormal level, persistent deviation from standard
cost, purchase price variance trend, and unusual single purchase lines.

Each detector takes a material's data (already limited to dates up to the as-of date) and
returns one Signal. A detector that lacks the data it needs returns `not_evaluable` with the
reason; it never reports "clear" on missing evidence.
"""

import math
import statistics
from datetime import date, timedelta

from app.api.modules.v1.manufacturing.service.analytics_types import (
    CLEAR,
    NOT_EVALUABLE,
    TRIGGERED,
    DetectionConfig,
    MaterialData,
    MonthPoint,
    PurchaseRow,
    Signal,
)
from app.api.modules.v1.manufacturing.service.price_series import (
    label,
    month_end,
    pct_change,
    standard_cost_on,
)


def _no_data(code: str, name: str, reason: str) -> Signal:
    return Signal(code, name, NOT_EVALUABLE, reason)


def rapid_price_increase(series: list[MonthPoint], cfg: DetectionConfig) -> Signal:
    code, name = "rapid_price_increase", "Rapid price increase"
    if len(series) < 2:
        return _no_data(code, name, "Needs purchases in at least two different months.")
    prev, last = series[-2], series[-1]
    change = pct_change(last.price, prev.price)
    if change is None:
        return _no_data(code, name, "The earlier price is zero, so a change cannot be measured.")
    detail = f"{label(prev.month)} {prev.price:,.4f} to {label(last.month)} {last.price:,.4f}"
    triggered = change >= cfg.rapid_increase_pct
    text = (
        f"Price rose {change:.1f}% ({detail}), above the {cfg.rapid_increase_pct:g}% limit."
        if triggered
        else f"Price moved {change:+.1f}% ({detail}), within the {cfg.rapid_increase_pct:g}% limit."
    )
    return Signal(
        code,
        name,
        TRIGGERED if triggered else CLEAR,
        text,
        round(change, 2),
        cfg.rapid_increase_pct,
        {"from_month": prev.month.isoformat(), "to_month": last.month.isoformat()},
    )


def abnormal_price(series: list[MonthPoint], cfg: DetectionConfig) -> Signal:
    code, name = "abnormal_price", "Price unusual for this material"
    history = [p.price for p in series[:-1]][-cfg.zscore_window :]
    if len(history) < cfg.zscore_min_history:
        return _no_data(
            code,
            name,
            f"Needs {cfg.zscore_min_history} earlier months of purchases; found {len(history)}.",
        )
    mean, spread = statistics.fmean(history), statistics.pstdev(history)
    latest = series[-1]
    if spread == 0:
        zscore = 0.0 if latest.price == mean else (math.inf if latest.price > mean else -math.inf)
    else:
        zscore = (latest.price - mean) / spread
    triggered = zscore >= cfg.zscore_threshold
    if math.isinf(zscore):
        shown = "far above" if zscore > 0 else "far below"
    else:
        shown = f"{zscore:.1f} standard deviations from"
    text = (
        f"{label(latest.month)} price {latest.price:,.4f} is {shown} the recent average "
        f"{mean:,.4f}; the limit is {cfg.zscore_threshold:g}."
    )
    return Signal(
        code,
        name,
        TRIGGERED if triggered else CLEAR,
        text,
        None if math.isinf(zscore) else round(zscore, 2),
        cfg.zscore_threshold,
        {"history_months": len(history), "history_mean": round(mean, 4)},
    )


def standard_cost_deviation(
    data: MaterialData, series: list[MonthPoint], currency: str | None, cfg: DetectionConfig
) -> Signal:
    code, name = "standard_cost_deviation", "Paying above standard cost"
    n = cfg.standard_persistence_months
    if not data.costs:
        return _no_data(code, name, "No standard cost has been loaded for this material.")
    recent = series[-n:]
    if len(recent) < n:
        return _no_data(code, name, f"Needs purchases in {n} months; found {len(recent)}.")
    rows = []
    for point in recent:
        std = standard_cost_on(data.costs, month_end(point.month), currency)
        if std is None or std == 0:
            return _no_data(
                code, name, f"No standard cost applies for {label(point.month)} in this currency."
            )
        rows.append((point, std, pct_change(point.price, std) or 0.0))
    latest_dev = rows[-1][2]
    triggered = all(dev >= cfg.standard_deviation_pct for _, _, dev in rows)
    trail = ", ".join(f"{label(p.month)} {dev:+.1f}%" for p, _, dev in rows)
    text = (
        f"Actual price has been at least {cfg.standard_deviation_pct:g}% above standard cost "
        f"for {n} months in a row ({trail})."
        if triggered
        else f"Actual versus standard cost over the last {n} months: {trail}; "
        f"the limit is +{cfg.standard_deviation_pct:g}% in every month."
    )
    return Signal(
        code,
        name,
        TRIGGERED if triggered else CLEAR,
        text,
        round(latest_dev, 2),
        cfg.standard_deviation_pct,
        {
            "months": [
                {"month": p.month.isoformat(), "standard": s, "pct": round(d, 2)}
                for p, s, d in rows
            ]
        },
    )


def _ppv_periods(data: MaterialData, series: list[MonthPoint], currency: str | None):
    """PPV per period: as reported, else from prices, else derived from purchases."""
    out = []
    for v in sorted(data.variances, key=lambda r: r.period_end):
        if v.reported_ppv_amount is not None:
            out.append((v.period_end, v.reported_ppv_amount))
        elif None not in (v.actual_price, v.standard_price, v.quantity_purchased):
            out.append((v.period_end, (v.actual_price - v.standard_price) * v.quantity_purchased))
    if out:
        return out, "reported"
    for point in series:
        std = standard_cost_on(data.costs, month_end(point.month), currency)
        if std is not None:
            out.append((point.month, (point.price - std) * point.quantity))
    return out, "derived from purchases and standard cost"


def ppv_trend(
    data: MaterialData, series: list[MonthPoint], currency: str | None, cfg: DetectionConfig
) -> Signal:
    code, name = "ppv_trend", "Purchase price variance worsening"
    periods, source = _ppv_periods(data, series, currency)
    if len(periods) < cfg.ppv_min_periods:
        return _no_data(
            code, name, f"Needs {cfg.ppv_min_periods} periods of variance; found {len(periods)}."
        )
    last = [amount for _, amount in periods[-cfg.ppv_min_periods :]]
    rising = all(b > a for a, b in zip(last, last[1:], strict=False)) and last[-1] > 0
    trail = " → ".join(f"{amount:,.0f}" for amount in last)
    text = (
        f"Variance above standard has grown in each of the last {len(last)} periods ({trail}; "
        f"{source})."
        if rising
        else f"Variance over the last {len(last)} periods: {trail} ({source}); not a rising "
        "overspend."
    )
    return Signal(
        code,
        name,
        TRIGGERED if rising else CLEAR,
        text,
        round(last[-1], 2),
        None,
        {"source": source, "amounts": [round(a, 2) for a in last]},
    )


def procurement_anomalies(
    purchases: list[PurchaseRow], as_of: date, cfg: DetectionConfig
) -> Signal:
    code, name = "procurement_anomaly", "Unusual purchase lines"
    cutoff = as_of - timedelta(days=cfg.outlier_lookback_days)
    history = [p for p in purchases if p.purchase_date <= cutoff]
    recent = [p for p in purchases if p.purchase_date > cutoff]
    if len(history) < cfg.outlier_min_history:
        return _no_data(
            code,
            name,
            f"Needs {cfg.outlier_min_history} purchase lines before the last "
            f"{cfg.outlier_lookback_days} days; found {len(history)}.",
        )
    flagged = []
    for field_name in ("unit_price", "quantity"):
        values = [getattr(p, field_name) for p in history]
        mean, spread = statistics.fmean(values), statistics.pstdev(values)
        if spread == 0:
            continue
        for p in recent:
            z = (getattr(p, field_name) - mean) / spread
            if abs(z) >= cfg.outlier_zscore:
                flagged.append(
                    {
                        "reference": p.reference,
                        "date": p.purchase_date.isoformat(),
                        "field": field_name,
                        "value": getattr(p, field_name),
                        "zscore": round(z, 2),
                    }
                )
    triggered = bool(flagged)
    text = (
        f"{len(flagged)} purchase line(s) in the last {cfg.outlier_lookback_days} days differ "
        f"from the material's history by {cfg.outlier_zscore:g} or more standard deviations."
        if triggered
        else f"No purchase line in the last {cfg.outlier_lookback_days} days is unusual "
        f"({len(recent)} checked)."
    )
    return Signal(
        code,
        name,
        TRIGGERED if triggered else CLEAR,
        text,
        float(len(flagged)),
        cfg.outlier_zscore,
        {"lines": flagged[:10]},
    )
