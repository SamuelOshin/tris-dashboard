# Ticket 14 — Full QA + Handover: completion report

Branch `v2.0-manufacturing-extension`, checked on 2026-10-07 at `7ab2e1d` plus the Ticket 14 changes listed below.
**The `v2.0` tag has NOT been created and nothing has been pushed or merged.** Those steps are last and need the owner's go-ahead.

## Acceptance criteria

| Criterion | Result | Evidence |
|:--|:--|:--|
| Every item in Section 16 checked individually with evidence | PASS (18 items; one with a stated limit) | `ACCEPTANCE_CHECKLIST.md` |
| Every item in Section 17 checked individually with evidence | PASS (16 items; limits stated; one item open on the owner's screenshots) | `ACCEPTANCE_CHECKLIST.md` |
| Full regression diffed against the Ticket 1 baseline, zero regressions | PASS | `regression_diff.txt`: 127 of 127 baseline tests still pass, none missing, none skipped |
| Section 20 handover package assembled | PASS with open owner items | `HANDOVER_PACKAGE.md` |
| `v2.0` tag only after everything else | Not yet created | Last step, needs the owner |

## Verification commands (raw output in this folder)

- `uv run pytest tests/ -v -p no:cacheprovider` (`backend_regression.txt`): **431 passed, 1 skipped, 0 failed** in 66 minutes. The one skip is
  `test_transferability.py::test_write_side_by_side_validation_evidence`, which writes evidence only when `TRANSFER_EVIDENCE_DIR` is set.
- `python docs/evidence/ticket-14/regression_diff.py` (`regression_diff.txt`): baseline 127 recorded (127 passed); current 432 recorded
  (431 passed, 1 skipped); **baseline tests that no longer pass: 0**; tests added since the baseline: 305; **ZERO REGRESSIONS**.
- `pnpm run build` (`frontend_build.txt`): exit 0. `npx tsc --noEmit` (`tsc.txt`): exit 0. `ruff check` and `ruff format --check` (`ruff.txt`): clean.
- Browser sweep (`screenshots/t14_browser_results.json`): five roles, 13 pages, two laptop widths, sign-in, sign-out and error states.
- Scans (`SECURITY_AND_CLAIMS_SCAN.md`): secrets, credentials, console and request URLs, claims in the UI copy.

## What was found and what was done

| # | Finding | Action |
|:--|:--|:--|
| F1 | The root README listed the demo accounts with their passwords. | Owner decision: removed. The README now lists roles only and points to the demo sign-in panel. |
| F2 | The v1.x Compliance page showed hard-coded scores, framework statuses and an invented audit trail with no sample label, linked from the user menu. | Owner decision: removed from navigation (menu item gone, `/compliance` redirects to the dashboard, one ingestion tile relinked). Verified in the browser. |
| F3 | Sign-in inputs lack `autocomplete` attributes (a browser console hint). | Not changed; cosmetic, listed. |
| F4 | A signed session token is still accepted after sign-out until it expires (up to 60 minutes). | Not changed; documented as future work (server-side revocation). |
| F5 | One transient redirect to the sign-in page for the process owner on `/` in the first sweep. | Not reproduced in four re-checks; recorded. |

Other changes made in this ticket (documents and evidence only, plus the two small front-end changes for F2): v2.0 addendum in
`docs/TEST_EXECUTION_RESULTS.md`; handover note separating built, demonstration and planned items; 19 saved mapping profile definitions in
`docs/samples/mapping_profiles/` with a loading note in `docs/ERP_MAPPING_GUIDE.md`; docs updated for the Compliance change.

## Anything interpreted or decided that was not explicitly specified

- Regression "against the Ticket 1 baseline" was done test by test on test identifiers, because the baseline file lists 127 test ids.
- The Section 16 checks that need a browser were run with a scripted Chrome against the running application using the demo sign-in for each role.
- HTTPS was not verified: no deployed address was supplied. Cookies are marked secure outside development.
- The v1.4 "before" screenshots were supplied by the owner after this report was first written (eight screens, captured 2026-10-07 from the `v1.4-baseline` code; see `docs/evidence/ticket-13b/before/README.md`). The optional screen recording is not made.

## Independent QA (verdict: ACCEPT WITH FOLLOW-UP, no blocker)

QA re-ran the full suite alone: **431 passed, 1 skipped**, and the regression diff on its own output: **zero regressions**, parser counts equal to
pytest's. It confirmed every cited test exists and passed, F1 and F2 are resolved, the 19 profile definitions validate, there is no `v2.0` tag locally or
on `origin`, and `main` can be fast-forwarded to this branch with no conflicts. Its follow-ups, and what was done:
- **M1, commit trailers (owner decision pending):** 8 local, unpushed commits (Tickets 2 to 7 and two housekeeping commits) carry a
  `Co-Authored-By` AI trailer, which AGENTS.md forbids. Rewording them before the first push changes their hashes; see "Not yet done".
- **M2, evidence:** the browser sweep's access detector missed the "Access restricted" wording; replaced by `screenshots/route_sweep_after_f2.json`, which checks the real text.
- **L1:** the scan document no longer spells out the passwords, and says they remain in git history.
- **L2:** validation counts corrected in the checklist (260 cases, 192 judged).
- **L3:** the sweep was repeated after the Compliance change over all 19 routes.
- **L4:** not a defect: the read-only reviewer's ERP mapping page says "Importing data is restricted" and explains why.

## Not yet done

1. Done (M1): the owner left the choice to the engineer, who cleaned the 8 trailers (unpushed commits only): 0 trailers remain in `578d6f8..HEAD`, `git diff backup/pre-trailer-cleanup HEAD` is empty, 16 commits before and after, authors and dates unchanged. The backup branch is local and can be deleted after the push.
2. With the owner's go-ahead: push the branch, merge it into `main`, tag the merge commit `v2.0`, push the tag.
