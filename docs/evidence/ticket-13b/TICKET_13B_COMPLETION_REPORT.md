# Ticket 13b — close the work-plan gaps: completion report

Scope: the gaps found by checking `TRIS.docx` against the code (see `TRIS_DOCX_COVERAGE.md`), plus one-click demo sign-in for
testers (owner request). Built on `v2.0-manufacturing-extension` after Ticket 13 (`ecb6a56`). Nothing committed.

## What was built

| Item | Result |
|:---|:---|
| Dashboard manufacturing summary (work plan 5) | Four cards, risk-trend chart, top-exposure table with links to the material and its open case. New read endpoints `/manufacturing/dashboard/summary` and `/material-results`; everything is read from stored results, euro and dollar never added, empty parts say why. |
| Material Cost table (6.1) | 30- and 90-day forecast, 90-day exposure, risk-level filter, CSV export of exactly the rows shown. |
| Material detail (6.2) | "Forecast and exposure" section with model, version, forecast date, dataset version. Open or link a case already existed. |
| Top bar (4.3) | "Evaluation · Synthetic data" label; dataset and data date shown in the Material Cost summary. |
| Logout audit (4.2) | `LOGOUT` recorded with the user. |
| Failed-login throttle (4.1) | 5 failures in 15 minutes pause sign-in for that identifier (429, same answer for unknown accounts, retries during the pause are not counted). |
| Demo sign-in | Login-page panel and "Switch demo role"; `DEMO_LOGIN_ENABLED` (off by default); no passwords in the frontend or responses; audited as `DEMO_LOGIN`; seed adds a read-only reviewer. |
| Card look | One shared `tris-surface` style, the same as the dashboard `Card`, on 32 manufacturing containers. |
| Copy fixes | `formatMoney` shows whole units for large negative amounts. |

## Verification (raw output in this folder)

- Full backend suite (`backend_regression.txt`): **1 failed, 429 passed, 1 skipped**. The one failure was my new test of the
  "switch off" case: it read `DEMO_LOGIN_ENABLED=true` from the local `.env` I had set for browser testing. I made the test set the flag
  itself and re-ran that file: **7 passed**. QA then ran the whole suite alone on the same code: **430 passed, 1 skipped**. After QA a few small
  changes were made (see "After QA") and the affected files were re-run, not the whole suite.
- New tests: 8 dashboard (hand-checked and cross-checked against the exposure endpoint, currencies apart, read-only, roles), 7
  throttle and logout, 7 demo sign-in.
- `ruff` clean (`ruff.txt`), `tsc` exit 0 (`tsc.txt`), frontend build exit 0 (`frontend_build.txt`).
- Browser checks against the case-study data: dashboard summary, table, detail, CSV (figures match the case study: exposure 332.48,
  score 48.9), throttle on a made-up account, demo panel, one-click sign-in as reviewer, switch to read-only (no Calculate button, no
  Administration page). Screenshots in `screenshots/`.
- CSV escaping and the formula guard: `csv_export_check.mts` ("ALL OK").

## Honest limits

- The frontend has no automated test runner; the CSV function has a script check and the screens were checked by hand in the browser.
- The frontend build and `tsc` were re-run after the demo-panel files: both exit 0.
- Dataset name and date range are not in the top bar of every manufacturing page (listed in the handover).
- Demo sign-in needs no password: use it only on a deployment with synthetic data. With it on, anyone can act as administrator; the
  Administration page says so and the demo guide has the reset routine.
- The v1.4 "before" screenshots were supplied by the owner afterwards (see `docs/evidence/ticket-13b/before/README.md`).

## After QA (verdict: ACCEPT WITH FOLLOW-UP)

- Throttle wording corrected everywhere (counted per typed identifier, no reset on success, no per-IP limit) and the lockout trade-off
  written in the handover.
- The "Evaluation · Synthetic data" labels (login page and top bar) now follow `NEXT_PUBLIC_EVALUATION_LABEL` (on by default; set to
  `off` for a deployment with real data).
- The risk-trend chart no longer shows score sets for data dates after the requested date (new test); the CSV formula guard also covers
  leading spaces; a missing type hint was added; the dashboard role test now asserts 403; a misnamed throttle test was renamed.
- Not changed: open cases on the dashboard are not filtered by dataset (the open-case list is global).
- Re-run after these changes: the dashboard, throttle and logout, demo sign-in and auth test files (28 passed), then the dashboard file again with its new test (9 passed); `ruff`, `tsc`
  and the frontend build are clean.
