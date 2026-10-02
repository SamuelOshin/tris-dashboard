"""
Material risk scoring: factor catalogue, default weights and plain containers.

This module is independent of the R-001..R-007 rule engine (decision D4): it imports nothing from
the rules package and shares no table, constant or state with it.
"""

from dataclasses import dataclass
from typing import Any

METHOD_VERSION = "1.0"

# Factor codes, in display order.
PRICE_CHANGE = "price_change"
VOLATILITY = "volatility"
PREDICTED_INCREASE = "predicted_increase"
BOM_EXPOSURE = "bom_exposure"
DEMAND = "demand"
SUPPLIER_CONCENTRATION = "supplier_concentration"
INVENTORY_COVERAGE = "inventory_coverage"
LEAD_TIME = "lead_time"
STANDARD_COST_DEVIATION = "standard_cost_deviation"

FACTOR_CODES = (
    PRICE_CHANGE,
    VOLATILITY,
    PREDICTED_INCREASE,
    BOM_EXPOSURE,
    DEMAND,
    SUPPLIER_CONCENTRATION,
    INVENTORY_COVERAGE,
    LEAD_TIME,
    STANDARD_COST_DEVIATION,
)


@dataclass(frozen=True)
class FactorInfo:
    name: str
    unit: str
    meaning: str  # what a higher sub-score means


FACTORS: dict[str, FactorInfo] = {
    PRICE_CHANGE: FactorInfo("Price change", "%", "the price rose over the last three months"),
    VOLATILITY: FactorInfo("Price volatility", "%", "monthly prices swing more"),
    PREDICTED_INCREASE: FactorInfo("Predicted increase", "%", "the stored forecast is higher"),
    BOM_EXPOSURE: FactorInfo(
        "Product cost exposure", "%", "the material is a larger share of a product's material cost"
    ),
    DEMAND: FactorInfo("Demand trend", "%", "purchased volume is growing"),
    SUPPLIER_CONCENTRATION: FactorInfo(
        "Supplier concentration", "%", "one supplier holds more of the spend"
    ),
    INVENTORY_COVERAGE: FactorInfo(
        "Inventory coverage", " days", "stock covers fewer days of usage"
    ),
    LEAD_TIME: FactorInfo("Supplier lead time", " days", "deliveries take longer"),
    STANDARD_COST_DEVIATION: FactorInfo(
        "Standard cost deviation", "%", "the price is further above standard cost"
    ),
}

# A weight set is stored as plain data so every version can be kept and audited.
# ramps: [low, high]; the sub-score is 0 at `low`, 1 at `high`, linear between (low may exceed high
# for factors where a smaller value is worse, such as inventory coverage).
DEFAULT_CONFIG: dict[str, Any] = {
    "weights": {
        PRICE_CHANGE: 15,
        VOLATILITY: 10,
        PREDICTED_INCREASE: 15,
        BOM_EXPOSURE: 10,
        DEMAND: 5,
        SUPPLIER_CONCENTRATION: 15,
        INVENTORY_COVERAGE: 10,
        LEAD_TIME: 10,
        STANDARD_COST_DEVIATION: 10,
    },
    "ramps": {
        PRICE_CHANGE: [0, 15],
        VOLATILITY: [1, 8],
        PREDICTED_INCREASE: [0, 10],
        BOM_EXPOSURE: [5, 40],
        DEMAND: [0, 30],
        SUPPLIER_CONCENTRATION: [50, 100],
        INVENTORY_COVERAGE: [60, 15],
        LEAD_TIME: [14, 90],
        STANDARD_COST_DEVIATION: [0, 15],
    },
    "bands": {"moderate": 25, "high": 50, "critical": 75},
    "min_evaluable_weight": 50,
}


@dataclass(frozen=True)
class Reading:
    """A factor's measured value (None when it cannot be evaluated) and why, in plain words."""

    raw: float | None
    detail: str


@dataclass(frozen=True)
class ForecastRef:
    """The stored forecast used for the predicted-increase factor."""

    run_id: str
    horizon_days: int
    change_pct: float
