# Role-aware screens: completion report

Branch `feat/role-aware-ui` (from `main` at `v2.0.1`). Front end plus one test; no backend or database change. Nothing committed.
Background: `FINDINGS.md` (the complaint that every role sees the same as the administrator, and what was confirmed).

## What was built
- `frontend/lib/permissions.ts`: who may import, work a case, close a case (mirrored from the server) and a plain-language summary of each role.
- Dashboard: a **What you can do as <role>** card (`components/overview/role-guide.tsx`); the **Upload Data** shortcut is hidden for roles that cannot import.
- Case page (`components/cases/`): view-only note and disabled fields/buttons for the read-only reviewer on the Investigation, Corrective Action
  and Closure tabs and in the header; **Closing needs a verifier** note, disabled closing fields and a **Needs a verifier** button for reviewer and
  process owner; verifier and administrator unchanged.
- Demo sign-in panel: each role also says what it cannot do.
- `backend/tests/modules/v1/test_frontend_permissions_mirror.py` (5 tests): the front-end lists equal the server's. Mutation check: adding `reviewer`
  to the close list made `test_who_may_close_a_case_matches_the_server` fail; reverted.

## Checked in the browser (`after_role_aware.json`, screenshots here)
- Each of the five roles: dashboard card text and quick actions (Upload Data only for administrator and reviewer); case tabs: read-only reviewer sees
  "View only" and disabled actions; reviewer and process owner see "Closing needs a verifier" with disabled closing fields (0 of 3 editable);
  administrator and verifier keep 3 of 3 editable closing fields.
- `tsc` exit 0, `pnpm run build` exit 0, `ruff` clean, fast lane 113 passed (112 plus the mirror test's read-only check).

## Limits
- The server was already refusing these actions; this change only shows the limits. Reads stay open to every role (v1.4 design).
- The Investigate shortcut still opens a fixed demo case (`TEST-CASE-001`) as in v1.4.
- No front-end test runner exists; the screens were checked by a scripted browser. The full database suite was not re-run: the only backend file
  added is a pure test.

## QA round 1 (REJECT) and what was done
Independent QA found controls still live for the read-only reviewer. Fixed: **Assign to Me** (Overview tab and material case overview) now shows
"Unassigned" unless the role can work cases; the Historical Replay tab disables **Run Replay Simulation**
for read-only roles (viewing a reconstruction stays open: the server allows that read) with a view-only note (new `canRunHistory`, mirror-tested against the server's read-only list); role card wording corrected
(process owner: "up to verification"; read-only cannot run replay simulations); the "Verification Gate Active ... seal the case" banner shows only
to roles that can close; the Ingestion page now uses `canImportData`. After the fix: `tsc` 0, `pnpm run build` 0, `ruff` clean, mirror test 5 passed.

## Left as is, on purpose
- "Data Ingestion" stays in navigation for every role: the page is also a schema reference and already hides uploading for roles that cannot import.
  The empty-state shortcuts and the "Import data" links to ERP mapping are not role-gated.
- Closure and corrective-action tab files were already over the 250-300 line guideline; not split here.
- The full database suite was not re-run (Docker was not running for QA); no backend code changed.

## QA round 2 (REJECT, one item)
The header **Accept Case** button was missed; now disabled for roles that cannot work cases. The reconstruction button is no longer disabled (the server allows the read); only the replay is. Read-only card wording simplified.

## QA round 3 (ACCEPT)
After the round-2 fix: `tsc` 0, `pnpm run build` 0, `ruff` clean, fast lane 113 passed, mirror test 5 passed. The screenshots in this folder were taken before the round-2 fix; the header Accept Case and replay button states are verified in code, not in a new screenshot. The full database suite has not been run for this change.

## Full database suite
Run against the local container: 436 passed, 1 skipped, 0 failed (the run took about 2.5 hours; the cause was not investigated).
