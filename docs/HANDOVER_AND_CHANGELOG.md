# TRIS v1.3 — Engineering Handover & Changelog

> **TRIS (Total Risk Intelligence System) — Version 1.3 Implementation Handover**  
> Complete transition from client-side prototype to an enterprise-grade FastAPI + PostgreSQL risk platform.

> **Historical record.** This is the v1.3 handover. The platform is now on **v1.4**,
> which added the bi-temporal reconstruction engine, remediation replay, and rule
> `R-007`. Test counts below are the v1.3 figures; the current suite is **127 / 127**.
> See [`TEST_EXECUTION_RESULTS.md`](./TEST_EXECUTION_RESULTS.md) for the authoritative
> breakdown, and [`AGENTS.md`](../AGENTS.md) for the v1.4 domain invariants.

---

# TRIS v2.0 — Material Cost Intelligence extension (handover and changelog)

> Status: complete on branch `v2.0-manufacturing-extension` up to Ticket 13; not merged and not tagged. The v1.3
> material below it is the historical handover and is kept as written. Dates are commit dates (git is the record).

## What v2.0 adds

The manufacturing extension described in `ARCHITECTURE_MATERIAL_COST_INTELLIGENCE.md`: file import with column
mapping, price/BOM/inventory/supplier signals, stored 30/90-day price forecasts, financial exposure and what-if
scenarios, an explainable versioned risk score, material cost cases in the existing case workflow, retrospective
validation, a second environment to show the pipeline is not built around one dataset, and the documents and case
study that go with them. v1.4 behaviour is unchanged (the v1.4 suite still passes; see below).

## Decisions (from the v2.0 instruction)

| | Decision |
|:--|:--|
| D0 | Version v2.0; v1.4 frozen at tag `v1.4-baseline`, work on `v2.0-manufacturing-extension`. |
| D2 | Environment B is a generated industrial-products (precision components, fasteners) dataset. |
| D5 | Retrospective validation: use only prior data, freeze before revealing actuals, keep failures; a leakage test is mandatory. |
| D6 | `statsmodels` added for the regression forecast models. |
| D7 | The four-role v1.4 model is kept; the reviewer absorbs the analyst tasks; one new role, `read_only_reviewer`, is view-only. |

## Changelog (by date)

| Date | Change |
|:--|:--|
| 2026-09-30 | Baseline frozen with evidence; `read_only_reviewer` and manufacturing permissions (Ticket 2); pytest sessions serialised with a database lock. |
| 2026-10-01 | Manufacturing navigation (T3); canonical schema and `case_category` on cases (T4); ERP/BOM mapping engine and screen (T5); detection analytics and the overview page (T6). |
| 2026-10-02 | Price forecasting with stored immutable runs (T7); financial exposure and scenarios (T8); explainable versioned risk score (T9). |
| 2026-10-03 | Material cost cases linked to the existing workflow (T10); a `pure` test lane that never touches the database. |
| 2026-10-04 | Retrospective validation with immutable run/case/outcome/summary/failure tables (T11); two flaws in the first validation metrics found on real data and fixed (versions 1.0 to 1.2, all runs kept); the forecast engine now withholds a history containing a zero price instead of dividing by zero. |
| 2026-10-05 | Transferability test with Environment B (T12); documentation set, case study and its checker (T13). A baseline migration (`0f3c9a7b5d21`) now creates the original tables and the case-history immutability trigger, and three older migrations tolerate existing objects, so `alembic upgrade head` builds a complete database from nothing (it could not before). The application's start-up `create_all` was removed: start-up and seeding now check the database is at the newest migration and stop with the command to run if not; an opt-in `AUTO_MIGRATE` setting can run the migrations at start-up. The Administration page (model settings, dataset registry, risk-weight editor, audit log) and the audit entries behind it were added (migration `b3d8f2a6c941`). |

