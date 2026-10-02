## Ticket 7 — Forecasting — COMPLETE (awaiting QA and commit)

Branch: `v2.0-manufacturing-extension`. Raw evidence files are alongside this report. Not committed yet.

### Acceptance criteria checked

- **Naive, moving-average and exponential-smoothing baselines implemented:** PASS (`forecast_models.py`, numpy only; values checked in `test_baseline_models_compute_the_documented_values`).
- **At least one regression / time-series regression model, compared against baselines on held-out data:** PASS. Two `statsmodels` OLS models (linear trend; lagged price). Every model is scored by rolling-origin evaluation on 4 held-out months it never saw; scores recomputed by hand in `test_held_out_scores_match_a_hand_calculation`. `pip show statsmodels` → 0.15.0 (`pip_show_statsmodels.txt`).
- **Model metadata stored with every run (name, version, dataset version, horizon, selection rationale):** PASS. Immutable `forecast_runs` row; full record in `stored_run_record_full.json` and the matching database row in `stored_run_db_row.txt` (model Lagged price regression v1.0, dataset version `sha256:410e18f0682c43fc`, horizon 90 days, 23 months of history, rationale with numbers).
- **30/90-day outlook shown only when the data supports it:** PASS. 30-day needs 13 consecutive months, 90-day needs 15 (derived from the scoring design in `MODEL_METHODOLOGY.md`). Withheld horizons return the reason, show it on screen, and store nothing. Screenshot `04`: a 14-month material (13 complete months once its incomplete last month is left out) shows its 30-day forecast and "A 90-day outlook needs 15 consecutive months of purchases; 13 are available."

### Required tests (present and passing — `forecasting_engine_tests.txt`)

- `test_forecast_horizon_withheld_when_insufficient_data` (API: 14 months → 90-day withheld and nothing stored; 6 months → both withheld) plus an engine-level twin.
- `test_validation_rejects_post_cutoff_data_leakage` (decision D5): offers post-cutoff points, including a planted 9999 value, and asserts `DataLeakageError`. Companion tests prove scoring fits never include the value they are scored against, and that purchases loaded after the cutoff do not change a stored forecast or its fingerprint.

### Verification commands run (raw output)

```
pip show statsmodels                                      -> 0.15.0                   pip_show_statsmodels.txt
pytest tests/modules/v1/test_forecasting_engine.py -v     -> 22 passed in 41.18s      forecasting_engine_tests.txt
alembic upgrade head / alembic check                      -> d7f4a2b8c935; no drift   alembic_check.txt
pnpm run build                                            -> exit 0, includes /manufacturing/forecasting   frontend_build.txt
ruff check . / ruff format --check .                      -> clean                    ruff.txt
grep -rn "hardcoded\|TODO.*mock" app/manufacturing components/manufacturing -> none   hardcoded_grep.txt
```

### Regression check — a failure was found and fixed

```
cd backend && uv run pytest tests/ -q
1 failed, 238 passed in 2344.64s (0:39:04)      backend_regression.txt
FAILED tests/modules/v1/test_case_category_backward_compat.py::test_migration_backfills_existing_cases_and_round_trips
```
Cause (confirmed in the log): my new `forecast_runs` table has a foreign key to `materials`. Ticket 4's migration round-trip test stamped the scratch database at its own revision, ignoring later migrations, so downgrading could not drop `materials`. A real downgrade removes newer tables first. **Fix (test only):** the test now stamps at head and downgrades through the real chain, and also asserts the tables of Tickets 5 and 7 are removed. That file now passes (7 passed), which also exercises the downgrades of the Ticket 5 and Ticket 7 migrations. **The full suite was not re-run end to end after this test fix**; the other 238 tests passed on the same code, so the expected total is 239.

### Files changed

New: `models/forecast_run.py`; migration `d7f4a2b8c935_add_forecast_run_immutability_trigger.py`; `service/{forecast_types, forecast_history, forecast_models, forecast_engine, forecast_service}.py`; `routes/forecast_routes.py`; migration `c6e3f9a1b724_add_forecast_runs.py`; `tests/modules/v1/test_forecasting_engine.py`; frontend `components/manufacturing/forecasting/*` (10 files, all under 125 lines); `docs/MODEL_METHODOLOGY.md`; two synthetic sample files (short-history material); `docs/evidence/ticket-7/*`.
Modified: `app/api/db/triggers.py` (+ forecast_runs immutability trigger SQL), `pyproject.toml` and `uv.lock` (+ `statsmodels`, `scipy`, `patsy` …), `core/custom_exceptions/exceptions.py` (+ `DataLeakageError`), `error_status_code_mapper.py` (+ 422 mapping), `core/dependencies.py` (+ `AnalyticsExecutionUser`), `v1/router.py` (+2 lines), `models/__init__.py`, `app/manufacturing/forecasting/page.tsx`, `tests/modules/v1/test_case_category_backward_compat.py` (see above).
Not touched: the detection analytics, the mapper, v1.4 modules, case workflow.

