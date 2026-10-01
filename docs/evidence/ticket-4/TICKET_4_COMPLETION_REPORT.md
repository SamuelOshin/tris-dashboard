## Ticket 4 — Canonical Manufacturing Schema — COMPLETE

Branch: `v2.0-manufacturing-extension`. Raw evidence files are alongside this report.

### Acceptance criteria checked:

- **All tables from Section 3 exist as migrations:** PASS
  - 11 new tables: `materials`, `material_suppliers`, `material_costs`, `purchase_records`, `inventory_records`, `variance_inputs`, `bom_entries`, `production_records`, `demand_forecasts`, `supplier_operations_metrics`, `financial_plan_records`.
  - One new Alembic revision `a4c7d1e9b302` (parent `cbbdff801f48`). No existing migration file was edited.
  - `alembic upgrade head` on the dev database ran cleanly; `alembic check` then reported "No new upgrade operations detected" (models and migration agree). See `alembic_upgrade_head.txt`.
  - The optional `ExternalDriverReference` table was **not** built (see decisions).
- **`RiskCase` extension is backward-compatible — every existing case row gets `case_category = "financial_exception"`, no existing case's behavior changes:** PASS
  - Dev database: the 7 existing cases were all `financial_exception` after the migration.
  - `test_migration_backfills_existing_cases_and_round_trips` builds the real schema in a scratch database, downgrades to the pre-Ticket-4 revision, inserts a legacy case row with raw SQL, runs the **real migration**, and asserts the row is now `financial_exception` with its status/priority untouched and the three new fields `NULL`; it then runs `alembic check` for drift.
  - Further tests: ORM default, raw-SQL insert gets the database default, invalid category rejected by `ck_risk_cases_case_category`, a `material_cost_risk` case links to a material and stores horizon/exposure, unknown material rejected, existing case API and the state machine behave as before.
- **`DATA_DICTIONARY.md` documents every field, unit, required/optional status:** PASS — `docs/DATA_DICTIONARY.md`, written from the models (all 11 tables, the `risk_cases` extension, conventions, and what was not built).

### Verification commands run (raw output):

```
alembic upgrade head                                    -> ok, now a4c7d1e9b302 (head); alembic check: no drift
                                                           alembic_upgrade_head.txt
pytest tests/test_acceptance_t01_t10.py -v              -> 15 passed in 130.85s   acceptance_t01_t10.txt
pytest tests/modules/v1/test_case_category_backward_compat.py -v
                                                        -> 7 passed in 43.65s     case_category_backward_compat.txt
pnpm run build (for the small UI fix below)             -> exit=0, 20/20 pages    frontend_build.txt
```

### Regression check (required from Ticket 2 onward):

```
cd backend && uv run pytest tests/ -q
163 passed, 5 warnings in 553.74s (0:09:13)
```
- 163 = 141 (after Ticket 2) + 22 new (7 in `test_case_category_backward_compat.py`, 15 in `test_manufacturing_schema.py`). Zero failures or errors. Full output: `backend_regression.txt`.
- `ruff check` and `ruff format --check`: clean.

### Also in this commit (requested): hide section title on "Access restricted"

Roles without Manufacturing access no longer see which section they tried to open. Verified live as `verifier`: the page shows only "TRIS Studio › Manufacturing" and "Access restricted" (`01_verifier_access_restricted_no_section_title.jpg`). This edits a Ticket 3 file (`manufacturing-page.tsx`).

### Files changed:

New: `backend/app/api/modules/v1/manufacturing/models/*` (4 model files + `__init__`), `backend/alembic/versions/a4c7d1e9b302_*.py`, `backend/tests/modules/v1/test_case_category_backward_compat.py`, `backend/tests/modules/v1/test_manufacturing_schema.py`, `docs/DATA_DICTIONARY.md`, `docs/evidence/ticket-4/*`.
Modified: `backend/app/api/modules/v1/cases/models/risk_case.py` (+4 columns, 1 check constraint), `backend/app/api/db/model_registry.py` (+1 line), `frontend/components/manufacturing/manufacturing-page.tsx`.
Not touched: any case service/route/schema, the state machine, rules, reconstruction, remediation, RBAC.

### Anything interpreted or decided that wasn't explicitly specified:

1. **Field-level design is mine.** Section 3 lists tables and a few examples of contents, not columns. I chose the columns, types, units and constraints and documented them in `DATA_DICTIONARY.md`. Examples: `reported_ppv_amount` (PPV stored as supplied, not recomputed); `on_time_delivery_rate` as a 0–1 fraction; `risk_indicator` as free text; separate `budget`/`forecast`/`actual` amount columns on `financial_plan_records`; a demand forecast may reference a product SKU or a material. Please review these against how real ERP exports look.
2. **Two columns added to every fact table that the spec did not list:** `dataset_id` (free-text tag, no registry table yet and not a foreign key) and `recorded_at` (when TRIS recorded the row). Reason: later tickets need a visible dataset identity (Ticket 12 environments) and a "known by this date" boundary for validation (Ticket 11), and adding them later would need another migration across all tables.
3. **Database-level `CHECK` constraints** (positive quantities, non-negative prices, period end not before start, "at least one volume/amount", 0–1 delivery rate). Not specified; they make bad data fail loudly instead of silently feeding analytics.
4. **`ExternalDriverReference` not created**, per the specification's own condition (no legitimate external source exists; no placeholder index).
5. **`case_category` is text plus a `CHECK` constraint, not a database enum / `Literal`.** `forecast_horizon` is an integer number of days; `projected_exposure_amount` is a float. The spec gave names only.
6. **The migration is deliberately re-runnable** (it skips tables, columns and indexes that already exist). Reason: the app runs `create_all()` on startup, so a running dev server can create the new tables before `alembic upgrade head` does. Hand-written rather than autogenerated.
7. **I applied the migration to the dev database** (`tris_db`), as the ticket's `alembic upgrade head` command requires. Because the dev backend reloads automatically, its tables may have been created by startup before the migration ran; the migration's own creation path is therefore proven by the scratch-database test, not by the dev run.
8. **The new test creates and drops a scratch database** (`tris_migration_check_test`) and runs Alembic as a subprocess (about 40 seconds). It runs under the existing session lock, and the name contains `test`, matching the repo's safety rule.
9. **API response shapes were not changed.** The new `RiskCase` fields are stored but not yet returned by the case endpoints; exposing them belongs with Ticket 10's case-detail work.
10. **No routes, services or schemas** were added for the new tables. The 4-layer module has only `models/` for now; later tickets add the rest.

### QA review outcome

Independent QA verdict: **ACCEPT WITH FOLLOW-UP NOTED** (163 passed on its own full run; migration and models verified identical, including CHECK constraints).
- Fixed: `DATA_DICTIONARY.md` wording for `recorded_at` (the default is applied by the application, not the database).
- Left as is, by decision: the `risk_cases` foreign-key guard checks by name (`fk_risk_cases_material_id`); a duplicate foreign key is only possible if `create_all` had added the columns, which it does not do for an existing table. The migration is already applied to the dev database, so it was not edited after review. The FK is named differently on the `create_all` path (`risk_cases_material_id_fkey`) than on the migration path; this is cosmetic.
- Not added: an assertion in the migration test for the CHECK constraint names (`alembic check` does not compare them; the reviewer's own comparison found them identical).

### Not done / open:

- The v1.4 "before" screenshots (Ticket 1 follow-up) are still to be added by the project owner.
- `process_owner` still has no seeded dev user, so its UI view was never exercised live.
