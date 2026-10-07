# TRIS v2.0 — Manufacturing Data Dictionary

Defines every table and field added for the Material-Cost Intelligence extension (Ticket 4),
and the `risk_cases` extension (decision D3). Source of truth is the models in
`backend/app/api/modules/v1/manufacturing/models/` and the migration
`backend/alembic/versions/a4c7d1e9b302_add_manufacturing_schema_and_case_category.py`.

The first sections describe **what is stored from source systems**: nothing there is a prediction or a score.
The last section, *Result tables*, describes what the analyses store (forecast runs, risk weights and scores,
validation runs); those are results, kept apart and never edited.

## Conventions used by every manufacturing table

| Convention | Meaning |
|:---|:---|
| **Required** | Column is `NOT NULL`. **Optional** columns may be `NULL`; `NULL` means *not supplied by the source system*, never zero. |
| **Dates** | `date` columns are calendar dates with no time zone. Period ranges are inclusive (`period_end >= period_start` is enforced). |
| **Timestamps** | `timestamptz` (timezone-aware, stored in UTC). |
| **Currency** | 3-letter ISO 4217 code by convention (for example `USD`), stored as text up to 10 characters. Not validated against the ISO list. Amounts are **not** converted between currencies. |
| **Quantities and prices** | Stored as double-precision floats. Quantities are in the unit named by the related `unit_of_measure`. Prices are per **one** unit of that measure, in the row's currency. |
| **`dataset_id`** | Optional free-text tag (max 100) naming the source dataset or environment a row came from. There is **no dataset registry table yet**; it is a plain tag, not a foreign key. |
| **`recorded_at`** | Required. When TRIS recorded the row. The application fills it with the time of insert; the database has no default of its own, so a direct SQL insert must supply it. Used so later analysis can restrict itself to what was known at a given date (no hindsight). It is independent of the business dates in the row. |
| **Identifiers** | Business keys from the source system (`material_id`, `product_sku`) are text. Rows without a natural key use an auto-incrementing integer `id`. |
| **Suppliers** | Supplier identity is **not duplicated**: supplier columns are foreign keys to the existing `suppliers.supplier_id`. |

## Tables

### `materials` — material master
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `material_id` | text(50), **PK** | Required | Source-system material / part number. |
| `description` | text(500) | Required | Human-readable name. |
| `category` | text(100) | Optional | Grouping such as "Metals" (indexed). |
| `unit_of_measure` | text(20) | Required | Base unit for quantities of this material (for example `kg`, `m`, `pcs`). |
| `is_active` | boolean | Required | Default `true`. |
| `dataset_id`, `recorded_at` | — | Optional / Required | See conventions. |

### `material_suppliers` — which suppliers can supply which material
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `id` | integer, **PK** | Required | Auto-generated. |
| `material_id` | text(50), FK → `materials` | Required | |
| `supplier_id` | text(50), FK → `suppliers` | Required | Existing supplier table. |
| `is_primary` | boolean | Required | Default `false`. |
| `risk_indicator` | text(20) | Optional | Source-supplied label (for example `Low`, `Medium`, `High`). Free text; not validated. |
| `dataset_id`, `recorded_at` | — | — | See conventions. |

Constraint: one row per (`material_id`, `supplier_id`) — `uq_material_supplier`.

### `material_costs` — standard / actual / budget cost, versioned
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `id` | integer, **PK** | Required | |
| `material_id` | text(50), FK → `materials` | Required | |
| `version` | integer | Required | Default 1. A new cost set for the same material is a **new version**, never an overwrite. |
| `effective_from` | date | Required | First day this version applies. |
| `effective_to` | date | Optional | Last day it applies; `NULL` = open-ended. |
| `standard_cost` | float | Optional | Planned cost per unit of the material's `unit_of_measure`. |
| `actual_cost` | float | Optional | Realised cost per unit. |
| `budget_cost` | float | Optional | Budget / reference cost per unit. |
| `currency` | text(10) | Required | Default `USD`. |

Constraints: unique (`material_id`, `version`); every supplied cost is `>= 0`.

### `purchase_records` — purchase lines
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `id` | integer, **PK** | Required | |
| `purchase_reference` | text(100) | Optional | Source purchase-order or line reference (indexed). |
| `material_id` | text(50), FK → `materials` | Required | |
| `supplier_id` | text(50), FK → `suppliers` | Optional | |
| `purchase_date` | date | Required | |
| `quantity` | float | Required | In the material's unit of measure. Must be `> 0`. |
| `unit_price` | float | Required | Price per unit, in `currency`. Must be `>= 0`. |
| `currency` | text(10) | Required | Default `USD`. |

