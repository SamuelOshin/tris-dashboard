"""
Canonical mapping targets: which tables a source file can be mapped into, and the rules each
field must satisfy. This is the single description the validator, the preview and the
frontend field list are all generated from, and it mirrors docs/DATA_DICTIONARY.md.

Rules here are deliberately at least as strict as the database CHECK constraints, so a bad row
is reported with a readable message before it ever reaches the database.
"""

from dataclasses import dataclass
from typing import Any

from sqlmodel import SQLModel

from app.api.modules.v1.manufacturing.models import (
    BOMEntry,
    DemandForecast,
    FinancialPlanRecord,
    InventoryRecord,
    Material,
    MaterialCost,
    MaterialSupplier,
    ProductionRecord,
    PurchaseRecord,
    SupplierOperationsMetric,
    VarianceInput,
)


@dataclass(frozen=True)
class FieldSpec:
    """One canonical field."""

    name: str
    kind: str  # str | float | int | date | bool
    required: bool = False
    description: str = ""
    max_length: int | None = None
    min_value: float | None = None
    min_exclusive: bool = False
    max_value: float | None = None
    default: Any = None
    ref: str | None = None  # "materials" | "suppliers": value must already exist there
    uppercase: bool = False
    hint: str = ""


@dataclass(frozen=True)
class TargetSpec:
    """One canonical table a file can be mapped into."""

    key: str
    label: str
    description: str
    model: type[SQLModel]
    fields: tuple[FieldSpec, ...]
    lead_field: str  # required field used to narrow the duplicate lookup
    key_fields: tuple[str, ...]  # natural key used to detect duplicates
    null_safe_key: bool = False  # True: a missing key part is a value; False: skip the check
    any_of: tuple[tuple[str, ...], ...] = ()  # at least one field of each group must be present
    date_orders: tuple[tuple[str, str], ...] = ()  # (start, end): end must not precede start

    def field(self, name: str) -> FieldSpec:
        return next(f for f in self.fields if f.name == name)


def _text(name: str, size: int, required: bool = False, desc: str = "", **kw: Any) -> FieldSpec:
    return FieldSpec(name, "str", required, desc, max_length=size, **kw)


def _num(name: str, required: bool = False, desc: str = "", **kw: Any) -> FieldSpec:
    return FieldSpec(name, "float", required, desc, **kw)


def _day(name: str, required: bool = False, desc: str = "") -> FieldSpec:
    return FieldSpec(name, "date", required, desc)


_MATERIAL = {"ref": "materials"}
_SUPPLIER = {"ref": "suppliers"}
_CURRENCY = _text(
    "currency", 10, desc="Currency code, for example USD", default="USD", uppercase=True
)
_NON_NEG = {"min_value": 0}
_POSITIVE = {"min_value": 0, "min_exclusive": True}

