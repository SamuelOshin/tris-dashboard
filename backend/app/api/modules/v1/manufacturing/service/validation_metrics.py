"""
Retrospective validation metrics. Pure functions: numbers in, numbers out.

Forecast accuracy: MAE, RMSE and MAPE (prices are always positive, so a percentage error is
meaningful; a case whose actual is not positive is left out of MAPE), directional accuracy, and a
comparison with the simplest possible forecast ("next month's price will equal today's").
Warning quality: the risk signal against what happened (true/false positives and negatives,
precision, recall, false positive rate) and how far ahead the warning first appeared.
"""

from collections import defaultdict
from datetime import date
from math import sqrt
from statistics import mean, median
from typing import Any

from app.api.modules.v1.manufacturing.service.validation_types import (
    FN,
    FP,
    OUTCOME_EVALUATED,
    TN,
    TP,
    FrozenCase,
    ValidationConfig,
)

UP, DOWN, FLAT = "up", "down", "flat"
BEATS, TIES, WORSE = "beats", "ties", "worse"
# Forecasts are stored rounded to 6 decimals, so a naive forecast ("same as last month") differs
# from the exact last price by a rounding error. Errors closer than this are a tie, not a win.
TIE_TOLERANCE = 1e-5


def versus_naive(abs_error: float, naive_abs_error: float) -> str:
    """Whether a forecast was closer to the actual than the naive forecast, equal, or further."""
    if abs(abs_error - naive_abs_error) <= TIE_TOLERANCE:
        return TIES
    return BEATS if abs_error < naive_abs_error else WORSE


def direction(change_pct: float, flat_band_pct: float) -> str:
    """Up or down, or flat when the move is smaller than the flat band."""
    if abs(change_pct) < flat_band_pct:
        return FLAT
    return UP if change_pct > 0 else DOWN


def classify(alert: bool, event: bool) -> str:
    """Warning against reality: true/false positive/negative."""
    if alert:
        return TP if event else FP
    return FN if event else TN


def evaluate_case(case: FrozenCase, actual: float, cfg: ValidationConfig) -> dict[str, Any]:
    """
    Compare one frozen forecast and signal with the actual monthly price.

    Returns the errors, directions, whether a cost-risk event happened and how the warning did.
    """
    last, forecast = case.last_observed_price, case.forecast_value
    error = forecast - actual
    forecast_change = (forecast / last - 1) * 100
    actual_change = (actual / last - 1) * 100
    actual_dir = direction(actual_change, cfg.flat_band_pct)
    forecast_dir = direction(forecast_change, cfg.flat_band_pct)
    event = actual_change >= cfg.event_threshold_pct
    return {
        "actual_value": actual,
        "error": error,
        "abs_error": abs(error),
        "pct_error": abs(error) / actual * 100 if actual > 0 else None,
        "naive_abs_error": abs(case.naive_value - actual),
        "forecast_change_pct": forecast_change,
        "actual_change_pct": actual_change,
        "forecast_direction": forecast_dir,
        "actual_direction": actual_dir,
        # a flat actual move has no direction to get right, so it is not scored
        # A direction is judged only when both the forecast and the actual moved. A forecast that
        # stays flat makes no directional call, so it is counted apart (`direction_no_call`)
        # instead of as a wrong call (method 1.1; method 1.0 counted it as wrong).
        "direction_correct": (
            None if FLAT in (actual_dir, forecast_dir) else forecast_dir == actual_dir
        ),
        "direction_no_call": forecast_dir == FLAT and actual_dir != FLAT,
        "event": event,
        "classification": classify(case.alert, event),
    }


def _safe_div(numerator: float, denominator: float) -> float | None:
    return numerator / denominator if denominator else None


def error_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """MAE, RMSE, MAPE, directional accuracy and the naive-forecast comparison."""
    if not rows:
        return {"n": 0}
    abs_errors = [r["abs_error"] for r in rows]
    pct = [r["pct_error"] for r in rows if r["pct_error"] is not None]
    scored = [r["direction_correct"] for r in rows if r["direction_correct"] is not None]
    no_call = sum(1 for r in rows if r.get("direction_no_call"))
    naive = [r["naive_abs_error"] for r in rows]
    verdicts = [versus_naive(r["abs_error"], r["naive_abs_error"]) for r in rows]
    beats, ties = verdicts.count(BEATS), verdicts.count(TIES)
    naive_mae = mean(naive)
    return {
        "n": len(rows),
        "mae": mean(abs_errors),
        "rmse": sqrt(mean(e * e for e in abs_errors)),
        "mape_pct": mean(pct) if pct else None,
        "mape_n": len(pct),
        "directional_accuracy": _safe_div(sum(scored), len(scored)),
        "directional_n": len(scored),
        "directional_no_call_n": no_call,
        "naive_mae": naive_mae,
        "mae_vs_naive_pct": (mean(abs_errors) / naive_mae - 1) * 100 if naive_mae else None,
        "beats_naive_share": beats / len(rows),
        "ties_naive_share": ties / len(rows),
        "worse_than_naive_share": (len(rows) - beats - ties) / len(rows),
        "ties_naive": ties,
    }


