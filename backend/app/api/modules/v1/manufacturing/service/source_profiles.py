"""
Source-profile presets used to suggest a column mapping.

Each preset is only a list of column names commonly seen in that style of export. Nothing here
connects to any ERP system: files are uploaded as CSV or Excel and the suggestions are a
convenience the user reviews and can change. The SAP-style and Dynamics-style names follow the
technical field names those systems commonly use, but real exports vary by company, so the
mapping is always editable and can be saved as a profile.
"""

import re

from app.api.modules.v1.manufacturing.service.mapping_targets import (
    SOURCE_PROFILES,
    TARGETS_BY_KEY,
    TargetSpec,
)

PROFILE_LABELS: dict[str, str] = {
    "generic": "Generic CSV / Excel",
    "sap_style": "SAP-style import demonstration",
    "dynamics_style": "Dynamics 365-style import demonstration",
}

# Spellings accepted in every profile, in addition to the canonical field name itself.
GENERIC_SYNONYMS: dict[str, tuple[str, ...]] = {
    "material_id": ("material", "material_number", "material_no", "part_number", "item_id", "sku"),
    "description": ("material_description", "name", "material_name", "item_description"),
    "category": ("material_group", "group", "material_category"),
    "unit_of_measure": ("uom", "unit", "base_unit", "unit_of_measurement"),
    "supplier_id": ("supplier", "vendor", "vendor_id", "supplier_number", "vendor_number"),
    "unit_price": ("price", "net_price", "price_per_unit"),
    "purchase_date": ("order_date", "po_date", "document_date", "posting_date"),
    "purchase_reference": ("po_number", "purchase_order", "order_number", "po"),
    "quantity": ("qty", "order_quantity"),
    "bom_quantity": ("component_quantity", "qty_per", "quantity_per", "usage"),
    "product_sku": ("product", "product_id", "parent_item", "finished_good", "parent_sku"),
    "quantity_on_hand": ("stock", "on_hand", "stock_quantity", "unrestricted_stock"),
    "snapshot_date": ("stock_date", "as_of_date", "date"),
    "standard_cost": ("standard_price", "std_cost"),
    "actual_cost": ("moving_average_price", "actual_price", "avg_cost"),
    "lead_time_days": ("lead_time", "planned_delivery_days"),
    "on_time_delivery_rate": ("otd", "otd_rate", "on_time_rate"),
}

