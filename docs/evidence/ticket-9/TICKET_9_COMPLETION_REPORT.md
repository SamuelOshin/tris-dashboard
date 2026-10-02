## Ticket 9 — Risk Score + Explainability — COMPLETE (awaiting QA and commit)

Branch `v2.0-manufacturing-extension`. Raw evidence is alongside this report. Not committed yet.

### Acceptance criteria
- **0–100 score, documented factors, configurable/versioned weights, stored per run:** PASS. Nine documented factors, score = 100 x weighted sum of 0–1 sub-scores over the factors that have data; weights, scales and bands live in versioned weight sets (new version on every change, admin only, validated); every run stores an immutable row with the exact weights used (`RISK_SCORING_METHOD.md`).
- **Factor-by-factor explanation shown on Material Risk Detail:** PASS. The material detail panel shows each factor's value, scale, sub-score, points and a plain-language reason, and says why an unmeasurable factor was left out (screenshot `02`). The overview table has a Risk score column (screenshot `01`).
- **Zero shared state or coupling with the R-001–R-007 engine:** PASS. Separate service, tables and versioning; tests check imports both ways, no foreign keys, rule configuration rows byte-identical after scoring and weight changes, and scores unchanged after rule configuration changes. `test_acceptance_t01_t10.py` passes unchanged.

### Verification commands (raw output)
```
pytest tests/modules/v1/test_material_risk_scoring.py -v   -> 35 passed   material_risk_scoring_tests.txt
pytest tests/test_acceptance_t01_t10.py -v                 -> 15 passed   acceptance_t01_t10_tests.txt
cd backend && uv run pytest tests/ -q                      -> 313 passed  backend_regression.txt
ruff check / format --check ; tsc --noEmit ; alembic upgrade head + check (head e9a5b3c7d146, no drift) ; pnpm run build (exit 0)
```
Independent check (`independent_recomputation.sql` and output): the stored score for SOL-BACKSHEET (41.8720, Moderate) recomputed in SQL from its stored weights and sub-scores matches; two factor values (price change 4.72%, top supplier share 100%) recomputed from the raw purchase tables match.

### Built
Backend: `risk_types.py`, `risk_factors.py`, `risk_scoring_engine.py` (pure), `risk_scoring_service.py` (`MaterialRiskScoringService`), models `risk_score.py` (`material_risk_weight_sets`, `material_risk_scores`), migration `e9a5b3c7d146` (idempotent, with immutability triggers; also in `triggers.py`), `risk_schemas.py`, `risk_routes.py` (`/manufacturing/risk-scoring`: weights GET/POST, run, scores, materials/{id}, scores/{id}). Frontend: `components/manufacturing/risk-score/*` plus a Risk score column and calculate button on Material Cost Intelligence and a Risk score section in the material detail panel. Docs: `RISK_SCORING_METHOD.md`. Tests: `test_material_risk_scoring.py`; `test_case_category_backward_compat.py` lists the new tables for the downgrade check.

### Decisions not specified
1. Default weights (15/10/15/10/5/15/10/10/10), scales and bands (25/50/75) are a documented starting point, not fitted; Ticket 11 tests whether they rank usefully.
2. A factor without data is left out and the weights rescaled; below 50% data coverage there is no score (never a default).
3. Predicted increase uses the longest stored forecast for the date; without one the factor is not used.
4. Product cost exposure = the material's largest share of any costable product's material cost.
5. Scores run per as-of date and are stored only when a score exists; the newest weight version is active; version 1 is created on first use.
6. Run = admin or reviewer; weights = admin only; view = Manufacturing view roles. There is no weights editing screen yet (API only).
7. The Material Cost "coming soon" note no longer lists Risk score.

### Not done / open
- No UI for editing weights; no empty-state screenshot for the risk score; not wired into case creation (Ticket 10).
- Dev DB now holds stored risk scores (immutable) and still has the duplicate demo materials and `tris_empty_ui`.
- v1.4 "before" screenshots and a seeded `process_owner` user remain open from earlier tickets.

### QA outcome (independent review: ACCEPT WITH FOLLOW-UP) — all findings fixed
1. Booleans, NaN and infinity rejected as weights, scales and bands (schema and engine; tests). 2. Weight set creation serialised with a database lock; tests for concurrent creation and first reads fail without it (checked by disabling the lock). 3. Demand trend and volatility use consecutive calendar months (empty months count as zero demand); doc updated. 4. A material that cannot be scored is reported with the reason (including no purchases at all) and the panel shows it. 5. The level is taken from the stored rounded score. 6. Frontend: stale-response guard, badges cleared on a failed fetch, refusal reason shown, singular toast. After the fixes: 35 ticket tests, 15 acceptance tests, full suite 313 passed; ruff, tsc and build clean.
