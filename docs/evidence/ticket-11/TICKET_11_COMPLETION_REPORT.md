## Ticket 11 — Validation — COMPLETE (QA findings fixed; committed)

Branch `v2.0-manufacturing-extension`. Raw evidence is alongside this report. Not committed yet.

### Acceptance criteria
- **Cutoff selection, use-only-prior-data, freeze-before-reveal, metrics, stored per run with full metadata:** PASS. Cutoffs come from the data span and settings only; every record is loaded with the date limit in the database query and checked again; every forecast and signal is saved and committed before any actual is read (a test spies on the moment actuals are first read); MAE, RMSE, MAPE, directional accuracy, false positives/negatives, precision/recall, advance-warning lead time and a comparison with the naive forecast are stored with the run's settings and method, forecast-engine and risk-weight versions. See `docs/VALIDATION_PROTOCOL.md`.
- **The mandatory leakage test exists and exercises the failure path:** PASS. `test_validation_rejects_post_cutoff_data_leakage` plants a record dated after the cutoff and requires refusal at the data-layer guard, at the forecast engine, and through the whole harness with the query layer made to hand back a later record: the run stops with a data-leakage error, nothing is forecast from it, and the failed run's header is kept and listed as "did not finish". A second test loads an extreme price into the final month between two runs and requires all 260 frozen forecasts and signals to be identical while only the one affected outcome changes. Raw output: `leakage_test_raw_output.txt`.
- **Failed/unsuccessful runs are preserved and documented:** PASS. All four tables (runs, cases, outcomes, summaries) refuse UPDATE and DELETE at the database (tested); a run that stops early stays listed; two flawed first attempts at the metrics are kept and explained in `docs/VALIDATION_RESULTS.md`.

### Verification commands (raw output)
```
pytest tests/modules/v1/test_validation_protocol.py -v   -> 20 passed (validation_protocol_tests.txt)
  (leakage test alone)                                    -> leakage_test_raw_output.txt
cd backend && uv run pytest tests/ -q                    -> 351 passed (backend_regression.txt)
pytest tests -m pure -q  (new fast lane, no database)    -> 71 passed in 2.5s   pure_lane_run.txt
ruff check / format --check ; tsc --noEmit ; alembic check (head f1b6c4d8e257, no drift) ; pnpm run build (exit 0)
```

### One full real validation run, stored results (nothing cherry-picked) — VAL-DDE132A295, method 1.2, development data
260 cases (13 materials × 10 cutoffs × 2 outlooks): 192 judged, 44 withheld (history too short to forecast), 24 not evaluable (holdout month not in the data yet).

| | 30-day | 90-day |
|:---|---:|---:|
| Typical error (MAPE) | 3.1% | 5.5% |
| MAE: forecast vs "stays the same" | 0.113 vs 0.096 | 0.238 vs 0.178 |
| Closer / equal / further than "stays the same" | 18% / 54% / 28% | 26% / 42% / 32% |
| Direction right (where both moved) | 44% of 43 | 43% of 35 |
| Risk events | 16 of 120 | 24 of 72 |
| Warning at score ≥ 40: true+ / **false alarms** / **missed** / true− | 5 / **17** / **11** / 87 | 8 / **11** / **16** / 37 |
| Precision / recall | 23% / 31% | 42% / 33% |
| Advance warning of events caught | 1.4 months (5 events) | 3.9 months (8 events) |

Plainly: **the forecasts did not beat "the price stays the same"; the warning at the default level caught about a third of price rises with mostly wrong alerts; a more sensitive warning (threshold 25) catches 88–92% of events but raises a warning in 86% (30-day) and 89% (90-day) of all cases.** Full list of the 28 false alarms and 27 misses, per-material results, the sensitivity run (VAL-79274BB00A) and the less-overlapping run (VAL-6AB7B1E298): `live_runs/` and `docs/VALIDATION_RESULTS.md`.

### Two mistakes in my own method, found on real data and fixed (runs kept)
1. **Method 1.0 counted a "stays the same" forecast as a wrong direction whenever the price moved.** First result: directional accuracy 18%, below chance and not believable for 3% errors. 95 of 192 judged cases came from the naive model. Fixed in 1.1 (no directional call is counted apart).
2. **Method 1.1 counted rounding noise as wins and losses against the naive baseline** (forecasts are stored to 6 decimals, so the naive forecast differs from the last price by ~3e-7): 23 of 65 naive-model cases at 30 days. Fixed in 1.2 (errors within 1e-5 are equal), with a test.
Both changed only how forecasts were judged: the frozen forecasts and signals of the 1.0 and 1.2 runs are identical (260 of 260 cases checked in SQL). Runs 1.0 and 1.1 are kept and listed with their method version.

### Built
Backend: `validation_types.py`, `validation_metrics.py` (pure), `validation_service.py`, `validation_schemas.py`, `validation_routes.py` (`/manufacturing/validation`: POST runs, GET runs, GET runs/{id}, GET runs/{id}/cases), models `validation.py` (`validation_runs`, `validation_cases`, `validation_outcomes`, `validation_summaries`), migration `f1b6c4d8e257` (idempotent, immutability triggers; also in `triggers.py`), `ValidationRunUser`. Frontend: `components/manufacturing/validation/*` and the Validation page (run form, run list including runs that did not finish, results per outlook, warning matrix, advance warning, per-material table, false alarms and misses, gaps, limitations). Docs: `VALIDATION_PROTOCOL.md`, `VALIDATION_RESULTS.md`. Tests: `test_validation_protocol.py` (hand-calculated metrics, protocol order, immutability, roles); fast `pure` test lane (earlier commit).

### Decisions not specified
1. Risk event = actual monthly price at the target month at least 5% above the last observed price; warning = risk score at or above the High band of the active weights (stored with the run); both configurable and recorded.
2. Cutoffs are all month-ends from the first with enough history (13 months) to the last whose holdout month is complete; step configurable (default 1 month).
3. Actual = quantity-weighted monthly average price in the forecast's currency; a holdout month that is incomplete or has no purchases is "not evaluable" with the reason.
4. A run is complete when its summary row exists; a run without one is shown as "did not finish" (rows are insert-only, so no status update is needed).
5. Roles: run = admin or reviewer (`VALIDATION_RUN_ROLES`); read = Manufacturing view roles including read-only reviewers.

### Not done / open
- Results rest on about seven independent series (six of the 13 materials are duplicates), overlapping cutoffs and 5–8 caught events per outlook; they are indicative only (stated in the run and in the docs).
- Two method flaws were found only because the numbers looked implausible; others may exist.
- The dev DB now holds 10 validation runs (immutable); duplicate demo materials and `tris_empty_ui` remain; v1.4 "before" screenshots remain open.
- No export of validation results; no comparison across runs on screen (runs are listed and opened one at a time).
