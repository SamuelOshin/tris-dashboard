# Welcome, tour and tooltips: completion report

Branch `feat/welcome-and-guided-tour` (from `main` at the `v2.0` tag). Front end only; no backend or database change. Nothing committed.

## What was built
- `frontend/components/onboarding/`: welcome dialog, guided tour (own code, no new library), Help menu, `?` tooltip component, plain-language
  glossary, once-per-browser memory, and the provider that ties them together; wired into `dashboard-layout.tsx` and `user-nav.tsx`.
- `data-tour` markers on the Manufacturing menu and its items, Risk Cases, the account menu, the dashboard summary and the Help button.
- `?` tooltips on: the four dashboard cards, the risk-trend chart and top-exposure table, six Material Cost table headers, the risk score
  section, the forecast explanation, the what-if scenario panel, the validation form, and the risk-weights page.

## Checked in the browser (`onboarding_results.json`, screenshots in this folder)
- First visit: welcome opens by itself; a reload does not show it again; Help > What is new reopens it; Escape closes it.
- Tour: administrator sees 10 steps in order, ends on Done; verifier (no Manufacturing section) sees 3; Escape leaves the tour.
- Tooltip: hovering the exposure `?` shows its definition.
- Narrow phone-width screen: the welcome fits; the tour keeps only steps that can be shown (1) instead of getting stuck.
- `tsc` exit 0, `pnpm run build` exit 0.

## Found and fixed while testing
- Opening the welcome from the Help menu and then closing it left the page unclickable (a known issue when a dialog opens from a modal menu).
  Fixed by making the Help menu non-modal and opening the dialog after the menu closes; re-tested.

## Limits
- The front end has no automated test runner; checks were scripted in a real browser.
- On a phone-width screen the sidebar is hidden, so the tour is short.
- `dashboard-layout.tsx` is 374 lines (it was 369 before; the file limit of 300 was already exceeded).
- Scripts that drive the app must dismiss the welcome first (documented in `docs/DEMO_GUIDE.md`).

## After QA (verdict: REJECT for three medium findings, then fixed)

QA found no blocker. Fixed and re-checked in the browser (`onboarding_fixes_results.json`):
- **Tour stuck after a resize (M1):** making the window narrow mid-tour left an invisible tour that swallowed keys and could not be
  restarted. Now the tour moves to a step that is still visible, or ends, and **Help > Take the tour** always starts a fresh run from step one.
- **Keyboard focus (M2):** Tab and Shift+Tab stay inside the tour card; focus goes back to the Help button when the tour ends.
- **Overclaim (M3):** the supplier concentration tooltip now says one supplier has most of the spend (70% or more by default) and that there are "few
  alternatives", not "no alternative".
- Also: the highlight outline is now drawn (brand-colour ring plus the dimming); the risk score tooltip says "up to nine factors"; exposure says
  "the latest monthly price"; the verifier's and process owner's welcome lines describe their roles correctly; each dashboard card's link is
  announced with its figure (for example "High-risk materials: 3"); with browser storage blocked the welcome no longer reappears on every visit
  to the dashboard; the tooltip is documented as hover or keyboard focus (not tap); the file length in this report is corrected (369, not 358).
- Not changed: the theme toggle crashes the whole app when the browser blocks local storage completely (`theme-toggle.tsx`, present since before
  this change). With storage blocked only for the welcome note, the app works.
- No ESLint is installed, so no lint run exists; `tsc` and the build pass.