### `inventory_records` — inventory position
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `id` | integer, **PK** | Required | |
| `material_id` | text(50), FK → `materials` | Required | |
| `snapshot_date` | date | Required | Date the position was true. |
| `quantity_on_hand` | float | Required | In the material's unit of measure; `>= 0`. |
| `inventory_value` | float | Optional | Value of the stock in `currency`; `>= 0`. |
| `currency` | text(10) | Required | Default `USD`. |
| `days_of_supply` | float | Optional | Coverage in days where the source provides it; `>= 0`. Not derived by TRIS in this table. |

### `variance_inputs` — purchase price variance (PPV) or its inputs
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `id` | integer, **PK** | Required | |
| `material_id` | text(50), FK → `materials` | Required | |
| `period_start`, `period_end` | date | Required | Inclusive; end not before start. |
| `standard_price` | float | Optional | Per unit, in `currency`. |
| `actual_price` | float | Optional | Per unit, in `currency`. |
| `quantity_purchased` | float | Optional | Material's unit of measure. |
| `reported_ppv_amount` | float | Optional | PPV as reported by the source (currency amount, positive = paid more than standard). Stored as supplied; not recomputed here. |
| `currency` | text(10) | Required | Default `USD`. |

### `bom_entries` — bill of materials
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `id` | integer, **PK** | Required | |
| `product_sku` | text(50) | Required | Finished product / SKU. No product master table exists; the SKU is a plain key. |
| `product_description` | text(500) | Optional | |
| `material_id` | text(50), FK → `materials` | Required | Component. |
| `bom_quantity` | float | Required | Material needed for **one** unit of the product, in `unit_of_measure`; must be `> 0`. |
| `unit_of_measure` | text(20) | Required | Unit of `bom_quantity`. |
| `effective_from`, `effective_to` | date | Optional | Validity window of this BOM line; `NULL` = unbounded. |

### `production_records` — production volume
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `id` | integer, **PK** | Required | |
| `product_sku` | text(50) | Required | |
| `period_start`, `period_end` | date | Required | Inclusive. |
| `planned_volume` | float | Optional | Units of the product, in `unit_of_measure`. |
| `actual_volume` | float | Optional | Same unit. |
| `unit_of_measure` | text(20) | Required | |

Constraint: at least one of `planned_volume` / `actual_volume` must be supplied.

### `demand_forecasts` — demand forecast supplied by the source
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `id` | integer, **PK** | Required | |
| `product_sku` | text(50) | Optional | |
| `material_id` | text(50), FK → `materials` | Optional | |
| `period_start`, `period_end` | date | Required | Inclusive. |
| `forecast_quantity` | float | Required | In `unit_of_measure`. |
| `unit_of_measure` | text(20) | Required | |
| `forecast_source` | text(100) | Optional | Who or what produced the forecast (for example "ERP planning"). |

Constraint: at least one of `product_sku` / `material_id` must be present. This is an **input from the
source system**; it is not a TRIS forecast.

### `supplier_operations_metrics` — supplier operations
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `id` | integer, **PK** | Required | |
| `supplier_id` | text(50), FK → `suppliers` | Required | |
| `material_id` | text(50), FK → `materials` | Optional | Metric specific to one material, if applicable. |
| `metric_date` | date | Required | Date the metric describes. |
| `lead_time_days` | float | Optional | Days from order to receipt; `>= 0`. |
| `on_time_delivery_rate` | float | Optional | Fraction from 0 to 1 (not a percentage). |

### `financial_plan_records` — budget / forecast / actual material cost
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `id` | integer, **PK** | Required | |
| `material_id` | text(50), FK → `materials` | Optional | |
| `product_sku` | text(50) | Optional | Plan may be at material, product or overall level. |
| `period_start`, `period_end` | date | Required | Inclusive. |
| `budget_amount` | float | Optional | Currency amount for the whole period. |
| `forecast_amount` | float | Optional | Same. |
| `actual_amount` | float | Optional | Same. |
| `currency` | text(10) | Required | Default `USD`. |

Constraint: at least one of the three amounts must be supplied.

## Extension to an existing table: `risk_cases` (decision D3)

Material-cost risk cases use the **same** `risk_cases` table and lifecycle as financial-exception cases.

| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `case_category` | text(40) | Required | `financial_exception` (default) or `material_cost_risk`. Enforced by `ck_risk_cases_case_category`. The migration backfills every existing case to `financial_exception` through the column default, so no existing case changes. |
| `material_id` | text(50), FK → `materials` | Optional | Only meaningful for `material_cost_risk` cases. |
| `forecast_horizon` | integer | Optional | Outlook length **in days** (for example 30 or 90) that the case relates to. |
| `projected_exposure_amount` | float | Optional | Projected financial exposure in the currency of the source analysis. |

The case state machine, separation of duties, 8-field verified closure and audit trail are unchanged
and have no category-specific branching.

## Mapping profiles (Ticket 5)

