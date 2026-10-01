## Ticket 6 — Material-Cost Analytics (Detection) — COMPLETE (awaiting QA and commit)

Branch: `v2.0-manufacturing-extension`. Raw evidence files are alongside this report. Not committed yet.

### Acceptance criteria checked

- **Every metric on the overview is computed from data in the database, not hard-coded:** PASS
  - Figures are computed per request from stored rows (`analytics_loader.py` → `detection_engine.py`); nothing is cached or typed in.
  - `test_overview_figures_are_computed_from_the_rows_and_change_with_them` asserts independently calculated values (weighted price 11.5 → 13.0, spend 7,200) and then adds a purchase and asserts the figures move.
  - `grep -rn "hardcoded\|TODO.*mock" frontend/app/manufacturing frontend/components/manufacturing` → no matches (`hardcoded_grep.txt`); a test guards it.
  - Independent plain-SQL recomputation of the screen's aluminium figures matches exactly (`independent_sql_check.sql`, `independent_sql_output.txt`): see below.
- **Genuine empty state when no manufacturing data has been ingested:** PASS. API returns `has_data=false` with no figures; the page shows "No manufacturing data yet" with an Import data button (screenshot `01`). Captured against a separate empty database (see Not done / open).
- **§5.1 detection coverage:** all nine named behaviours are implemented as ten signals — rapid/abnormal price movement (2), persistent standard-vs-actual deviation, PPV trend, BOM cost escalation, supplier concentration, inventory exposure with cost risk, procurement anomalies, high usage/high spend, lead-time deterioration. Thresholds and formulas: `docs/MATERIAL_DETECTION_METHOD.md`.

### The calculation behind the screen (aluminium frame profile, data up to 8 Dec 2025)

| Screen shows | Independent SQL result |
|:---|:---|
| Standard-cost signal: Oct +24.2%, Nov +18.9%, Dec +18.3% | actual 4.4215 / 4.2354 / 4.2113 vs standard 3.5609 → 24.2 / 18.9 / 18.3 |
| Dependence on one supplier: SUP-006 83% | SUP-006 spend 77,081.35 = 83.2% |
| Lead time SUP-006 18.4 → 33.9 days, on-time 94% → 78% | avg 18.4 → 33.9 days; on-time 0.945 → 0.780 |

Monthly price = Σ(quantity × unit price) ÷ Σ(quantity) per calendar month; standard cost = version in force at month end. The query is in `independent_sql_check.sql`.

### Verification commands run (raw output)

```
pytest tests/modules/v1/test_material_detection.py -v   -> 20 passed in 36.27s      material_detection_tests.txt
grep -rn "hardcoded\|TODO.*mock" app/manufacturing components/manufacturing -> no matches (exit 1)   hardcoded_grep.txt
pnpm run build                                           -> exit 0, includes /manufacturing/material-cost   frontend_build.txt
ruff check . / ruff format --check .                     -> clean                    ruff.txt
```

### Regression check

```
cd backend && uv run pytest tests/ -q
214 passed, 5 warnings in 3424.91s (0:57:04)      backend_regression.txt
```
214 = 188 (after Ticket 5) + 6 (Ticket 5 QA-fix tests, previously counted in the file but not the suite total) + 20 new. Zero failures. The run was slow because a browser, two dev servers and a build shared the machine.

### Live evidence (screenshots, synthetic data)

`01` empty state · `02` overview with computed figures · `03` material detail: all ten checks with explanations, monthly price against standard cost, supplier split, products using the material.

### Files changed

New: `manufacturing/routes/analytics_routes.py`; `manufacturing/service/{analytics_types, price_series, detectors_price, detectors_exposure, detection_engine, analytics_loader, analytics_service}.py`; `tests/modules/v1/test_material_detection.py`; frontend `components/manufacturing/material-cost/*` (13 files, all under 135 lines); `docs/MATERIAL_DETECTION_METHOD.md`; four synthetic sample files (`generic_material_costs`, `generic_purchases_secondary`, `generic_inventory`, `generic_supplier_ops`); `docs/evidence/ticket-6/*`.
Modified: `core/permissions.py` (+ `MANUFACTURING_VIEW_ROLES`), `core/dependencies.py` (+ `ManufacturingViewUser`), `v1/router.py` (+2 lines), `frontend/app/manufacturing/material-cost/page.tsx`.
Not touched: any database table or migration (Ticket 6 adds none), v1.4 modules, the case workflow, the mapper.

