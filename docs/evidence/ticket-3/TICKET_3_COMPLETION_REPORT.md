## Ticket 3 — Navigation / UI Shell — COMPLETE

Branch: `v2.0-manufacturing-extension`. Raw evidence files are alongside this report.

### Acceptance criteria checked:

- **Manufacturing section appears in the left nav, visible per role per Ticket 2's model:** PASS
  - Sidebar group "Manufacturing" with five items: Material Cost Intelligence, ERP/BOM Data Mapping, Forecasting & Scenarios, Validation, Case Studies / Results.
  - Checked live in the running app (signed in as each role):
    - `reviewer` — group shown, all five pages open. `01_`, `02_` screenshots.
    - `admin` — group shown (five links present). `04_` screenshot.
    - `read_only_reviewer` (`readonly_qa`) — group shown, Forecasting & Scenarios opened. `05_` screenshot.
    - `verifier` — group **not** shown; opening `/manufacturing/material-cost` directly renders "Access restricted". `03_` screenshot.
  - `process_owner` and the deprecated roles were **not** exercised in the browser (no such seeded user). They are handled by the same role guard as `verifier`.
- **Every existing nav link still resolves:** PASS
  - Clicked each of the six existing sidebar links as `reviewer`; each landed on the right route (page titles shown): `/` (dashboard), `/risk-cases` (Risk Review Dashboard), `/suppliers` (Supplier Risk Management), `/ingestion`, `/zero-trust` (Access Event Monitoring), `/dashboard/settings` (Settings & Governance).
  - The production build still generates all 14 original routes (see build output).
- **New pages render genuine empty/not-yet-implemented states — no mock figures, no fake charts:** PASS
  - Each page renders the item name, a "Coming Soon" badge and "This area is not available yet, so there is no data to show."
  - A search of the new files for percentages and currency figures found none (the only match was a `${}` template string).

### Verification commands run (raw output):

Paths use the real `frontend/` directory (the ticket text's `fe/` is shorthand).

```
pnpm run build            -> exit=0, Compiled successfully, 20/20 static pages
                             (14 original routes + /manufacturing and 5 sub-pages)
                             full output: frontend_build.txt
grep -rn "Manufacturing" frontend/components/*nav* frontend/app/layout.tsx
                          -> matches in frontend/components/manufacturing-nav.tsx
                             (no match in app/layout.tsx; nothing there needs one)
                             full output: grep_manufacturing.txt
```

### Regression check (required from Ticket 2 onward):

```
cd backend && uv run pytest tests/ -q
141 passed, 5 warnings in 390.78s (0:06:30)
```
- 141 = 127 baseline + 14 added in Ticket 2. Zero failures, zero errors.
- Full output: `backend_regression.txt`.
- This ticket changed only frontend files, so no backend change is expected; the suite was re-run anyway per the standing rule.

### Files changed:

Modified: `frontend/components/dashboard-layout.tsx` (+2 lines: import and `<ManufacturingNavGroup />`), `frontend/middleware.ts` (+1 protected prefix `/manufacturing`), `README.md` (test account row).
New: `frontend/components/manufacturing-nav.tsx`, `frontend/components/manufacturing/*` (navigation data and role guard, badge, empty/denied states, page shell), `frontend/app/manufacturing/**` (index redirect + five pages), `docs/evidence/ticket-3/*`.

### Anything interpreted or decided that wasn't explicitly specified:

1. **Which roles see the section:** `admin`, `reviewer`, `read_only_reviewer`. `verifier`, `process_owner` and the deprecated roles do not (D7 grants them no manufacturing capability). Changing this is one line in `manufacturing-navigation.ts`.
2. **Frontend visibility only.** Hiding the nav and showing "Access restricted" is a UI control, not security. There are no manufacturing endpoints yet; server-side protection arrives with them (consolidated instruction §2).
3. **Dead code left alone.** `protected-layout.tsx` and `tris-navigation.tsx` are not used by any page, so the section was added to the live sidebar (`dashboard-layout.tsx`) only. The ticket's grep is satisfied by `manufacturing-nav.tsx`, which sits at the top level of `components/` so the `components/*nav*` glob matches it.
4. **`/manufacturing` added to middleware's protected prefixes** (not named in the ticket). Without it, unauthenticated visitors would not be redirected to sign in by middleware.
5. **Own `ComingSoonBadge` copy** in `components/manufacturing/`, mirroring the existing local one in `integrations-tab.tsx`, which was left untouched.
6. **Breadcrumbs are passed explicitly** (TRIS Studio › Manufacturing › page) because the layout's default breadcrumbs only know the core routes.
7. **Test account created in the local dev database:** `readonly_qa` (Read-Only Reviewer). Not created by the seed script. Its password was set to the README's demo-style value and is documented in `README.md`.
8. **`dashboard-layout.tsx` is 358 lines**, above the 250–300 guideline. It was already 357 before this ticket; only 2 lines were added, and the new section lives in its own file. Splitting the layout is out of scope.
9. **First sign-in oddity:** on the first login of the session the page showed "Signed in successfully / Redirecting" but stayed on `/login` until `/` was loaded manually; a later sign-in redirected normally. The login code was not touched. Cause not investigated.

### Not done / open:

- The v1.4 "before" screenshots (Ticket 1 follow-up, due before Ticket 3's UI change) are still to be added manually by the project owner.
- `process_owner` was not checked in the browser (no seeded user).
