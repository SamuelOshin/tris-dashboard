# Ticket 13 — Documentation + Case Study: completion report

Scope: the 14 documents, Case Study 01, the 18-screen checklist, and three pieces added during the ticket at the owner's request:
(1) migrations that build an empty database (baseline `0f3c9a7b5d21`), (2) removal of `create_all` at start-up with a
schema-version check and an opt-in `AUTO_MIGRATE`, (3) the Administration page and audit log (work plan Section 10, screens 17 and 18;
migration `b3d8f2a6c941`). Edits to the eight earlier migrations were signed off by the owner, confirmed again in writing in chat on 2026-10-06.

## Acceptance criteria

| # | Criterion | Result |
|:---|:---|:---|
| 1 | All 14 documents exist and match the code | PASS (data dictionary tables generated from the models; figures in CASE_STUDY_01 checked by a test) |
| 2 | Case Study 01 reproduces from an empty database | PASS: `case_study --check` on fresh databases x3, one run by an independent AI reader, and one by the owner on 2026-10-07 on the revised section 0; tests `test_case_study_reproducible` (2) and `test_case_study_document` (3) |
| 3 | Screenshot checklist complete | PASS: 18 of 18 (17 and 18 captured after the Administration page was built) |
| 4 | Existing suite passes | PASS, see below |

## Verification (raw output in this folder)

- Full backend suite (`backend_regression.txt`), run after the last code edits: **408 passed, 1 skipped, 0 failed** in 20 min.
  An earlier run had 3 failures, all test stand-ins for a signed-in user missing `username`/`role`; the tests were fixed (product
  code unchanged) and the final run above is green. It includes the empty-database migration, schema-check, `AUTO_MIGRATE`
  (incl. failure and concurrent start), Administration and case-study reproduction tests, each of which builds its own scratch database.
- Since the QA round: Administration no longer shows a library name in model descriptions, "last changed by" shows the person's
  name, and the stale "78 tests" line in the handover now reads 409.
- Fast lane `pytest -m pure`: 106 passed (`pure_lane_run.txt`). `ruff` clean (`ruff.txt`). `tsc` exit 0 (`tsc.txt`).
  Frontend build exit 0 (`frontend_build.txt`).

## What was added beyond the first hand-off

- Migrations: baseline plus guards, empty database -> head, `alembic check` clean; existing databases untouched.
- Start-up refuses a database that is not at the newest revision; `AUTO_MIGRATE=true` (default off) migrates first under a lock; a
  failed migration stops start-up and rolls back the failed step.
- Administration page (admin only): model on/off, risk-weight versions, dataset labels, saved mappings, audit log. Audit entries are
  written in the same transaction as the action; the log is insert-only; actor comes from the signed-in user.
- Round-2 QA fixes: seed crash on a migrated database, case-study check that passed for the wrong reason, lifespan swallowing errors,
  wrong counts, stale docstrings and doc inaccuracies.

## Honest limits

- The independent read of Case Study 01 was by an AI, not a person (`INDEPENDENT_CHECK.md`); the revised set-up section and Path A were also followed by the owner on 2026-10-07 (`INDEPENDENT_CHECK.md`). Path B has not been followed by anyone who has not seen the project.
- The Compliance page still shows static sample data (documented, not changed).
- v1.4 "before" screenshots were never captured.
- Forecasting, Exposure and Validation pages have no dataset picker (documented).
- `AUTO_MIGRATE` is for the demo environment; keep it off where a bad migration would cost real data.

Nothing is committed.
