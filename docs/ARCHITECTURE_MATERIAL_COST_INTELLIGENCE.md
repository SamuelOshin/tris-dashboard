# TRIS v2.0 — Material Cost Intelligence: Architecture

How the manufacturing extension is built on top of TRIS v1.4: modules, data flow, interfaces, the rules that
keep results trustworthy, and what is deliberately **not** part of it. For what each calculation means see the
method documents linked in section 8.

> **Scope of this document.** It describes what exists on branch `v2.0-manufacturing-extension`. Anything not
> built is listed in section 9, not described as a feature.

## 1. Where it sits

The extension is one more domain module group inside the existing application. It adds no second app, no new
service and no new database; it reuses authentication, roles, the case lifecycle, the response envelopes and the
migration/trigger approach of v1.4.

```
Browser (Next.js 16, App Router)
   │  /api/* proxied
   ▼
FastAPI  ── core/ (auth, RBAC dependencies, exceptions, response payloads)
   ├── modules/v1/{auth, cases, suppliers, rules, ingestion, transactions, reconstruction, remediation, …}   ← v1.4, unchanged
   └── modules/v1/manufacturing/                                                                           ← v2.0
         ├── routes/    HTTP only (8 routers, 36 endpoints)
         ├── service/   all logic (pure engines + thin DB services)
         ├── models/    SQLModel tables (22)
         └── schemas/   request/response DTOs
   ▼
PostgreSQL 16 (one database; immutability enforced by triggers)
```

The existing 4-layer rule (`routes` → `service` → `models`/`schemas`) holds for every file: routes only parse and
respond, services hold the logic and raise domain exceptions, there is no `try/except` hiding errors.

## 2. Modules

| Router (`/api/v1/manufacturing/…`) | Purpose | Main service files |
|:---|:---|:---|
| `mapping` | Upload a CSV/Excel file, preview it, match its columns to the canonical schema, dry-run, import, error log, saved mapping profiles | `mapping_service`, `mapping_engine`, `mapping_targets`, `source_profiles`, `value_coercion`, `file_parser` |
| `analytics` | Price/BOM/inventory/supplier signals per material, computed from stored data | `analytics_service`, `analytics_loader`, `detection_engine`, `detectors_price`, `detectors_exposure` |
| `forecasting` | 30- and 90-day price forecasts; stored, immutable model runs | `forecast_service`, `forecast_engine`, `forecast_models`, `forecast_history` |
| `exposure` | Financial exposure from stored forecasts; what-if scenarios (never stored) | `exposure_service`, `exposure_engine` |
| `risk-scoring` | Explainable 0–100 material risk score; versioned weight sets; stored immutable scores | `risk_scoring_service`, `risk_scoring_engine`, `risk_factors` |
| `material-cases` | Open and link a Risk Case from a stored High/Critical score | `material_case_service` |
| `validation` | Retrospective validation runs and their stored results | `validation_service`, `validation_metrics` |
| `admin` (administrators only) | Forecast model settings, dataset registry, configuration overview, audit-log reading | `admin_service`, `model_settings_service`, `dataset_registry_service`, `admin_audit` |

Frontend (`frontend/components/manufacturing/…`, one folder per page, hook + guards + types per feature, files under
300 lines): `material-cost/`, `erp-mapping/`, `forecasting/` (price forecast) and `exposure/` (exposure and
scenarios, shown on the Forecasting page), `risk-score/`, `validation/`, `administration/`; case pages extended under
`components/cases/material/`.

## 3. Data flow

```
 CSV / Excel file ──► preview ──► column mapping (config) ──► dry run ──► import ──► canonical tables
                                                                                         │
        ┌────────────────────────────────────────────────────────────────────────────────┘
        ▼
  detection signals ──► forecast (30/90 d) ──► exposure ──► risk score ──► Risk Case ──► existing lifecycle
   (computed on read)    (stored run)          (computed     (stored,      (stored,       (investigate →
                                                on read)      versioned)    linked)        verified closure)
        └────────────────────────── retrospective validation (reads all of the above, writes only its own tables)
```

- **Stored** (insert-only): forecast runs, risk weight sets, risk scores, validation runs/cases/outcomes/summaries/
  failures, forecast model settings and the audit log. Re-running adds a new row; nothing is edited or deleted. (Import jobs are records too, but are
  updated while an import runs.)
- **Computed on read, never stored**: detection signals, exposure rows and roll-ups, scenarios. A scenario can
  never change a stored forecast or exposure baseline (tested byte for byte).
- **Scope**: every result is for one data scope, either "all data" or one named dataset. Stored forecasts and
  scores are kept per scope, so results for a chosen dataset are separate from results for all data. The screens
  default to "all data".

## 4. Canonical data model (22 tables)