### `mapping_profiles` — saved ERP/BOM column mappings
| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `profile_id` | text(50), **PK** | Required | Generated (`PROF-…`). |
| `name` | text(120) | Required | Unique (`ix_mapping_profiles_name`). |
| `description` | text(500) | Optional | |
| `source_profile` | text(30) | Required | Layout the mapping started from: `generic`, `sap_style` or `dynamics_style`. |
| `target` | text(50) | Required | Canonical table the file is mapped into (a table name from this dictionary). |
| `field_mapping` | JSON | Required | `{canonical field: source column}`. |
| `defaults` | JSON | Required | `{canonical field: fixed value}` used where the file has no column. |
| `created_by` | text(50), FK → `users` | Required | Administrator who saved it. |
| `created_at` | timestamptz | Required | |

Imports reuse the existing `ingestion_jobs` table for telemetry (counts, error log, who and when). A job
made by the mapping tool is identified by `summary_report.import_type = "manufacturing_mapping"` and
records the mapping and layout it used. Every canonical row an import creates carries the optional
`dataset_id` the uploader entered. Row-level import rules are in `ERP_MAPPING_GUIDE.md`.

## Result tables (Tickets 7, 9 and 11)

These hold what the analyses produced. They are results, not source facts, and are kept apart from the tables above. Columns are generated from the models; the notes say what each table is for.

### `forecast_runs`
One stored price forecast for one material and horizon (Ticket 7). Insert-only: a database trigger refuses UPDATE and DELETE. A new run never changes an earlier one.

| Field | Type | Required |
|:---|:---|:---|
| `run_id` | text(50), **PK** | Required |
| `material_id` | text(50), FK to `materials.material_id` | Required |
| `dataset_id` | text(100) | Optional |
| `as_of` | date | Required |
| `currency` | text(10) | Optional |
| `horizon_days` | integer | Required |
| `horizon_months` | integer | Required |
| `model_code` | text(50) | Required |
| `model_name` | text(100) | Required |
| `model_version` | text(20) | Required |
| `dataset_version` | text(40) | Required |
| `history_months` | integer | Required |
| `history_start` | date | Required |
| `history_end` | date | Required |
| `forecast_month` | date | Required |
| `forecast_value` | double | Required |
| `lower_bound` | double | Optional |
| `upper_bound` | double | Optional |
| `interval_level` | double | Optional |
| `path` | JSON | Required |
| `candidates` | JSON | Required |
| `selection_rationale` | text(2000) | Required |
| `config` | JSON | Required |
| `created_by` | text(50), FK to `users.user_id` | Required |
| `created_at` | timestamptz | Required |

### `material_risk_weight_sets`
A versioned set of risk-score weights, bands and scales (Ticket 9). Insert-only; the newest row is the active one. Changing weights adds a row.

| Field | Type | Required |
|:---|:---|:---|
| `version` | integer, **PK** | Required |
| `config` | JSON | Required |
| `note` | text(500) | Required |
| `created_by` | text(50) | Required |
| `created_at` | timestamptz | Required |

### `material_risk_scores`
One stored risk score for one material on one date, with its factors and the weight version used (Ticket 9). Insert-only.

| Field | Type | Required |
|:---|:---|:---|
| `score_id` | text(50), **PK** | Required |
| `material_id` | text(50), FK to `materials.material_id` | Required |
| `dataset_id` | text(100) | Optional |
| `as_of` | date | Required |
| `currency` | text(10) | Optional |
| `method_version` | text(20) | Required |
| `weight_version` | integer, FK to `material_risk_weight_sets.version` | Required |
| `score` | double | Required |
| `level` | text(20) | Required |
| `data_coverage_pct` | double | Required |
| `factors` | JSON | Required |
| `summary` | text(1000) | Required |
| `config` | JSON | Required |
| `forecast_run_id` | text(50) | Optional |
| `inputs_version` | text(40) | Required |
| `created_by` | text(50), FK to `users.user_id` | Required |
| `created_at` | timestamptz | Required |

### `validation_runs`
The header of a retrospective validation run: settings, versions and cutoffs (Ticket 11). Insert-only. A run without a summary row did not finish.

| Field | Type | Required |
|:---|:---|:---|
| `run_id` | text(50), **PK** | Required |
| `dataset_id` | text(100) | Optional |
| `data_end` | date | Required |
| `config` | JSON | Required |
| `versions` | JSON | Required |
| `note` | text(500) | Optional |
| `created_by` | text(50), FK to `users.user_id` | Required |
| `created_at` | timestamptz | Required |

### `validation_cases`
A forecast and warning signal frozen at one cutoff for one material and outlook, stored before any later data is read (Ticket 11). Insert-only.