### Decisions I made that were not specified

1. **Monthly resolution.** "30-day" means next calendar month's average price; "90-day" means three months ahead. Daily forecasting is not possible from purchase lines.
2. **History rule derived from the scoring design**, not picked: 9 training months + 4 scoring origins + (horizon − 1) → 13 and 15. Only the latest unbroken run of months counts; gaps are never filled.
3. **Selection rule:** a regression is chosen only if it beats the best baseline by ≥ 10% held-out MAE; otherwise the baseline. I first used 3 origins and 5%, saw a regression "win" on flat noise by chance, and tightened both. Results on the sample data are mixed (baselines for some materials, a regression for others), which is the rule working.
4. **Prediction band only for the regression models** (80% OLS prediction interval); approximate, documented as probably somewhat narrow.
5. **Immutability** is enforced by the service (no update/delete path) and, after QA review, by a database trigger that refuses UPDATE and DELETE on `forecast_runs` (see QA outcome).
6. **Roles:** running a forecast (which stores a run) = admin and reviewer (`ANALYTICS_EXECUTION_ROLES`); viewing = admin, reviewer, read-only reviewer.
7. **Forecasts are not yet wired into the Material Cost overview** (forecast cost and % change columns) — that arrives with exposure and scoring (Tickets 8–9).
8. **Scenario controls are not built** (Ticket 8); the page says so with a Coming Soon badge.
9. **Sample data:** added a 14-month material (silver paste) and imported it into the dev database so the withheld state is real.
10. **`.claude/launch.json`** gained a frontend entry (untracked) because the frontend dev server was not running.

### QA review outcome

Independent QA verdict: **ACCEPT WITH FOLLOW-UP NOTED** (its own run: forecasting + migration tests 25 passed, `statsmodels` 0.15.0, `tsc` clean; live probes of the withheld horizon, roles and as-of handling; the edit to the Ticket 4 migration test judged legitimate). Fixed after review, each with a test:

1. **Database-level immutability** for `forecast_runs`: new migration `d7f4a2b8c935` plus `triggers.py`; a test proves UPDATE and DELETE are refused while INSERT still works, and a live no-op UPDATE on the dev database is refused (`db_trigger_live_check.txt`).
2. **Incomplete final month** (undisclosed before): if the as-of date falls inside the last month of data, that month's partial average is left out of the series, reported (`excluded_partial_month`, shown on screen) and documented. The dev data's last purchases are on the 12th, so December is excluded and forecasts start from November (23 usable months). Tests cover mid-month and month-end cut-offs.
3. **Dataset scoping:** a stored run is only returned for the dataset scope it was made for; the run-history list gains an optional dataset filter.
4. **Unknown material or date:** a known material with no purchases up to the as-of date now returns 404 with a clear message (previously 200 with an empty result).
5. **Exponential smoothing** weight now searched on a finer grid (0.05–0.95 in steps of 0.05).

After these fixes: `test_forecasting_engine.py` **22 passed** (18 + 4 new), the Ticket 4 migration round-trip test passes through the new migration (7 passed), `ruff`, `tsc`, `alembic check` and the frontend build are clean, and the screenshots and stored-run evidence were retaken on the new behaviour. The **full suite was not re-run** after these fixes (earlier full run: 238 passed + the one migration-test failure fixed above); the changes are confined to the forecasting module, one new migration, `triggers.py` (used only by the seed script) and tests.

### Not done / open

- **Full regression not re-run after the migration-test fix** (see above); the failing file passes alone.
- **No empty-state screenshot for the Forecasting page** (the Material Cost one exists from Ticket 6). The page's no-data branch and the API's empty state are tested but not photographed.
- **Dev database** still holds demo data from Tickets 5–7, including stored forecast runs for several materials; the scratch database `tris_empty_ui` also remains. Cleanup was blocked earlier.
- Selection rests on 4 held-out months per model: a guide, not proof. Retrospective accuracy across many materials and periods is Ticket 11.
- v1.4 "before" screenshots (manual) and a seeded `process_owner` user remain open from earlier tickets.
