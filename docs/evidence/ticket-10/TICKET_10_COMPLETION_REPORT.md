## Ticket 10 — TRIS Case Integration — COMPLETE (awaiting QA and commit)

Branch `v2.0-manufacturing-extension`. Raw evidence is alongside this report. Not committed yet.

### Acceptance criteria
- **Create/link a `RiskCase` with `case_category = material_cost_risk` from a high-risk material:** PASS. A stored High or Critical risk score opens a case (or links to the open one); lower scores are refused. Live: `live_walk/02_case_opened.json`; UI: screenshots `05`, `06`. Details in `docs/MATERIAL_CASE_INTEGRATION.md`.
- **Full existing lifecycle works identically, zero new state-machine logic:** PASS. The case went New → Assigned → Under Investigation → Corrective Action → Pending Verification → Closed through the ordinary `/cases/.../transition` endpoint with the existing matrix, preconditions and eight closure fields. No transition, closure or separation-of-duties code looks at the category (a test reads the case service source to keep it so).
- **Separation of duties applies identically:** PASS. A reviewer-investigator cannot close (403); an administrator who investigated cannot close (`SEPARATION_OF_DUTIES_VIOLATION`); naming the investigator as `verified_by` is refused; an independent verifier closes it. `test_separation_of_duties.py` passes unchanged (4 passed).

### Verification commands (raw output)
```
pytest tests/modules/v1/test_material_case_integration.py -v   -> 17 passed   material_case_integration_tests.txt
pytest tests/modules/v1/test_separation_of_duties.py -v        ->  4 passed   separation_of_duties_tests.txt
cd backend && uv run pytest tests/ -q                          -> 330 passed  backend_regression.txt
ruff check / format --check ; tsc --noEmit ; alembic check (no new migration, no drift) ; pnpm run build (exit 0)
```

### Actual case, end to end, on the development data (`live_walk/`)
Material SOL-CELL-M10 scored 49.9 (High, weights version 2). Case MCR-264D07030A was opened from that stored score by the reviewer user, then walked by real, distinct users (reviewer investigates, verifier closes):
`02_case_opened` (201) → `03_case_context_historical_replay` (score reproduced) → `03b_skip_to_closed_refused` (409) → `04_assigned` → `05_under_investigation` → `06_corrective_action` → `07_pending_verification` → `08_close_by_investigator_refused` (403) → `08b_close_missing_fields_refused` (422) → `09_closed_by_independent_verifier` (200) → `10_case_final_with_history` (history: New, Assigned, Under Investigation, Corrective Action, Pending Verification, Closed) → `11_cases_for_material`. Screenshots of the closed case: `01` Overview, `02` Historical Replay, `03` Recurrence, `04` History. A second case (MCR-2474647612, SOL-ALU-FRAME) was opened from the UI (`05`, `06`).

### Built
Backend: `material_case_service.py` (open, link, context, per-material list), `material_case_routes.py`, `material_case_schemas.py`; case module: `CaseResponse` gains `case_category`, `material_id`, `forecast_horizon`, `projected_exposure_amount`; the case list accepts `case_category` and `material_id`; recurrence lookup matches on supplier or material and no longer matches every case when the supplier is missing. Frontend: `components/cases/material/*` (overview, historical replay, recurrence, guards, hook), category-aware choice of tabs on the case page and header line, and an *Open a case / Link this score* action in the material detail panel. Docs: `MATERIAL_CASE_INTEGRATION.md`.

### Decisions not specified
1. "High-risk" = a stored score whose level is High or Critical under the weight version it was made with (so the band is configurable). Opening is by an admin or reviewer, never automatic.
2. One open case per material: a newer score is linked to it instead of opening another; after closure a new case can be opened.
3. Case priority is High for both levels (the priority scale has no higher value). The supplier is the largest spend in the year to the score date.
4. Historical Replay for a material case replays the saved score (reproduction check, forecast, exposure, factors, change since) instead of a transaction; there is no remediation what-if for material cases.
5. Recurrence matches earlier cases on the same supplier or material, including financial-exception cases (category shown).
6. To show cases on the sample data I stored weight version 2 (High band lowered from 50 to 40; note recorded). The default version 1 is unchanged and kept.

### Not done / open
- Dev DB now holds an extra weight version, scores, two material cases (one closed) and their history, all immutable or undeletable; the duplicate demo materials and `tris_empty_ui` remain.
- No material-specific what-if replay; no automatic case opening; no case-list category filter control on the Risk Cases page (the API supports it).
- v1.4 "before" screenshots remain open from earlier tickets.

### QA outcome (independent review: ACCEPT WITH FOLLOW-UP) — findings fixed
1. Opening a case takes a per-material database lock, so two simultaneous requests open only one case (test fails without the lock). 2. Recurrence is limited to the same kind of case, so financial and material cases never list each other (test fails without the filter). 3. A case can only be opened from, or linked to, the material's newest saved score. 4. The source guard now scans every function of the case services (AST), except the two read paths extended on purpose. 5. Priority stays High for Critical (the scale has no higher value; documented). 6. A failed case lookup in the UI shows a note instead of offering "Open a case" (read-only roles never see the buttons). 7. `case_number` uses the full unique suffix. After the fixes: 17 ticket tests, 4 separation-of-duties tests, full suite 330 passed; ruff, tsc and build clean.
