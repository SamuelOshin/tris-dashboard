"""
Plain data containers for the forecasting engine. No database access and no logic.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Any

FORECAST = "forecast"
WITHHELD = "withheld"


@dataclass(frozen=True)
class ForecastConfig:
    """Settings that govern history requirements, evaluation and model selection."""

    min_train: int = 9  # earliest training length used when scoring a model
    origins: int = 4  # forecast origins scored per candidate (rolling origin)
    min_improvement: float = 0.10  # a regression must beat the best baseline by this share
    interval_level: float = 0.80  # prediction band, only for models that provide one
    ma_window: int = 3
    trend_window: int = 24  # most recent months used by the regression models
    horizons_days: tuple[int, ...] = (30, 90)

    def horizon_months(self, horizon_days: int) -> int:
        """Monthly data: a 30-day outlook is one month ahead, a 90-day outlook three."""
        return max(1, round(horizon_days / 30))

    def required_months(self, horizon_days: int) -> int:
        """Consecutive months needed so every scoring origin has enough training data."""
        return self.min_train + self.origins + self.horizon_months(horizon_days) - 1


DEFAULT_FORECAST_CONFIG = ForecastConfig()


@dataclass(frozen=True)
class HistoryPoint:
    """Quantity-weighted average purchase price for one calendar month."""

    month: date  # first day of the month
    price: float


@dataclass(frozen=True)
class Prediction:
    value: float
    lower: float | None = None
    upper: float | None = None


@dataclass
class CandidateResult:
    """One model's held-out performance over the rolling scoring origins."""

    code: str
    name: str
    version: str
    kind: str  # baseline | regression
    params: dict[str, Any] = field(default_factory=dict)
    origins_scored: int = 0
    mae: float | None = None
    rmse: float | None = None
    mape: float | None = None
    directional_accuracy: float | None = None
    eligible: bool = True
    note: str = ""


@dataclass
class ForecastPoint:
    month: date
    value: float
    lower: float | None = None
    upper: float | None = None


@dataclass
class HorizonOutcome:
    """Result for one horizon: a stored-ready forecast, or the reason it was withheld."""

    horizon_days: int
    horizon_months: int
    status: str  # forecast | withheld
    cutoff: date
    required_months: int
    available_months: int
    reason: str | None = None
    model_code: str | None = None
    model_name: str | None = None
    model_version: str | None = None
    dataset_version: str | None = None
    history_start: date | None = None
    history_end: date | None = None
    path: list[ForecastPoint] = field(default_factory=list)
    candidates: list[CandidateResult] = field(default_factory=list)
    selection_rationale: str | None = None
    interval_level: float | None = None
    config: dict[str, Any] = field(default_factory=dict)

    @property
    def point(self) -> ForecastPoint | None:
        return self.path[-1] if self.path else None