### Decisions I made that were not specified

1. **Detection only.** Forecast cost, % forecast change, estimated exposure, risk score and High/Medium/Low are Tickets 7–9. The page shows "Coming Soon" badges for them and has no risk-level filter. The work plan's overview lists them, so the overview is intentionally incomplete until then.
2. **Read access for read-only reviewers.** Overview and detail are open to admin, reviewer and read-only reviewer (`MANUFACTURING_VIEW_ROLES`, mirrors the UI); verifier and process owner get 403. The Ticket 2 scaffolding had no "view" list, so I added one.
3. **As-of date defaults to the latest purchase date in the data**, not today, so synthetic 2024–2025 data shows figures. It filters on business dates only, not on when a row was imported; "known by that date" semantics are Ticket 11's.
4. **On-demand calculation, nothing stored.** No analysis-run records yet; those arrive with model runs (Tickets 7+). The page shows the calculation time.
5. **Thresholds are my starting values** (10% jump, z ≥ 2, 5% over standard for 3 months, 70% concentration, 30 days cover, 20% lead time…). Documented and returned by the API; they are not tuned to any company.
6. **Stock cover uses recent purchase rate as the usage proxy** unless the source reports days of supply.
7. **Mixed currencies are never combined**: the most common currency is analysed and excluded lines are counted on screen.
8. **Lead time is judged per supplier** (found during verification: pooling suppliers diluted a bad one).
9. **No CSV export of the table**, per the plan's "only if it can be implemented reliably".
10. **Drill-down is a side panel**, not a separate Material Risk Detail page; that page, with score breakdown, forecast and the case button, comes with Tickets 9–10.
11. **Sample data added** (cost, second supplier, stock, supplier operations) and imported through the Ticket 5 mapper so every detector has something to work on. The earlier SAP-style set stays purchases-only, so it correctly shows "No standard / No stock data".

### Not done / open

- **Empty-state screenshot used a scratch database** `tris_empty_ui` (schema + users copied, no manufacturing rows), because I cannot remove the demo data from your dev database. It is still there and can be dropped: `docker exec tris_postgres psql -U tris_user -d postgres -c "drop database tris_empty_ui"`.
- **Dev database still holds demo data** from Tickets 5 and 6 (materials, purchases, costs, stock, supplier metrics, BOM, one saved profile, import jobs); cleanup was blocked earlier.
- **A scripting accident to flag:** while editing, a script of mine emptied `detectors_exposure.py` (a write failed on the `→` character). I restored it in full and re-ran the whole suite afterwards, so the results above are on the final code.
- The seeded dataset's "highest spend" and concentration signals fire heavily because the demo suppliers are single-source by construction; that is the data, not a threshold fault.
- v1.4 "before" screenshots (manual) and a seeded `process_owner` user remain open from earlier tickets.

### QA review outcome

Independent QA verdict: **ACCEPT WITH FOLLOW-UP NOTED** (its own run: 20 detection tests pass; live probes of filters, as-of date and roles; no blockers). Fixed after review, each with a test:

1. The summary no longer adds spend across currencies (one total only when a single currency; otherwise a per-currency list), and high-spend ranking and share are within a currency.
2. BOM cost escalation skips products whose components are priced in different currencies (reported, not mixed).
3. Added tests proving costs, stock, variance and supplier-operations rows dated after the as-of date are ignored (previously only purchases were tested).
4. Supplier operations no longer attach through the undated material-supplier link table (it could let a later link change an earlier analysis); only suppliers with dated purchases by the as-of date count.
5. An unknown `signal` filter now returns 422.
6. A date before the first purchase shows a notice with the earliest purchase date instead of an empty table with no explanation.

After these fixes: `test_material_detection.py` **27 passed** (20 + 7 new); `ruff check`/`format` and `tsc` clean; the three behaviours re-checked live. The full 214-test regression was **not re-run** after these fixes, by agreement: the changes are confined to the analytics module and its tests (`permissions.py`/`dependencies.py` were not touched again), and the earlier full run on the pre-fix code was green.

Left as noted follow-ups: the operations loader loops materials × rows and the overview recomputes everything per request (fine at this scale; needs caching or pagination for large datasets); month-start granularity for the "90 days ago" price (documented, never later than the as-of date).