Tests: **379 passed, 1 skipped** at Ticket 12 (full suite, about 18 minutes); `pytest -m pure` (no database) runs in
seconds. Raw output for each ticket is in `docs/evidence/ticket-N/`.
| 2026-10-07 | Ticket 13b (gaps found by checking the work plan `TRIS.docx` against the code): a manufacturing summary on the main dashboard; forecast, exposure and risk-level columns, a risk-level filter and CSV export on the Material Cost table; a forecast and exposure section on the material detail; a link from the dashboard to a material; an environment label in the top bar; sign-out is recorded in the audit log; sign-in is paused for 15 minutes after 5 failed attempts for the same typed identifier (`LOGIN_MAX_FAILURES`, `LOGIN_LOCKOUT_MINUTES`; the count comes from the audit log, so no new table). Also removed the stale "Coming soon" strip from the Material Cost page. One-click demo sign-in for testers: a "sign in as" panel on the login page and a "Switch demo role" item in the user menu, served by `GET /auth/demo-accounts` and `POST /auth/demo-login`; off unless `DEMO_LOGIN_ENABLED=true`, no passwords in the frontend, each use audited as `DEMO_LOGIN`; the seed adds a read-only reviewer demo user. |
| 2026-10-07 | Welcome dialog (once per browser), a Help menu, a step-by-step tour and "?" tooltips on key terms, so someone who has never seen TRIS can find their way. Front end only: no backend or database change, so a deployment needs only the frontend. |

## Known issues and gaps (read these first)

1. **Accuracy.** On the synthetic data the forecasts were not better than "the price stays the same", and the risk
   warning caught few price rises with many false alarms (`VALIDATION_RESULTS.md`, `TRANSFERABILITY_TEST.md`). The
   method is sound and honest; it has not been shown to be useful. Do not present it as predictive.
2. **Administration (work plan Section 10) was built after Ticket 13's first QA**: an admin-only Administration page
   (forecast models on/off, risk weight versions, dataset registry with a synthetic/authorised label, saved mappings,
   audit log). Not included: user management there (it stays on Settings & Governance), editing the fixed forecast
   settings (they belong to a method version), and switching off a baseline model. The audit log records the actions listed
   in `DATA_DICTIONARY.md`; sign-ins and rule edits were already recorded.
3. **The v1.x Compliance page was removed from navigation (2026-10-07).** It showed fixed sample data (scores, framework
   status, a "Global Audit Trail" with invented users and dates). `/compliance` redirects to the dashboard and the user menu
   no longer links to it; the components remain in the code. The real audit log is on the Administration page.
4. **Deployment: run the migrations before the new version starts.** FastAPI Cloud has no pre-deploy or start
   command, so nothing on the platform runs migrations. Release routine: from the `backend` folder run
   `DATABASE_URL=<production url> uv run alembic upgrade head`, then `fastapi deploy`. The application refuses to start
   on an out-of-date database, so deploying before migrating takes it down. A production database that was built by the
   old start-up `create_all` and never migrated needs the same command once before the first v2.0 deploy (it tolerates
   existing tables). If you would rather not run it by hand, set `AUTO_MIGRATE=true` for the demo: start-up then runs `alembic upgrade head`
   first, one instance at a time under a PostgreSQL lock, and stops with the error if a migration fails (the step that failed is
   rolled back, the database stays at the last revision that finished). It is off by default. Use it only for a database whose
   data can be recreated; keep it off where a bad migration would cost real data.
   **The schema comes only from migrations.** `alembic upgrade head` builds a complete database from nothing (a
   baseline migration was added in Ticket 13). The application no longer creates tables at start-up: it checks the
   database is at the newest migration and refuses to start otherwise, and the seed script does the same check. Anyone
   with an older database built by the old start-up behaviour should run `alembic upgrade head` (it tolerates existing
   tables) or `alembic stamp head` if the schema is already current.
5. **Dataset scope.** Stored forecasts, scores and validation runs belong to "all data" or to one named dataset. Only
   the Material Cost page can choose a dataset; forecasting, exposure and validation use "all data". A risk run for
   "all data" does not use forecasts stored for a named dataset.
6. **Units and currencies are not converted** (BOM and purchase units must agree; euro and dollar are shown
   separately). On-time delivery must be a fraction 0 to 1; day-first slash dates are not read.