# {profile: {target: {canonical_field: (source column names, ...)}}}
SOURCE_ALIASES: dict[str, dict[str, dict[str, tuple[str, ...]]]] = {
    "sap_style": {
        "materials": {
            "material_id": ("MATNR",),
            "description": ("MAKTX",),
            "category": ("MATKL",),
            "unit_of_measure": ("MEINS",),
        },
        "material_suppliers": {"material_id": ("MATNR",), "supplier_id": ("LIFNR",)},
        "material_costs": {
            "material_id": ("MATNR",),
            "standard_cost": ("STPRS",),
            "actual_cost": ("VERPR",),
            "effective_from": ("DATAB",),
            "effective_to": ("DATBI",),
            "currency": ("WAERS",),
        },
        "purchase_records": {
            "purchase_reference": ("EBELN",),
            "material_id": ("MATNR",),
            "supplier_id": ("LIFNR",),
            "purchase_date": ("BEDAT",),
            "quantity": ("MENGE",),
            "unit_price": ("NETPR",),
            "currency": ("WAERS",),
        },
        "inventory_records": {
            "material_id": ("MATNR",),
            "snapshot_date": ("BUDAT",),
            "quantity_on_hand": ("LABST",),
            "inventory_value": ("SALK3",),
            "currency": ("WAERS",),
        },
        "variance_inputs": {
            "material_id": ("MATNR",),
            "standard_price": ("STPRS",),
            "actual_price": ("VERPR",),
            "quantity_purchased": ("MENGE",),
            "currency": ("WAERS",),
        },
        "bom_entries": {
            "product_sku": ("MATNR",),
            "product_description": ("MAKTX",),
            "material_id": ("IDNRK",),
            "bom_quantity": ("MENGE", "KMPMG"),
            "unit_of_measure": ("MEINS", "KMPME"),
            "effective_from": ("DATUV",),
        },
        "production_records": {
            "product_sku": ("MATNR",),
            "period_start": ("GSTRP",),
            "period_end": ("GLTRP",),
            "planned_volume": ("PSMNG",),
            "actual_volume": ("WEMNG",),
            "unit_of_measure": ("MEINS",),
        },
        "demand_forecasts": {
            "material_id": ("MATNR",),
            "forecast_quantity": ("PRWRT",),
            "unit_of_measure": ("MEINS",),
        },
        "supplier_operations_metrics": {
            "supplier_id": ("LIFNR",),
            "material_id": ("MATNR",),
            "lead_time_days": ("PLIFZ",),
        },
        "financial_plan_records": {"material_id": ("MATNR",), "currency": ("WAERS",)},
    },
    "dynamics_style": {
        "materials": {
            "material_id": ("ItemNumber", "ItemId"),
            "description": ("ProductName", "ItemName"),
            "category": ("ItemGroupId", "ProductCategory"),
            "unit_of_measure": ("UnitId", "InventoryUnitSymbol"),
        },
        "material_suppliers": {
            "material_id": ("ItemNumber", "ItemId"),
            "supplier_id": ("VendAccount", "VendorAccountNumber"),
            "is_primary": ("IsPrimaryVendor",),
        },
        "material_costs": {
            "material_id": ("ItemNumber", "ItemId"),
            "standard_cost": ("StandardCost", "CostPrice"),
            "actual_cost": ("ActualCost", "UnitCost"),
            "effective_from": ("FromDate", "ActivationDate"),
            "effective_to": ("ToDate",),
            "currency": ("CurrencyCode",),
        },
        "purchase_records": {
            "purchase_reference": ("PurchId", "PurchaseOrderNumber"),
            "material_id": ("ItemNumber", "ItemId"),
            "supplier_id": ("VendAccount", "OrderVendorAccountNumber"),
            "purchase_date": ("OrderDate", "PurchaseOrderDate"),
            "quantity": ("PurchQty", "OrderedPurchaseQuantity"),
            "unit_price": ("PurchPrice", "PurchasePrice"),
            "currency": ("CurrencyCode",),
        },
        "inventory_records": {
            "material_id": ("ItemNumber", "ItemId"),
            "snapshot_date": ("TransDate", "InventoryDate"),
            "quantity_on_hand": ("PhysicalInventory", "AvailPhysical"),
            "inventory_value": ("PostedValue", "InventoryValue"),
            "currency": ("CurrencyCode",),
        },
        "variance_inputs": {
            "material_id": ("ItemNumber", "ItemId"),
            "standard_price": ("StandardPrice",),
            "actual_price": ("ActualPrice",),
            "quantity_purchased": ("PurchQty",),
            "currency": ("CurrencyCode",),
        },
        "bom_entries": {
            "product_sku": ("ProductNumber", "BOMId", "ParentItemNumber"),
            "product_description": ("ProductName",),
            "material_id": ("ItemNumber", "ComponentItemNumber"),
            "bom_quantity": ("BOMQuantity", "Quantity"),
            "unit_of_measure": ("UnitId", "BOMUnitSymbol"),
            "effective_from": ("FromDate",),
            "effective_to": ("ToDate",),
        },
        "production_records": {
            "product_sku": ("ItemNumber", "ProductNumber"),
            "period_start": ("ScheduledStartDate", "StartDate"),
            "period_end": ("ScheduledEndDate", "EndDate"),
            "planned_volume": ("QtySched", "ScheduledQuantity"),
            "actual_volume": ("QtyGood", "ReportedGoodQuantity"),
            "unit_of_measure": ("UnitId",),
        },
        "demand_forecasts": {
            "material_id": ("ItemNumber", "ItemId"),
            "period_start": ("StartDate",),
            "period_end": ("EndDate",),
            "forecast_quantity": ("ForecastQuantity", "Quantity"),
            "unit_of_measure": ("UnitId",),
        },
        "supplier_operations_metrics": {
            "supplier_id": ("VendAccount", "VendorAccountNumber"),
            "material_id": ("ItemNumber",),
            "metric_date": ("MetricDate", "TransDate"),
            "lead_time_days": ("LeadTime", "PurchLeadTime"),
        },
        "financial_plan_records": {
            "material_id": ("ItemNumber", "ItemId"),
            "period_start": ("StartDate",),
            "period_end": ("EndDate",),
            "currency": ("CurrencyCode",),
        },
    },
}


def normalise(name: str) -> str:
    """Case- and punctuation-insensitive form of a column name used for matching."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def suggest_mapping(target: TargetSpec, source_profile: str, columns: list[str]) -> dict[str, str]:
    """
    Suggest {canonical_field: source_column} for the uploaded columns.

    Preset names for the chosen profile are tried first, then the canonical name and common
    synonyms. A source column is suggested for at most one field.
    """
    by_normalised: dict[str, str] = {}
    for column in columns:
        by_normalised.setdefault(normalise(column), column)

    preset = SOURCE_ALIASES.get(source_profile, {}).get(target.key, {})
    used: set[str] = set()
    suggestion: dict[str, str] = {}
    for spec in target.fields:
        candidates = (*preset.get(spec.name, ()), spec.name, *GENERIC_SYNONYMS.get(spec.name, ()))
        for candidate in candidates:
            column = by_normalised.get(normalise(candidate))
            if column is not None and column not in used:
                suggestion[spec.name] = column
                used.add(column)
                break
    return suggestion


def suggest_all_profiles(target_key: str, columns: list[str]) -> dict[str, dict[str, str]]:
    """Suggestions for every source profile, so the user can switch without re-uploading."""
    target = TARGETS_BY_KEY[target_key]
    return {profile: suggest_mapping(target, profile, columns) for profile in SOURCE_PROFILES}


def best_profile(target_key: str, suggestions: dict[str, dict[str, str]]) -> str:
    """The profile whose suggestion covers the most required fields (ties favour generic)."""
    target = TARGETS_BY_KEY[target_key]
    required = {f.name for f in target.fields if f.required}

    def score(profile: str) -> tuple[int, int]:
        mapped = suggestions[profile]
        return len(required & mapped.keys()), len(mapped)

    return max(SOURCE_PROFILES, key=lambda p: (score(p), p == "generic"))