Reference data: `materials`, `material_suppliers`, `material_costs`, `bom_entries`. Activity: `purchase_records`,
`inventory_records`, `variance_inputs`, `production_records`, `demand_forecasts`, `supplier_operations_metrics`,
`financial_plan_records`. Configuration: `mapping_profiles`, `material_risk_weight_sets`,
`forecast_model_settings`, `dataset_registry`. Results:
`forecast_runs`, `material_risk_scores`, `validation_runs`, `validation_cases`, `validation_outcomes`,
`validation_summaries`, `validation_failures`. Field meanings: `DATA_DICTIONARY.md`. Suppliers stay in the v1.4
`suppliers` table. Material cost cases are ordinary v1.4 `risk_cases` rows with `case_category =
'material_cost_risk'` plus `material_id`, `forecast_horizon` and `projected_exposure_amount`.

Records carry an optional `dataset_id` (the name given at import) so two environments can live in one database.

## 5. Engines are pure; services are thin

Calculation lives in functions that take plain data and return plain data (`forecast_engine.run_horizon`,
`exposure_engine.baseline_exposure`, `risk_scoring_engine.score_material`, `validation_metrics.*`,
`detection_engine.compute_results`). They need no database and no HTTP, which is why they are unit-tested in the
fast lane (`pytest -m pure`, no database) and why the validation harness can call exactly the production code on
older data. Services load data (`analytics_loader`), call an engine, and store the result.

## 6. Integrity rules that the design enforces

| Rule | How |
|:---|:---|
| No hindsight (D5) | Records are loaded with the date limit in the database query, checked again, and the forecast engine refuses a monthly point after the cutoff. Forecasts and signals are saved before any later actual is read. |
| Never rewrite history | Database triggers refuse `UPDATE`/`DELETE` on forecast runs, risk weight sets, risk scores, the validation tables and (v1.4) case history. A model or weight change creates a new version/run. |
| No invented numbers | Missing data returns "not enough data" with the reason; a missing month ends a usable history and is never filled; scores with under half of the weighting available return no score. |
| Explainable | Every forecast stores model, version, dataset fingerprint, candidates compared and the reason one was chosen; every score stores its factors, inputs and weight version. |
| Governance unchanged | A material case uses the v1.4 state machine and separation of duties; the audit actor comes from the signed-in user, never from the request body. |
| Audit | Imports, mapping saves/deletes, forecast and scoring runs, risk-weight changes, validation runs and failures, opened material cases, model switches and dataset label changes each write one row to the audit log (`security_audit_log`, which also holds sign-ins and rule edits) in the same transaction as the action. The log is insert-only (database trigger) and the actor comes from the signed-in user. |
| Roles | `admin`, `reviewer` (run and import), `read_only_reviewer` (view only), plus the unchanged `verifier` and `process_owner`. Checked on every endpoint in the backend, and mirrored in the navigation. |
| Synthetic data labelled | The sign-in page says "Evaluation environment · Synthetic test data only"; sample files are documented as synthetic. |

## 7. Technology

Backend Python 3.12, FastAPI, SQLModel/SQLAlchemy async, PostgreSQL 16, Alembic, `statsmodels` (OLS regression
models, decision D6), `numpy`, `pandas` (file reading). Frontend Next.js 16, shadcn/ui, Tailwind. Tests: pytest
with a dedicated test database; a `pure` lane that never touches the database; `docs/case_study/` figures are
re-checked by a test.

## 8. Related documents

`DATA_DICTIONARY.md` · `ERP_MAPPING_GUIDE.md` · `MATERIAL_DETECTION_METHOD.md` · `MODEL_METHODOLOGY.md` ·
`FINANCIAL_EXPOSURE_METHOD.md` · `RISK_SCORING_METHOD.md` · `MATERIAL_CASE_INTEGRATION.md` ·
`VALIDATION_PROTOCOL.md` · `VALIDATION_RESULTS.md` · `TRANSFERABILITY_TEST.md` · `UI_NAVIGATION_SPEC.md` ·
`CASE_STUDY_01.md` · `DEMO_GUIDE.md` · `HANDOVER_AND_CHANGELOG.md`.

## 9. Not built (so not claimed)

- **No ERP connection.** SAP-style and Dynamics-style are file-layout presets for uploaded files.
- **The v1.x Compliance page was taken out of navigation** (2026-10-07): its "Global Audit Trail", scores and framework
  statuses were fixed sample content, not real events. `/compliance` now redirects to the dashboard and the menu item is
  gone. The real audit log is on the Administration page.
- **Administration is for forecast models, risk weights, datasets, saved mappings and the audit log.** It does not manage
  users (that stays on Settings & Governance), cannot change the fixed forecast settings (they belong to a method
  version) and cannot switch off the baseline models.
- No forecasting by supplier, no demand-driven forecasts, no unit conversion between purchase and BOM units, no
  currency conversion.
- The "Case Studies / Results" page is a placeholder; the case study is a document (`CASE_STUDY_01.md`) plus a
  re-runnable script.
- (Fixed in Ticket 13.) The migration history used to start after the original tables, so it could not build an
  empty database; a baseline revision now creates them, and `alembic upgrade head` builds a complete database,
  including the case-history immutability trigger. The application no longer creates tables when it starts: it
  checks that the database is at the newest migration and refuses to start (with the command to run) if it is not.
  The seed script does the same check. An opt-in `AUTO_MIGRATE=true` setting makes start-up run the migrations first
  (one instance at a time, under a database lock); it is off by default, see `HANDOVER_AND_CHANGELOG.md`.