7. **Fixed 2026-10-07:** the "Coming soon" strip for forecast and exposure was removed from the Material Cost page (both exist on the Forecasting page).
8. **The "Case Studies / Results" page is a placeholder**; the case study is a document and a script.
9. **v1.4 "before" screenshots** were captured late, on 2026-10-07, from the `v1.4-baseline` code (eight screens in
   `docs/evidence/ticket-13b/before/`; fraud detection, compliance and the correlation and reports pages were not captured). The
   dates on screen are the capture date. The v2.0 screenshot checklist is complete at 18 of 18.
10. **Independent check of the case study:** see `docs/evidence/ticket-13/INDEPENDENT_CHECK.md` for what was and
    was not done.
11. **Migrations edited.** The baseline revision was added and three older migrations were changed (existence guards and
    one parent pointer, nothing else; AGENTS.md says not to edit migrations by hand; the owner signed this change off on 2026-10-05).
    Their downgrades still drop the objects they create, even when an earlier step skipped creating them. A database
    first built from the models and then migrated has a duplicate foreign key on `risk_cases.material_id`
    (`risk_cases_material_id_fkey` and `fk_risk_cases_material_id`), from the Ticket 4 migration naming; harmless but untidy.
12. Development database: holds demo data from earlier tickets (duplicate demo materials, extra runs, scratch
    databases `tris_empty_ui`, `tris_case_study`). Safe to delete; stored runs cannot be edited, so use a new database.

## Sign-in throttle: what it does and does not do

Five failed sign-ins for the same typed identifier within 15 minutes pause sign-in for that identifier until the window
passes (`LOGIN_MAX_FAILURES`, `LOGIN_LOCKOUT_MINUTES`). A username and an email for one person are counted separately, a
successful sign-in does not reset the count, and there is no limit per IP address. Anyone who knows a username can therefore keep
that user locked out for 15 minutes at a time; the pause ends by itself. The demo sign-in does not use the throttle because it takes no
password. The login page and the top bar say "evaluation environment, synthetic data" unless `NEXT_PUBLIC_EVALUATION_LABEL=off`
is set for the frontend of a deployment that holds real data.

## Developer handover note: what is built, what is a demonstration, what is planned

**Built and working (checked by tests and in the browser).** File import with column mapping and an error log; saved mapping
profiles; price, deviation, BOM, supplier and stock signals computed from the imported data; stored 30- and 90-day price forecasts
with their model, version and data fingerprint; financial exposure and roll-ups by supplier, product and category; what-if scenarios that
are never stored; an explainable, versioned 0 to 100 risk score; material cost cases in the existing case workflow with separation of
duties; retrospective validation with stored runs, false alarms and misses; a second environment through the same pipeline; the
Administration page and an audit log; the dashboard summary; a login throttle and a sign-out record.

**Demonstrations, not integrations.** The SAP-style and Dynamics 365-style layouts are file-import demonstrations: nothing here
connects to an ERP system, and no screen says it does. Both environments are synthetic. One-click demo sign-in exists to let
reviewers try each role and is meant only for a deployment with synthetic data. The validation results show the method running end to
end; on this data the forecasts were not better than assuming the price stays the same, and the risk warning is not shown to be reliable.

**Planned, not started.** A live, authorised ERP connector; unit and currency conversion; a pilot on real purchasing data before any
claim of usefulness; forecasting by supplier or from demand; a dataset picker on every manufacturing page; a real compliance page (the v1.x
Compliance page, which showed static sample content, was taken out of navigation); per-IP limits and server-side token revocation (a signed-in session stays valid until it
expires, up to 60 minutes, even after sign-out).

## Future work (not started)

Unit and currency conversion; a dataset name and date range in the top bar of every manufacturing page (today only the Material Cost summary shows them); a dataset picker on every
manufacturing page; a pilot on real purchasing data before any claim of usefulness; forecasting by supplier and
from demand; an SAP- or Dynamics-style rendering of Environment B; merging and tagging `v2.0` after the final QA
(Ticket 14).

## How to run and verify

