"""
Retrospective validation: settings and plain containers (decision D5).

Validation asks, for past dates, "what would TRIS have said using only the data it had then, and
what actually happened?". Nothing here reads the database or the clock.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Any

METHOD_VERSION = "1.2"
# 1.2: a forecast and the naive forecast whose errors differ by less than 1e-5 are a tie (forecasts
#      are stored rounded to 6 decimals, so a naive forecast is not exactly the last price).
#      Runs made with 1.1 counted such rounding noise as wins and losses and are kept.
# 1.1: a forecast that stays flat makes no directional call (counted apart, not as wrong), and the
#      comparison with the naive forecast reports beats, ties and worse separately.
# 1.0: counted a flat forecast as a wrong direction whenever the price moved (runs VAL-4C75719443,
#      VAL-7658D0A331, VAL-25768D469C used it and are kept).

CASE_FROZEN = "frozen"  # a forecast and signal were made and stored before any actual was read
CASE_WITHHELD = "withheld"  # the history at that cutoff could not support a forecast

OUTCOME_EVALUATED = "evaluated"
OUTCOME_NOT_EVALUABLE = "not_evaluable"

TP, FP, FN, TN = "TP", "FP", "FN", "TN"


@dataclass(frozen=True)
class ValidationConfig:
    """
    How a validation run chooses its cutoffs and judges its results. Every value is recorded with
    the run. The cutoffs depend only on this configuration and on how much data exists, never on
    how well a forecast did, so successful examples cannot be picked.
    """

    horizons_days: tuple[int, ...] = (30, 90)
    cutoff_step_months: int = 1  # months between cutoffs (larger values reduce overlap)
    event_threshold_pct: float = 5.0  # a price rise of at least this much is a cost-risk event
    alert_threshold: float | None = None  # risk score that counts as a warning (None = High band)
    flat_band_pct: float = 0.5  # moves smaller than this are "flat" and not scored for direction
    dataset_id: str | None = None
    material_ids: tuple[str, ...] = ()  # empty = every material

    def to_dict(self) -> dict[str, Any]:
        return {
            "horizons_days": list(self.horizons_days),
            "cutoff_step_months": self.cutoff_step_months,
            "event_threshold_pct": self.event_threshold_pct,
            "alert_threshold": self.alert_threshold,
            "flat_band_pct": self.flat_band_pct,
            "dataset_id": self.dataset_id,
            "material_ids": list(self.material_ids),
        }


@dataclass
class FrozenCase:
    """A forecast and warning signal made at a cutoff, before the outcome is known."""

    material_id: str
    cutoff: date
    horizon_days: int
    status: str
    withheld_reason: str | None = None
    target_month: date | None = None
    currency: str | None = None
    last_observed_price: float | None = None
    forecast_value: float | None = None
    lower_bound: float | None = None
    upper_bound: float | None = None
    naive_value: float | None = None
    model_code: str | None = None
    model_name: str | None = None
    model_version: str | None = None
    dataset_version: str | None = None
    history_months: int | None = None
    risk_score: float | None = None
    risk_level: str | None = None
    alert: bool = False
    risk_factors: list[dict[str, Any]] = field(default_factory=list)
