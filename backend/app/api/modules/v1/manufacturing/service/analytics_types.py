"""
Plain data containers for material-cost detection. No database access, no business logic:
the loader fills these from the manufacturing tables and the detectors read them.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Any

TRIGGERED = "triggered"
CLEAR = "clear"
NOT_EVALUABLE = "not_evaluable"


@dataclass(frozen=True)
class DetectionConfig:
    """Thresholds for every detector. Defaults are documented in MATERIAL_DETECTION_METHOD.md."""

    rapid_increase_pct: float = 10.0  # latest month vs previous month with purchases
    zscore_threshold: float = 2.0  # latest month vs its own history
    zscore_min_history: int = 6  # prior monthly points needed
    zscore_window: int = 12  # prior monthly points used
    standard_deviation_pct: float = 5.0  # actual above standard by at least this much...
    standard_persistence_months: int = 3  # ...in each of the latest N months
    ppv_min_periods: int = 3
    bom_escalation_pct: float = 5.0  # product material cost rise over the window
    bom_window_days: int = 90
    bom_contribution_share: float = 0.25  # this material's share of the product's rise
    concentration_top_share: float = 0.70  # one supplier's share of trailing spend
    concentration_window_days: int = 365
    low_coverage_days: float = 30.0
    usage_window_days: int = 90
    inventory_price_rise_pct: float = 5.0  # 3-month rise that makes low coverage a cost risk
    outlier_zscore: float = 3.0  # single purchase line vs the material's history
    outlier_lookback_days: int = 90
    outlier_min_history: int = 8
    high_spend_top_fraction: float = 0.20
    high_spend_min_materials: int = 5
    spend_window_days: int = 365
    lead_time_increase_pct: float = 20.0
    otd_drop: float = 0.10  # on-time delivery rate fall (0-1 scale)
    ops_window_days: int = 90
    ops_min_points: int = 2


DEFAULT_CONFIG = DetectionConfig()


@dataclass(frozen=True)
class PurchaseRow:
    purchase_date: date
    quantity: float
    unit_price: float
    supplier_id: str | None
    reference: str | None
    currency: str


@dataclass(frozen=True)
class CostRow:
    version: int
    effective_from: date
    effective_to: date | None
    standard_cost: float | None
    currency: str


@dataclass(frozen=True)
class VarianceRow:
    period_start: date
    period_end: date
    standard_price: float | None
    actual_price: float | None
    quantity_purchased: float | None
    reported_ppv_amount: float | None


@dataclass(frozen=True)
class InventoryRow:
    snapshot_date: date
    quantity_on_hand: float
    inventory_value: float | None
    days_of_supply: float | None


@dataclass(frozen=True)
class OpsRow:
    metric_date: date
    supplier_id: str
    lead_time_days: float | None
    on_time_delivery_rate: float | None


@dataclass(frozen=True)
class BomRow:
    product_sku: str
    product_description: str | None
    material_id: str
    bom_quantity: float
    unit_of_measure: str
    effective_from: date | None
    effective_to: date | None


@dataclass
class MaterialData:
    """Everything known about one material, already restricted to dates up to `as_of`."""

    material_id: str
    description: str
    category: str | None
    unit_of_measure: str
    purchases: list[PurchaseRow] = field(default_factory=list)
    costs: list[CostRow] = field(default_factory=list)
    variances: list[VarianceRow] = field(default_factory=list)
    inventory: list[InventoryRow] = field(default_factory=list)
    ops: list[OpsRow] = field(default_factory=list)
    bom: list[BomRow] = field(default_factory=list)
    dataset_ids: set[str] = field(default_factory=set)


@dataclass(frozen=True)
class MonthPoint:
    """Volume-weighted average purchase price for one calendar month."""

    month: date  # first day of the month
    price: float
    quantity: float


@dataclass
class Signal:
    """One detector's verdict, with the numbers behind it in plain language."""

    code: str
    name: str
    status: str  # triggered | clear | not_evaluable
    explanation: str
    value: float | None = None
    threshold: float | None = None
    details: dict[str, Any] = field(default_factory=dict)