| What | Command |
|:--|:--|
| Everything (needs PostgreSQL) | `cd backend && uv run pytest tests/ -q` |
| Fast lane, no database | `cd backend && uv run pytest -m pure -q` |
| Case study figures | `uv run pytest tests/modules/v1/test_case_study_reproducible.py` |
| Transferability | `uv run pytest tests/modules/v1/test_transferability.py` |
| Lint / format | `uv run ruff check . && uv run ruff format --check .` |
| Frontend build | `cd frontend && pnpm run build` |

---

## 1. Executive Summary

TRIS v1.3 introduces a robust, auditable risk architecture designed to withstand strict enterprise regulatory scrutiny. All core business rules, descriptive statistical baselines, and case state transitions have been relocated to an asynchronous Python 3.12 FastAPI backend, managed with `uv` and backed by PostgreSQL with SQLModel.

### Key Milestones Achieved:
1. **Zero Fake Metrics**: Eliminated all artificial AI percentages and unverified probability metrics in favor of transparent, explainable deterministic heuristics.
2. **Mathematical Rigor**: Implemented strictly governed baseline descriptive statistics (`SUP-001` historical mean = **$30,471.43** across `TX-1001`..`TX-1007`) that provably exclude the target anomaly `TX-1999` ($104,000.00).
3. **Consolidated Heuristics**: Coordinated Strategy Pattern rules `R-001` through `R-006` with version tracking and additive scoring ($35 + 25 + 25 + 15 = 100 \implies \text{High Priority}$), automatically consolidating multi-signal alerts into `TEST-CASE-001`.
4. **Governed Case Lifecycle**: State machine matrix strictly prohibits illegal status jumps and enforces an **8-field verified closure gatekeeper** before any case can transition to `Closed`.
5. **Append-Only Immutability**: Protected audit logs via PostgreSQL triggers blocking `UPDATE` and `DELETE` mutations on `case_history`.
6. **Real-Time Notification Hub**: PostgreSQL-backed event alerting engine with multi-tier RBAC routing (user, role, broadcast) and automated domain event emissions from case transitions and background ingestion jobs.
7. **Unified Developer Acceptance Matrix & Full Suite**: Automated test suite achieving **78/78 overall backend tests passing (100% pass rate)** at v1.3 (127/127 as of v1.4).

---

## 2. Directory Layout & Architecture

```
tris-app/
├── backend/
│   ├── alembic/                    # Async database migrations
│   ├── app/
│   │   ├── api/
│   │   │   ├── core/               # Config, security (Argon2id), exceptions, dependencies
│   │   │   ├── db/                 # Async database session & trigger definitions
│   │   │   ├── modules/v1/         # 4-layer modular domain architecture
│   │   │   │   ├── auth/           # User authentication & JWT issuance
│   │   │   │   ├── ingestion/      # Multi-sheet Excel workbook parser & CLI seeder
│   │   │   │   ├── suppliers/      # Supplier master & baseline descriptive statistics
│   │   │   │   ├── transactions/   # Transaction ledger tables & queries
│   │   │   │   ├── approvals/      # Internal control approval records
│   │   │   │   ├── access_events/  # Zero-trust telemetry logs
│   │   │   │   ├── notifications/  # PostgreSQL notification hub & event emitter
│   │   │   │   ├── rules/          # Strategy pattern rule engine (R-001..R-006)
│   │   │   │   └── cases/          # Governed case state machine & 8-field closure
│   │   │   └── utils/              # Standardized response envelopes (success, auth, error)
│   │   ├── scripts/                # Database seeding script (seed.py)
│   │   └── main.py                 # FastAPI application entrypoint & lifespan
│   ├── tests/                      # Automated test suite (409 tests)
│   ├── pyproject.toml              # UV package specification
│   └── docker-compose.yml          # PostgreSQL 16 container specification
├── frontend/
│   ├── app/
│   │   ├── cases/[id]/             # Dynamic Case Detail workspace & 8-field closure modal
│   │   ├── ingestion/              # Multi-sheet Excel ingestion workspace
│   │   ├── zero-trust/             # Real-time access logs & telemetry dashboard
│   │   ├── fraud-detection/        # Anomaly detection dashboard
│   │   └── suppliers/              # Supplier portfolio & baseline statistics
│   ├── components/
│   │   └── notifications-popover.tsx # Live PostgreSQL notification popover with tab filters
│   ├── lib/
│   │   ├── api.ts                  # Typed API client connecting to FastAPI backend
│   │   └── auth-context.tsx        # React authentication provider with live backend integration
│   ├── next.config.mjs             # Next.js rewrites proxying /api/ to FastAPI
│   └── package.json
└── task.md                         # Persistent state tracker and verification checklist
```