| Field | Type | Required |
|:---|:---|:---|
| `case_id` | text(50), **PK** | Required |
| `run_id` | text(50), FK to `validation_runs.run_id` | Required |
| `material_id` | text(50), FK to `materials.material_id` | Required |
| `cutoff` | date | Required |
| `horizon_days` | integer | Required |
| `status` | text(20) | Required |
| `withheld_reason` | text(500) | Optional |
| `target_month` | date | Optional |
| `currency` | text(10) | Optional |
| `last_observed_price` | double | Optional |
| `forecast_value` | double | Optional |
| `lower_bound` | double | Optional |
| `upper_bound` | double | Optional |
| `naive_value` | double | Optional |
| `model_code` | text(50) | Optional |
| `model_name` | text(100) | Optional |
| `model_version` | text(20) | Optional |
| `dataset_version` | text(40) | Optional |
| `history_months` | integer | Optional |
| `risk_score` | double | Optional |
| `risk_level` | text(20) | Optional |
| `alert` | boolean | Required |
| `risk_factors` | JSON | Required |
| `frozen_at` | timestamptz | Required |

### `validation_outcomes`
What actually happened for a frozen case, written only afterwards; at most one per case (Ticket 11). Insert-only.

| Field | Type | Required |
|:---|:---|:---|
| `outcome_id` | text(50), **PK** | Required |
| `case_id` | text(50), FK to `validation_cases.case_id` | Required |
| `run_id` | text(50), FK to `validation_runs.run_id` | Required |
| `status` | text(20) | Required |
| `reason` | text(500) | Optional |
| `metrics` | JSON | Required |
| `classification` | text(2) | Optional |
| `revealed_at` | timestamptz | Required |

### `validation_summaries`
The aggregate metrics, limitations and the list of false alarms and misses of a finished run (Ticket 11). Insert-only.

| Field | Type | Required |
|:---|:---|:---|
| `run_id` | text(50), **PK**, FK to `validation_runs.run_id` | Required |
| `metrics` | JSON | Required |
| `limitations` | JSON | Required |
| `problems` | JSON | Required |
| `completed_at` | timestamptz | Required |

### `validation_failures`
Why a run stopped before it finished (Ticket 11). Insert-only.

| Field | Type | Required |
|:---|:---|:---|
| `failure_id` | text(50), **PK** | Required |
| `run_id` | text(50), FK to `validation_runs.run_id` | Required |
| `error_type` | text(100) | Required |
| `message` | text(1000) | Required |
| `recorded_at` | timestamptz | Required |

## Administration tables

### `forecast_model_settings` — whether a forecast model may be used
Insert-only (a database trigger refuses UPDATE and DELETE). One row per change; the newest row of a model is its current
state, and a model with no row is on.

| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `id` | integer, **PK** | Required | |
| `model_code` | text(50) | Required | For example `lagged_regression`. Baseline models cannot be switched off (checked by the service). |
| `enabled` | boolean | Required | |
| `note` | text(500) | Optional | The reason given. |
| `changed_by` | text(50), FK to `users` | Required | The administrator. |
| `changed_at` | timestamptz | Required | |

### `dataset_registry` — named datasets
Created by a dataset's first import. The label is an administrator's statement; a label change is audited.

| Field | Type | Required | Notes |
|:---|:---|:---|:---|
| `dataset_id` | text(100), **PK** | Required | The dataset name typed at import. |
| `label` | text(20) | Required | `unlabelled` (default), `synthetic` or `authorized`. |
| `source_type` | text(40) | Required | `file upload`. |
| `description` | text(500) | Optional | |
| `registered_by` | text(50), FK to `users` | Required | |
| `registered_at` | timestamptz | Required | |
| `label_set_by`, `label_set_at` | text(50) FK to `users`, timestamptz | Optional | Who last set the label, and when. |

### `security_audit_log` — the audit log (extended)
An existing v1.4 table (sign-ins, rule edits, user changes). It now also records the manufacturing actions: `DATA_IMPORT`,
`MAPPING_PROFILE_SAVED`, `MAPPING_PROFILE_DELETED`, `FORECAST_RUN`, `RISK_WEIGHTS_CREATED`, `RISK_SCORING_RUN`,
`VALIDATION_RUN`, `VALIDATION_FAILED`, `MATERIAL_CASE_OPENED`, `MODEL_SETTING_CHANGED`, `DATASET_REGISTERED`,
`DATASET_LABEL_CHANGED`. Each is written with the action it describes, in the same transaction. The table is now insert-only
(trigger). `occurred_at` is stored as UTC without a zone and returned with `+00:00`.

## Not implemented

- **`ExternalDriverReference`** (optional in the specification): not created. It is only to be built if a
  legitimate external data source is actually available; none is, and a placeholder commodity index must
  not be fabricated.
- No dataset-registry table (see `dataset_id`) and no product master table (see `product_sku`).
