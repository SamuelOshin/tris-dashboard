"""
Forecast engine: scores every candidate model on held-out data, selects one with a recorded
rationale, and produces the forecast, or withholds the horizon when the history is too short.

Pure and deterministic. It never reads the database or the clock; everything it knows is the
history it is given, and that history is checked against the cutoff on the way in (D5).
"""

from datetime import date
from typing import Any

import numpy as np

from app.api.modules.v1.manufacturing.service import forecast_models as models
from app.api.modules.v1.manufacturing.service.analytics_types import MonthPoint
from app.api.modules.v1.manufacturing.service.forecast_history import (
    add_months,
    assert_no_leakage,
    dataset_version,
    trailing_consecutive_run,
)
from app.api.modules.v1.manufacturing.service.forecast_types import (
    DEFAULT_FORECAST_CONFIG,
    FORECAST,
    WITHHELD,
    CandidateResult,
    ForecastConfig,
    ForecastPoint,
    HorizonOutcome,
)


def _score_candidate(
    code: str, y: np.ndarray, horizon_months: int, cfg: ForecastConfig
) -> CandidateResult:
    """
    Rolling-origin evaluation: at each origin the model sees only y[:e] and is scored against the
    actual price `horizon_months` later, which it has never seen.
    """
    spec, _ = models.MODELS[code]
    result = CandidateResult(spec.code, spec.name, spec.version, spec.kind)
    n = len(y)
    errors, pct, hits = [], [], []
    last_params: dict[str, Any] = {}
    for e in range(n - horizon_months - cfg.origins + 1, n - horizon_months + 1):
        train, actual = y[:e], float(y[e + horizon_months - 1])
        try:
            prediction, last_params = models.predict(code, train, horizon_months, cfg)
        except models.ModelUnavailableError as exc:
            result.eligible, result.note = False, f"Could not be fitted: {exc}"
            return result
        error = prediction.value - actual
        errors.append(error)
        pct.append(abs(error) / abs(actual))
        moved = actual - float(train[-1])
        predicted_move = prediction.value - float(train[-1])
        hits.append(np.sign(moved) == np.sign(predicted_move))
    result.params = last_params
    result.origins_scored = len(errors)
    result.mae = float(np.mean(np.abs(errors)))
    result.rmse = float(np.sqrt(np.mean(np.square(errors))))
    result.mape = float(np.mean(pct) * 100)
    result.directional_accuracy = float(np.mean(hits))
    return result


def _pick(candidates: list[CandidateResult], kind: str) -> CandidateResult | None:
    pool = [c for c in candidates if c.eligible and c.kind == kind and c.mae is not None]
    return min(pool, key=lambda c: (c.mae, models.MODELS[c.code][0].rank)) if pool else None


def select_model(
    candidates: list[CandidateResult], cfg: ForecastConfig
) -> tuple[CandidateResult, str]:
    """
    Choose the best baseline, unless a regression model beats it on held-out error by at least
    `min_improvement`. Ties and near-ties go to the simpler model.
    """
    baseline, regression = _pick(candidates, "baseline"), _pick(candidates, "regression")
    if baseline is None:
        raise ValueError("no baseline model could be scored")
    if regression is not None and regression.mae <= baseline.mae * (1 - cfg.min_improvement):
        gain = (1 - regression.mae / baseline.mae) * 100
        return regression, (
            f"{regression.name} chosen: held-out error (MAE) {regression.mae:.4f} is "
            f"{gain:.0f}% lower than the best baseline, {baseline.name} ({baseline.mae:.4f}), "
            f"above the {cfg.min_improvement * 100:.0f}% needed to prefer a regression model."
        )
    if regression is None:
        why = "no regression model could be fitted"
    else:
        gain = (1 - regression.mae / baseline.mae) * 100 if baseline.mae else 0.0
        compared = f"{gain:.0f}% lower" if gain >= 0 else f"{-gain:.0f}% higher"
        why = (
            f"the best regression, {regression.name}, had MAE {regression.mae:.4f} "
            f"({compared} error than the baseline), short of the "
            f"{cfg.min_improvement * 100:.0f}% improvement needed"
        )
    return baseline, (
        f"{baseline.name} chosen: held-out error (MAE) {baseline.mae:.4f}; {why}. "
        "A more complex model is used only when it is clearly better."
    )


