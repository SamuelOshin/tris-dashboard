# Ticket 14 — work plan Section 20: the handover package

Status on 2026-10-07. "In the repository" paths are relative to the repository root.

| # | Item required | Status | Where / what is missing |
|:--|:--|:--|:--|
| 1 | Complete source code with preserved Git history | Done | Branch `v2.0-manufacturing-extension`; no commit backdated and no authorship changed (`git log`). Before the first push, eight local commit messages (Tickets 2 to 7 and two housekeeping commits) were cleaned of an AI `Co-Authored-By` trailer that AGENTS.md forbids; this was done once, on commits that had never been pushed, with identical file contents (checked by diffing against the backup branch `backup/pre-trailer-cleanup`) and the same authors and dates. History already on `origin` (up to the Ticket 1 commit) was not touched. Local commits for Tickets 2 to 13b are not yet pushed to `origin` (the remote branch is still at the Ticket 1 commit); pushing is part of the final step. |
| 2 | Baseline tag and final release tag | Baseline done; final pending | `v1.4-baseline` exists on `origin`. `v2.0` is created last, after every other item here and the owner's go-ahead. |
| 3 | Deployment and run instructions | Done | `docs/HANDOVER_AND_CHANGELOG.md` ("How to run and verify", deploy routine, `AUTO_MIGRATE`), `docs/DEMO_GUIDE.md`, `docs/CASE_STUDY_01.md` section 0, `backend/.env.example`, `frontend/.env.example`, `README.md`, `AGENTS.md`. |
| 4 | Admin account and a separate reviewer or read-only demo account, shared securely outside the repository | Done, owner shares passwords | The demo sign-in panel (`DEMO_LOGIN_ENABLED=true`) lets a tester try every role without a password, and the seed creates the five demo users. The README no longer lists passwords (F1 resolved); the owner shares them privately if someone needs them. |
| 5 | Synthetic Environment A and Environment B datasets | Done | `docs/samples/erp_mapping/` (Environment A: seven generic files plus SAP-style, Dynamics-style, short-history and error variants), `docs/samples/environment_b/` (workbook and its generator `backend/app/scripts/environment_b.py`), `docs/SYNTHETIC_TEST_DATA.md`. |
| 6 | Saved mapping profiles | Done | `docs/samples/mapping_profiles/` (19 definitions, validated against the save-profile schema); how to load them: `docs/ERP_MAPPING_GUIDE.md`. |
| 7 | All documentation listed in Section 14 | Done | `BASELINE_README.md`, `ARCHITECTURE_MATERIAL_COST_INTELLIGENCE.md`, `UI_NAVIGATION_SPEC.md`, `DATA_DICTIONARY.md`, `ERP_MAPPING_GUIDE.md`, `MODEL_METHODOLOGY.md`, `RISK_SCORING_METHOD.md`, `FINANCIAL_EXPOSURE_METHOD.md`, `VALIDATION_PROTOCOL.md`, `VALIDATION_RESULTS.md`, `TRANSFERABILITY_TEST.md`, `CASE_STUDY_01.md`, `HANDOVER_AND_CHANGELOG.md`, `README.md` (index) and `DEMO_GUIDE.md`, all in `docs/`. |
| 8 | Validation results and reproducible case study | Done | `docs/VALIDATION_RESULTS.md`, `docs/CASE_STUDY_01.md`, `docs/case_study/CASE_STUDY_01_expected.json`, `backend/app/scripts/case_study.py`. |
| 9 | Before and after screenshots | Done (limit) | After: 18 of 18 in `docs/evidence/ticket-13/screenshots/`, plus `ticket-13b` and `ticket-14` sets. Before: eight v1.4 screens in `docs/evidence/ticket-13b/before/`, captured by the owner on 2026-10-07 from the `v1.4-baseline` code (so the dates on screen are the capture date); fraud detection, compliance and the correlation and reports pages are not in the set (`before/README.md`, `docs/BASELINE_README.md` section 11). |
| 10 | Short screen-recorded demo, if feasible | **Open** (optional) | Not made. The route to follow is `docs/DEMO_GUIDE.md`. |
| 11 | Known issues, limitations and future-work list | Done | `docs/HANDOVER_AND_CHANGELOG.md` ("Known issues and gaps", "Sign-in throttle", "Future work"). |
| 12 | Developer handover note separating completed features, demonstrations and planned integrations | Done | `docs/HANDOVER_AND_CHANGELOG.md`, "Developer handover note: what is built, what is a demonstration, what is planned". |

Regression and acceptance evidence for the package: `docs/evidence/ticket-14/` (`regression_diff.txt`, `ACCEPTANCE_CHECKLIST.md`,
`SECURITY_AND_CLAIMS_SCAN.md`, `backend_regression.txt`).