---

## 3. Quickstart & Verification Guide

### Backend Setup (Python 3.12+ with `uv`)

```bash
cd backend

# 1. Sync dependencies
uv sync

# 2. Start PostgreSQL container
docker compose up -d

# 3. Apply migrations and seed data from synthetic Excel workbook
uv run python -m app.scripts.seed --data-file "../test data.xlsx"

# 4. Run development server
uv run fastapi dev app/main.py --port 8000
```

### Running Backend Tests

```bash
cd backend

# Run the 10-point Developer Acceptance Matrix (T01 to T10)
uv run pytest tests/test_acceptance_t01_t10.py -v

# Run the full 78-test suite (100% pass rate)
uv run pytest tests/ -v

# Run Ruff linter and formatter
uv run ruff check . --fix
uv run ruff format .
```

### Frontend Setup (Next.js 16 App Router)

```bash
cd frontend

# 1. Install dependencies
pnpm install

# 2. Build for production (Turbopack static compilation)
pnpm run build

# 3. Run development server (Proxies /api/ to http://127.0.0.1:8000)
pnpm run dev
```

---

## 4. Acceptance Criteria Verification Summary

| Gate | Requirement | Implementation | Evidence |
| :---: | :--- | :--- | :--- |
| **T01** | Ingestion & Schema Integrity | `IngestionService.ingest_excel_workbook` | 19 txns, 8 suppliers, 8 events loaded clean |
| **T02** | Strict Baseline Exclusion | `BaselineService.calculate_baseline` | $30,471.43 average strictly excluding TX-1999 |
| **T03** | R-001: Amount Deviation (> 2.0x) | `RuleAmountDeviation` | 3.41x observed, +35 points |
| **T04** | R-002: Bank Change (< 7 days) | `RuleRecentBankChange` | 2 days observed, +25 points |
| **T05** | R-003: Missing Control Approval | `RuleMissingApproval` | AP-1999 Missing Level 3, +25 points |
| **T06** | R-004: Off-Hours Access Telemetry | `RuleOffHoursAccess` | AE-003 at 22:47:00, +15 points |
| **T07** | Signal Consolidation & Score 100 | `RuleEngineService.evaluate_transaction` | Consolidated score 100 (High Priority) |
| **T08** | Case State Machine Governance | `CaseService.transition_case` | Illegal transition returns 409 Conflict |
| **T09** | 8-Field Verified Closure Validator | `CaseService.transition_case` | Incomplete returns 422; complete returns 200 |
| **T10** | Immutable Audit Trail Integrity | `CaseHistory` + PostgreSQL trigger | Append-only history verified |

---

## 5. Core Documentation & Specification References

- [Case Lifecycle & Governance Specification](file:///c:/Users/dell/Documents/tris-app/docs/CASE_LIFECYCLE_AND_GOVERNANCE_SPECIFICATION.md): Full reference for case state machine, Reopened pathways, 8-field verified closure dictionary, and Segregation of Duties (SoD) roadmap.
- [Architecture Decisions & Engineering Roadmap](file:///c:/Users/dell/Documents/tris-app/docs/ARCHITECTURE_DECISIONS_AND_ROADMAP.md): 10 core ADRs, pictorial ERDs, and phased milestone breakdown.
- [Product Manager Validation Storyboard](file:///c:/Users/dell/Documents/tris-app/docs/STORYBOARD.md): End-to-end user testing flows, credentials, and acceptance scenarios across all 4 personas.
