"""
Forecast models. Every model has one job: given a training series and a horizon h (in months),
predict the value h months after the last training point.

Baselines use numpy only. The two regression models use statsmodels OLS and are the only ones
that offer a prediction band, because only they have a statistical basis for one.
"""

from collections.abc import Callable
from dataclasses import dataclass

import numpy as np
import statsmodels.api as sm

from app.api.modules.v1.manufacturing.service.forecast_types import ForecastConfig, Prediction


@dataclass(frozen=True)
class ModelSpec:
    code: str
    name: str
    version: str
    kind: str  # baseline | regression
    description: str
    rank: int  # simpler models have lower rank; used to break ties


class ModelUnavailableError(ValueError):
    """The model cannot be fitted on this series (for example too short or degenerate)."""


def _naive(train: np.ndarray, h: int, cfg: ForecastConfig, level: float):
    return Prediction(float(train[-1])), {}


def _moving_average(train: np.ndarray, h: int, cfg: ForecastConfig, level: float):
    window = min(cfg.ma_window, len(train))
    return Prediction(float(train[-window:].mean())), {"window": window}


def _simple_exponential_smoothing(train: np.ndarray, h: int, cfg: ForecastConfig, level: float):
    """Level-only smoothing; alpha chosen on the training data by one-step squared error."""
    best_alpha, best_sse, best_level = 0.05, np.inf, float(train[-1])
    for alpha in np.arange(0.05, 1.0, 0.05):
        smoothed = float(train[0])
        sse = 0.0
        for value in train[1:]:
            sse += (value - smoothed) ** 2
            smoothed = alpha * value + (1 - alpha) * smoothed
        if sse < best_sse:
            best_alpha, best_sse, best_level = float(alpha), sse, smoothed
    return Prediction(best_level), {"alpha": round(best_alpha, 2)}


def _require_full_rank(design: np.ndarray) -> None:
    """A rank-deficient design (for example a perfectly linear series) has no unique fit."""
    if np.linalg.matrix_rank(design) < design.shape[1]:
        raise ModelUnavailableError("the series is too regular to separate the model terms")


def _interval(fit, exog: np.ndarray, level: float) -> Prediction:
    frame = fit.get_prediction(exog).summary_frame(alpha=1 - level)
    row = frame.iloc[0]
    return Prediction(float(row["mean"]), float(row["obs_ci_lower"]), float(row["obs_ci_upper"]))


def _trend_regression(train: np.ndarray, h: int, cfg: ForecastConfig, level: float):
    """Price = a + b x time, fitted on the most recent months; band from the OLS prediction."""
    window = train[-cfg.trend_window :]
    t = np.arange(len(window), dtype=float)
    design = sm.add_constant(t)
    _require_full_rank(design)
    fit = sm.OLS(window, design).fit()
    exog = np.array([[1.0, float(len(window) - 1 + h)]])
    params = {"slope_per_month": round(float(fit.params[1]), 6), "months_used": len(window)}
    return _interval(fit, exog, level), params


def _lagged_regression(train: np.ndarray, h: int, cfg: ForecastConfig, level: float):
    """
    Direct h-step regression: price(t+h) = a + b x price(t) + c x time. Fitted only on pairs
    that lie wholly inside the training data. Overlapping targets make the band approximate.
    """
    window = train[-cfg.trend_window :]
    n = len(window)
    if n - h < 6:
        raise ModelUnavailableError("too few training pairs for a lagged regression")
    t = np.arange(n, dtype=float)
    features = np.column_stack([window[: n - h], t[: n - h]])
    design = sm.add_constant(features)
    _require_full_rank(design)
    fit = sm.OLS(window[h:], design).fit()
    exog = np.array([[1.0, float(window[-1]), float(n - 1)]])
    params = {
        "coefficient_on_current_price": round(float(fit.params[1]), 4),
        "coefficient_on_time": round(float(fit.params[2]), 6),
        "pairs_used": n - h,
    }
    return _interval(fit, exog, level), params


ModelFn = Callable[[np.ndarray, int, ForecastConfig, float], tuple[Prediction, dict]]

MODELS: dict[str, tuple[ModelSpec, ModelFn]] = {
    "naive": (
        ModelSpec(
            "naive",
            "Naive (last value)",
            "1.0",
            "baseline",
            "Next price equals the latest monthly price.",
            1,
        ),
        _naive,
    ),
    "moving_average": (
        ModelSpec(
            "moving_average",
            "Moving average (3 months)",
            "1.0",
            "baseline",
            "Next price equals the average of the latest three monthly prices.",
            2,
        ),
        _moving_average,
    ),
    "exponential_smoothing": (
        ModelSpec(
            "exponential_smoothing",
            "Simple exponential smoothing",
            "1.0",
            "baseline",
            "Weighted average that favours recent months; weight fitted on the history.",
            3,
        ),
        _simple_exponential_smoothing,
    ),
    "trend_regression": (
        ModelSpec(
            "trend_regression",
            "Linear trend regression",
            "1.0",
            "regression",
            "Straight-line trend over time, extended forward (statsmodels OLS).",
            4,
        ),
        _trend_regression,
    ),
    "lagged_regression": (
        ModelSpec(
            "lagged_regression",
            "Lagged price regression",
            "1.0",
            "regression",
            "Future price from today's price and the time trend (statsmodels OLS).",
            5,
        ),
        _lagged_regression,
    ),
}


def predict(
    code: str, train: np.ndarray, horizon_months: int, cfg: ForecastConfig
) -> tuple[Prediction, dict]:
    """
    Fit `code` on `train` alone and predict `horizon_months` ahead.

    Raises:
        ModelUnavailableError: If the model cannot be fitted or gives a non-positive price.
    """
    _, fn = MODELS[code]
    try:
        prediction, params = fn(train, horizon_months, cfg, cfg.interval_level)
    except (np.linalg.LinAlgError, ValueError) as exc:
        raise ModelUnavailableError(str(exc)) from exc
    if not np.isfinite(prediction.value) or prediction.value <= 0:
        raise ModelUnavailableError("the model produced a non-positive or invalid price")
    return prediction, params
