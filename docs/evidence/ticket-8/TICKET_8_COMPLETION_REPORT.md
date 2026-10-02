## Ticket 8 — Financial Exposure + Scenarios — COMPLETE (awaiting QA and commit)

Branch `v2.0-manufacturing-extension`. Raw evidence is alongside this report. Not committed yet.

### Acceptance criteria
- **Formula exactly as documented, written into `FINANCIAL_EXPOSURE_METHOD.md`:** PASS. `baseline_spend`, `forecast_spend`, `projected_exposure` as in section 5.3; terms, worked example and limitations documented. Independent SQL recomputation (`independent_sql_check.sql`, output file) gives 870.73 for SOL-AG-PASTE 30-day, equal to the API.
- **Scenarios recalculate exposure without altering the stored baseline:** PASS. Tests plus a byte-for-byte before/after diff on the dev data.
- **Scenario outputs labelled as scenarios, never predictions:** PASS. `kind: "scenario"` and the label "a what-if calculation, not a prediction. Nothing here is saved" in the API and as a banner on screen (screenshot 02).

### Verification commands (raw output)
```
pytest tests/modules/v1/test_financial_exposure.py -v                 -> 20 passed   financial_exposure_tests.txt
pytest tests/modules/v1/test_scenario_does_not_mutate_baseline.py -v  -> 15 passed   scenario_does_not_mutate_baseline_tests.txt
cd backend && uv run pytest tests/ -q                                 -> 278 passed  backend_regression.txt
ruff check / ruff format --check ; tsc --noEmit ; alembic check (head d7f4a2b8c935, no drift, no new migration) ; pnpm run build (exit 0)
```
Before/after proof: `baseline_forecast_runs_BEFORE.jsonl` and `_AFTER.jsonl` (45 rows, 125,441 bytes each), identical SHA-256 (`c40db1a6…`), `cmp` identical, empty `diff` (`before_after_diff.txt`), after 3 scenarios on the live API and 1 rejected request.

### Built
Backend: `exposure_types.py`, `exposure_engine.py` (pure), `exposure_service.py` (read-only), `exposure_schemas.py`, `exposure_routes.py`; endpoints `GET /manufacturing/exposure` and `POST /manufacturing/exposure/scenario`. `forecast_service._history` renamed public `monthly_history`. Frontend: `components/manufacturing/exposure/*` (all under 145 lines) and a tab view on the Forecasting page; the old Coming Soon line removed. Docs: `FINANCIAL_EXPOSURE_METHOD.md`; two sample files and a guide line.

### Decisions not specified
1. Baseline unit cost = latest complete month's weighted price stored in the forecast run; forecast unit cost = average of the stored path over the horizon months.
2. Usage = last 6 complete months of purchases (proxy for consumption); source demand forecasts not used yet.
3. Supplier roll-up by purchase-quantity share; product roll-up by BOM quantity x recent actual production; no production data -> "Unallocated".
4. Scenario controls: price, demand, delivery delay, stock, supplier price, rush-buy premium (default 0, charged only on shortfall the scenario adds). Delay and stock change show cover only unless a premium is entered; missing stock or lead time is "not evaluable".
5. Scenarios open to all Manufacturing view roles (read-only), since nothing is stored.
6. Stale-forecast note when purchase data changed after the run was stored; the stored baseline is still reported.

### Dev data changes
Imported a second product BOM and production volumes via the mapper; re-ran forecasts for all 13 materials (26 new immutable rows) because older runs predated the incomplete-month fix.

### Not done / open
- Dev DB has duplicate demo materials (SAP-style IDs beside SOL-*), so "All materials" double-counts some; cleanup was blocked earlier. `tris_empty_ui` scratch DB remains.
- No empty-state screenshot for the exposure tab; v1.4 "before" screenshots and a seeded `process_owner` user still open from earlier tickets.
- Exposure uses the point forecast; the prediction band is not carried into an exposure range.

### QA outcome (independent review: ACCEPT WITH FOLLOW-UP) — all findings fixed
1. Rush-buy premium now capped at the horizon's scenario usage (test added). 2. Material and supplier pickers keep the unfiltered lists after choosing a material (checked live). 3. Product-share production window bounded to the usage window; doc matches. 4. Empty stored path falls back to the end value (test). 5. Unused `is_neutral` removed. Also: thin theme-coloured scrollbars globally (`globals.css`). After the fixes: 20 + 15 ticket tests pass, full suite 278 passed, ruff and tsc clean.
