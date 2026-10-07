# Ticket 14 — credentials, secrets and claims scan

Run on 2026-10-07 against branch `v2.0-manufacturing-extension` at `7ab2e1d`. Commands were run from the repository root.

## 1. Secrets and credentials

| Check | Command (summary) | Result |
|:--|:--|:--|
| `.env` files in version control | `git ls-files` filtered for `.env` | Only `backend/.env.example` and `frontend/.env.example` are tracked; no `.env`. `backend/.env` is ignored (`.gitignore: */.env`). |
| Key and token patterns | `git grep` for AWS, OpenAI-style, private-key, GitHub and Slack token patterns | None in project files. One placeholder inside an unrelated review-guide file under `.agents/skills/` (documentation of what to look for, not a credential). |
| Hard-coded `SECRET_KEY` | `git grep SECRET_KEY` | Only `backend/.env.example`, a placeholder that the settings check refuses in any non-development environment. |
| Demo passwords in the built frontend | grep of `frontend/.next/static` for the demo passwords, `hashed_password`, `SECRET_KEY`, `DATABASE_URL` | None. |
| Demo passwords in frontend source | grep of `app/`, `components/`, `lib/` | None. The demo sign-in panel receives role names only. |
| Browser console | every console message over a full run of 5 roles and 13 pages, filtered for password, token, bearer, secret, key patterns | No credential values. The only matches are the browser's own hint that password inputs should carry an `autocomplete` attribute. |
| Request URLs | every request URL in the same run filtered for the same patterns | None. |
| Screenshots | login page with the demo panel (`docs/evidence/ticket-13b/screenshots/01_*`) | Shows role names and descriptions only, no passwords. |
| **F1** Demo passwords in documentation | `git grep` for the two demo password strings, before and after | **Resolved by owner decision (2026-10-07):** the root `README.md` table of demo accounts with passwords was replaced by a role table without passwords and a pointer to the demo sign-in panel; after the change the search finds no match in `README.md`, `docs/` or `frontend/` (it finds the seed script, two old browser test files and an unrelated review-guide example). **The passwords are still in the git history** (earlier README versions), so this is resolved for the current tree only; they are demo-only passwords for synthetic data. The seed script `backend/app/scripts/seed.py` still defines the demo passwords (it must, to create the accounts); they are demo-only and the README says so. |

## 2. Claims in the application

| Check | Result |
|:--|:--|
| UI copy under `components/manufacturing`, `components/login` and the login form for "AI", machine learning, accuracy, reliability, savings, real-time, live SAP/Dynamics/ERP, "connected to" | No match. |
| SAP and Dynamics wording | Only "SAP-style import demonstration" and "Dynamics 365-style import demonstration", with a note that data comes from an uploaded file (`erp-mapping/upload-step.tsx`, `source_profiles.py`). |
| Validation wording | `docs/VALIDATION_RESULTS.md` and `docs/DEMO_GUIDE.md` state that the forecasts did not beat assuming the price stays the same. |
| **F2** Compliance page (v1.x) | `frontend/components/compliance/` held hard-coded arrays (a compliance score, framework statuses, an audit trail with invented users and dates), no sample label, linked from the user menu | **Resolved by owner decision (2026-10-07):** removed from navigation. The menu item is gone, `/compliance` redirects to the dashboard, the ingestion summary tile that linked to it now links to Suppliers, and the docs say so. The components stay in the code. Verified in the browser (`screenshots/after_compliance_removed.json`). |

## 3. Small items noted

- **F3** The sign-in form's inputs lack `autocomplete` attributes (the browser console hint above). Cosmetic and a small accessibility gain; not changed in this ticket.
- A signed session token stays valid until it expires after sign-out (see Section 16 item 2 in `ACCEPTANCE_CHECKLIST.md`).
- HTTPS is a deployment property. Cookies are marked secure when the environment is not development (`settings.is_production`); this was not checked against a live deployment because no deployed address was supplied.