def confusion_metrics(classes: list[str]) -> dict[str, Any]:
    """Counts and rates of the warning against real events. A rate with no cases is None."""
    tp, fp, fn, tn = (classes.count(c) for c in (TP, FP, FN, TN))
    return {
        "n": len(classes),
        "events": tp + fn,
        "event_rate": _safe_div(tp + fn, len(classes)),
        "alerts": tp + fp,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision": _safe_div(tp, tp + fp),
        "recall": _safe_div(tp, tp + fn),
        "false_positive_rate": _safe_div(fp, fp + tn),
        "false_negative_rate": _safe_div(fn, fn + tp),
    }


def _month_index(day: date) -> int:
    return day.year * 12 + day.month - 1


def lead_times(rows: list[dict[str, Any]], step_months: int) -> list[int]:
    """
    Months of advance warning for each event that the signal caught.

    For one material and horizon, in cutoff order: a warning "starts" at the first cutoff of an
    unbroken run of consecutive cutoffs that all raised an alert. The lead time of an event the
    signal caught is the number of months from the start of that run to the month of the event.
    """
    leads: list[int] = []
    run_start: date | None = None
    previous: date | None = None
    for row in sorted(rows, key=lambda r: r["cutoff"]):
        consecutive = (
            previous is not None
            and _month_index(row["cutoff"]) - _month_index(previous) == step_months
        )
        if row["alert"]:
            if run_start is None or not consecutive:
                run_start = row["cutoff"]
        else:
            run_start = None
        previous = row["cutoff"]
        if row["alert"] and row["event"] and run_start is not None:
            leads.append(_month_index(row["target_month"]) - _month_index(run_start))
    return leads


def lead_time_summary(leads: list[int]) -> dict[str, Any]:
    if not leads:
        return {"n": 0}
    return {
        "n": len(leads),
        "mean_months": mean(leads),
        "median_months": median(leads),
        "min_months": min(leads),
        "max_months": max(leads),
    }


def summarise(rows: list[dict[str, Any]], cfg: ValidationConfig) -> dict[str, Any]:
    """
    Aggregate every case of a run, by horizon and by material, without dropping any.

    Each row carries the frozen forecast fields and, if it was evaluated, its outcome fields.
    Cases that could not be forecast or evaluated are counted, not hidden.
    """
    summary: dict[str, Any] = {}
    for horizon in cfg.horizons_days:
        of_horizon = [r for r in rows if r["horizon_days"] == horizon]
        evaluated = [r for r in of_horizon if r["outcome_status"] == OUTCOME_EVALUATED]
        by_material: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for r in evaluated:
            by_material[r["material_id"]].append(r)
        leads: list[int] = []
        for material_rows in by_material.values():
            leads.extend(lead_times(material_rows, cfg.cutoff_step_months))
        summary[str(horizon)] = {
            "cases": len(of_horizon),
            "withheld": sum(1 for r in of_horizon if r["status"] == "withheld"),
            "not_evaluable": sum(
                1 for r in of_horizon if r["status"] == "frozen" and r not in evaluated
            ),
            "evaluated": len(evaluated),
            "forecast": error_metrics(evaluated),
            "warning": {
                **confusion_metrics([r["classification"] for r in evaluated]),
                # cases too thin to score count as "no warning"; say how many, and how many
                # of them were events (they sit in the missed count)
                "unscored": sum(1 for r in evaluated if not r.get("scored", True)),
                "unscored_events": sum(
                    1 for r in evaluated if not r.get("scored", True) and r["event"]
                ),
            },
            "lead_time": lead_time_summary(leads),
            "by_material": [
                {"material_id": m, **error_metrics(rs), "events": sum(1 for r in rs if r["event"])}
                for m, rs in sorted(by_material.items())
            ],
            "models": _model_counts(evaluated),
        }
    return summary


def _model_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for r in rows:
        counts[r["model_name"]] += 1
    return dict(sorted(counts.items(), key=lambda kv: -kv[1]))