TARGETS: tuple[TargetSpec, ...] = (
    TargetSpec(
        "materials",
        "Material master",
        "Raw materials and components. Import these first; other files refer to them.",
        Material,
        (
            _text("material_id", 50, True, "Material or part number"),
            _text("description", 500, True, "Human-readable name"),
            _text("category", 100, desc="Grouping such as Metals"),
            _text("unit_of_measure", 20, True, "Base unit, for example kg"),
            FieldSpec("is_active", "bool", description="Still in use", default=True),
        ),
        lead_field="material_id",
        key_fields=("material_id",),
    ),
    TargetSpec(
        "material_suppliers",
        "Material suppliers",
        "Which existing suppliers can supply which material.",
        MaterialSupplier,
        (
            _text("material_id", 50, True, "Material number", **_MATERIAL),
            _text("supplier_id", 50, True, "Supplier already known to TRIS", **_SUPPLIER),
            FieldSpec(
                "is_primary", "bool", description="Primary source for the material", default=False
            ),
            _text("risk_indicator", 20, desc="Source risk label, for example Low or High"),
        ),
        lead_field="material_id",
        key_fields=("material_id", "supplier_id"),
    ),
    TargetSpec(
        "material_costs",
        "Material costs",
        "Standard, actual and budget unit cost per material.",
        MaterialCost,
        (
            _text("material_id", 50, True, "Material number", **_MATERIAL),
            FieldSpec("version", "int", description="Cost set version", default=1, min_value=1),
            _day("effective_from", True, "First day the cost applies"),
            _day("effective_to", desc="Last day the cost applies"),
            _num("standard_cost", desc="Planned cost per unit", **_NON_NEG),
            _num("actual_cost", desc="Realised cost per unit", **_NON_NEG),
            _num("budget_cost", desc="Budget cost per unit", **_NON_NEG),
            _CURRENCY,
        ),
        lead_field="material_id",
        key_fields=("material_id", "version"),
        any_of=(("standard_cost", "actual_cost", "budget_cost"),),
        date_orders=(("effective_from", "effective_to"),),
    ),
    TargetSpec(
        "purchase_records",
        "Purchase records",
        "Purchase order lines: what was bought, how much and at what price.",
        PurchaseRecord,
        (
            _text("purchase_reference", 100, desc="Purchase order or line reference"),
            _text("material_id", 50, True, "Material number", **_MATERIAL),
            _text("supplier_id", 50, desc="Supplier already known to TRIS", **_SUPPLIER),
            _day("purchase_date", True, "Order or posting date"),
            _num("quantity", True, "Quantity in the material's unit", **_POSITIVE),
            _num("unit_price", True, "Price per unit", **_NON_NEG),
            _CURRENCY,
        ),
        lead_field="material_id",
        key_fields=("purchase_reference", "material_id", "purchase_date", "quantity", "unit_price"),
    ),
    TargetSpec(
        "inventory_records",
        "Inventory",
        "Stock position per material and date.",
        InventoryRecord,
        (
            _text("material_id", 50, True, "Material number", **_MATERIAL),
            _day("snapshot_date", True, "Date the stock position was true"),
            _num("quantity_on_hand", True, "Quantity in stock", **_NON_NEG),
            _num("inventory_value", desc="Value of the stock", **_NON_NEG),
            _CURRENCY,
            _num("days_of_supply", desc="Coverage in days, if the source provides it", **_NON_NEG),
        ),
        lead_field="material_id",
        key_fields=("material_id", "snapshot_date"),
    ),
    TargetSpec(
        "variance_inputs",
        "Price variance",
        "Purchase price variance, or the prices needed to derive it, per material and period.",
        VarianceInput,
        (
            _text("material_id", 50, True, "Material number", **_MATERIAL),
            _day("period_start", True, "First day of the period"),
            _day("period_end", True, "Last day of the period"),
            _num("standard_price", desc="Standard price per unit", **_NON_NEG),
            _num("actual_price", desc="Actual price per unit", **_NON_NEG),
            _num("quantity_purchased", desc="Quantity bought in the period", **_NON_NEG),
            _num("reported_ppv_amount", desc="Variance as reported by the source"),
            _CURRENCY,
        ),
        lead_field="material_id",
        key_fields=("material_id", "period_start", "period_end"),
        date_orders=(("period_start", "period_end"),),
    ),
    TargetSpec(
        "bom_entries",
        "Bill of materials",
        "Component lines: how much of each material goes into one unit of a product.",
        BOMEntry,
        (
            _text("product_sku", 50, True, "Finished product or SKU"),
            _text("product_description", 500, desc="Product name"),
            _text("material_id", 50, True, "Component material number", **_MATERIAL),
            _num("bom_quantity", True, "Material needed for one unit of the product", **_POSITIVE),
            _text("unit_of_measure", 20, True, "Unit of the quantity"),
            _day("effective_from", desc="First day this line is valid"),
            _day("effective_to", desc="Last day this line is valid"),
        ),
        lead_field="product_sku",
        key_fields=("product_sku", "material_id", "effective_from"),
        null_safe_key=True,
        date_orders=(("effective_from", "effective_to"),),
    ),
    TargetSpec(
        "production_records",
        "Production volume",
        "Planned and actual production volume per product and period.",
        ProductionRecord,
        (
            _text("product_sku", 50, True, "Finished product or SKU"),
            _day("period_start", True, "First day of the period"),
            _day("period_end", True, "Last day of the period"),
            _num("planned_volume", desc="Planned units", **_NON_NEG),
            _num("actual_volume", desc="Actual units", **_NON_NEG),
            _text("unit_of_measure", 20, True, "Unit of the volumes"),
        ),
        lead_field="product_sku",
        key_fields=("product_sku", "period_start", "period_end"),
        any_of=(("planned_volume", "actual_volume"),),
        date_orders=(("period_start", "period_end"),),
    ),
    TargetSpec(
        "demand_forecasts",
        "Demand forecast",
        "Demand forecast supplied by the source system (an input, not a TRIS prediction).",
        DemandForecast,
        (
            _text("product_sku", 50, desc="Finished product or SKU"),
            _text("material_id", 50, desc="Material number", **_MATERIAL),
            _day("period_start", True, "First day of the period"),
            _day("period_end", True, "Last day of the period"),
            _num("forecast_quantity", True, "Forecast quantity", **_NON_NEG),
            _text("unit_of_measure", 20, True, "Unit of the quantity"),
            _text("forecast_source", 100, desc="Who or what produced the forecast"),
        ),
        lead_field="period_start",
        key_fields=("material_id", "product_sku", "period_start", "period_end"),
        null_safe_key=True,
        any_of=(("product_sku", "material_id"),),
        date_orders=(("period_start", "period_end"),),
    ),
    TargetSpec(
        "supplier_operations_metrics",
        "Supplier operations",
        "Supplier lead time and delivery performance.",
        SupplierOperationsMetric,
        (
            _text("supplier_id", 50, True, "Supplier already known to TRIS", **_SUPPLIER),
            _text("material_id", 50, desc="Material number", **_MATERIAL),
            _day("metric_date", True, "Date the metric describes"),
            _num("lead_time_days", desc="Days from order to receipt", **_NON_NEG),
            _num(
                "on_time_delivery_rate",
                desc="Share of on-time deliveries, 0 to 1",
                min_value=0,
                max_value=1,
                hint="enter a fraction such as 0.92, not a percentage",
            ),
        ),
        lead_field="supplier_id",
        key_fields=("supplier_id", "material_id", "metric_date"),
        null_safe_key=True,
        any_of=(("lead_time_days", "on_time_delivery_rate"),),
    ),
    TargetSpec(
        "financial_plan_records",
        "Financial plan",
        "Budget, forecast and actual material cost per period.",
        FinancialPlanRecord,
        (
            _text("material_id", 50, desc="Material number", **_MATERIAL),
            _text("product_sku", 50, desc="Finished product or SKU"),
            _day("period_start", True, "First day of the period"),
            _day("period_end", True, "Last day of the period"),
            _num("budget_amount", desc="Budget for the whole period"),
            _num("forecast_amount", desc="Forecast for the whole period"),
            _num("actual_amount", desc="Actual for the whole period"),
            _CURRENCY,
        ),
        lead_field="period_start",
        key_fields=("material_id", "product_sku", "period_start", "period_end"),
        null_safe_key=True,
        any_of=(("budget_amount", "forecast_amount", "actual_amount"),),
        date_orders=(("period_start", "period_end"),),
    ),
)

TARGETS_BY_KEY: dict[str, TargetSpec] = {t.key: t for t in TARGETS}
SOURCE_PROFILES: tuple[str, ...] = ("generic", "sap_style", "dynamics_style")