PRICE_NOT_POSITIVE_REASON = (
    "The usable price history has a month priced at zero or below, so percentage errors "
    "cannot be calculated."
)


def _withheld(
    horizon_days: int, cutoff: date, cfg: ForecastConfig, available: int, reason: str
) -> HorizonOutcome:
    return HorizonOutcome(
        horizon_days=horizon_days,
        horizon_months=cfg.horizon_months(horizon_days),
        status=WITHHELD,
        cutoff=cutoff,
        required_months=cfg.required_months(horizon_days),
        available_months=available,
        reason=reason,
    )


def run_horizon(
    points: list[MonthPoint],
    cutoff: date,
    horizon_days: int,
    currency: str | None = None,
    cfg: ForecastConfig = DEFAULT_FORECAST_CONFIG,
) -> HorizonOutcome:
    """
    Forecast one horizon from monthly price history.

    Args:
        points: Monthly average prices; must all be dated on or before `cutoff`.
        cutoff: The date the analysis describes. Later data is rejected, not trimmed.
        horizon_days: 30 (one month ahead) or 90 (three months ahead).
        currency: Currency of the prices (recorded in the dataset fingerprint).
        cfg: Evaluation and selection settings.

    Returns:
        An outcome with the forecast, model metadata and candidate comparison, or a withheld
        outcome explaining why the history cannot support this horizon.

    Raises:
        DataLeakageError: If any point is dated after the cutoff.
    """
    assert_no_leakage(points, cutoff)
    history = trailing_consecutive_run(points)
    required = cfg.required_months(horizon_days)
    if len(history) < required:
        broken = len(points) > len(history)
        reason = (
            f"A {horizon_days}-day outlook needs {required} consecutive months of purchases; "
            f"{len(history)} are available"
            + (" (missing months before them ended the usable run)." if broken else ".")
        )
        return _withheld(horizon_days, cutoff, cfg, len(history), reason)

    if any(p.price <= 0 for p in history):
        return _withheld(horizon_days, cutoff, cfg, len(history), PRICE_NOT_POSITIVE_REASON)

    months = cfg.horizon_months(horizon_days)
    y = np.array([p.price for p in history], dtype=float)
    candidates = [_score_candidate(code, y, months, cfg) for code in models.MODELS]
    chosen, rationale = select_model(candidates, cfg)

    path = []
    for step in range(1, months + 1):
        prediction, _ = models.predict(chosen.code, y, step, cfg)
        path.append(
            ForecastPoint(
                add_months(history[-1].month, step),
                round(prediction.value, 6),
                None if prediction.lower is None else round(prediction.lower, 6),
                None if prediction.upper is None else round(prediction.upper, 6),
            )
        )
    spec, _ = models.MODELS[chosen.code]
    return HorizonOutcome(
        horizon_days=horizon_days,
        horizon_months=months,
        status=FORECAST,
        cutoff=cutoff,
        required_months=required,
        available_months=len(history),
        model_code=spec.code,
        model_name=spec.name,
        model_version=spec.version,
        dataset_version=dataset_version(history, cutoff, currency),
        history_start=history[0].month,
        history_end=history[-1].month,
        path=path,
        candidates=candidates,
        selection_rationale=rationale,
        interval_level=cfg.interval_level if path[-1].lower is not None else None,
        config={
            "min_train": cfg.min_train,
            "origins": cfg.origins,
            "min_improvement": cfg.min_improvement,
            "interval_level": cfg.interval_level,
            "ma_window": cfg.ma_window,
            "trend_window": cfg.trend_window,
        },
    )
