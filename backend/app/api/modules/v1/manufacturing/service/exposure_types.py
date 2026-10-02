"""
Plain containers and settings for financial exposure and scenarios.

Nothing here touches the database. A `Scenario` is a set of what-if adjustments applied on
top of a stored forecast; it is never saved and never changes the forecast it is applied to.
"""

from dataclasses import dataclass, field
from datetime import date

METHOD_VERSION = "1.0"
UNASSIGNED = "Unassigned"
UNALLOCATED = "Unallocated"
DAYS_PER_MONTH = 365.0 / 12.0


@dataclass(frozen=True)
class ExposureConfig:
    """Settings of the exposure calculation (all recorded in the response)."""

    usage_window_months: int = 6  # complete calendar months used to estimate monthly usage


DEFAULT_EXPOSURE_CONFIG = ExposureConfig()


@dataclass(frozen=True)
class Scenario:
    """What-if adjustments. All percentages are plain percent (10 means +10%)."""

    price_change_pct: float = 0.0  # all forecast prices of the material
    demand_change_pct: float = 0.0  # expected usage
    lead_time_delay_days: float = 0.0  # added to the supplier lead time
    inventory_change_pct: float = 0.0  # stock on hand
    supplier_id: str | None = None  # supplier the next field applies to
    supplier_price_change_pct: float = 0.0  # price change on that supplier's share of usage
    spot_premium_pct: float = 0.0  # extra price paid on usage the stock cannot cover


@dataclass(frozen=True)
class StoredForecast:
    """The stored baseline prediction an exposure is built from (read-only)."""

    run_id: str
    model_name: str
    model_version: str
    as_of: date
    horizon_days: int
    horizon_months: int
    currency: str | None
    last_observed_price: float
    path_values: tuple[float, ...]  # one value per month of the horizon, in order
    end_value: float
    history_end: date
    created_at: str


@dataclass
class ExposureInput:
    """Everything the calculation needs for one material (already limited to the as-of date)."""

    material_id: str
    description: str
    category: str | None
    unit_of_measure: str
    forecast: StoredForecast
    monthly_usage: float
    usage_months: int
    supplier_shares: dict[str, float] = field(default_factory=dict)
    product_weights: dict[str, float] = field(default_factory=dict)
    inventory_on_hand: float | None = None
    inventory_date: date | None = None
    lead_time_days: float | None = None
