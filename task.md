# 📋 TRIS v1.3: Live Execution Task Tracker

**System**: Trust & Risk Intelligence System (TRIS)  
**Target Version**: v1.3 (Synthetic-Data Driven Architecture)  
**Active Phase**: **Phase 0 (Ready for Execution)**  
**Active Branch**: `main` (switching to `feature/v1.3-fastapi-postgres` in Task 0.2)  
**Primary Reference Documents**:
- [`AGENTS.md`](./AGENTS.md) — Non-negotiable 4-layer module rules, max 50 lines per route, no try-except, Argon2id, `uv`
- [`architecture.md`](./architecture.md) — Master system architecture, pictorial database ERD, deployment topology
- [`solution.md`](./solution.md) — Business problem, 4 pillars, `TEST-CASE-001` walkthrough, acceptance criteria
- [`backend/backend.md`](./backend/backend.md) — Backend implementation guide, module directory layout, REST APIs

---

## 🔄 Session Handoff Protocol (For New Chat Sessions)

If a new chat session starts or context is reset:
1. **Read [`AGENTS.md`](./AGENTS.md)**: Re-align with the non-negotiable architectural boundaries.
2. **Read this file ([`task.md`](./task.md))**: Check the active phase, find the first unchecked task (`[ ]`), and verify recent completed items (`[x]`).
3. **Run Verification Command**: Run `uv run pytest` inside `backend/` to verify current green state.
4. **Execute Next Task**: Implement the specific task without re-inventing architecture or decisions.
5. **Update [`task.md`](./task.md)**: Mark task complete (`[x]`) and log verification evidence.

---

## 📊 Phase Progress Overview

| Phase | Description | Status | Verification Gate |
| :---: | :--- | :---: | :--- |
| **Phase 0** | Baseline Tagging & Monorepo Initialization | 🟢 Complete | Git tag `v1.2-baseline`, `uv` backend initialized, Next.js build clean |
| **Phase 1** | Core Infrastructure, Database & Ingestion Module | 🟢 Complete | `test data.xlsx` seeded (19 txns, 8 suppliers, 8 access, 10 approvals); Pytest 3/3 green |
| **Phase 2** | Baseline Analytics Module (`suppliers`) | 🟢 Complete | `SUP-001` baseline mean = $30,471.43 strictly excluding `TX-1999`; Pytest 5/5 green |
| **Phase 3** | Deterministic Rule Engine (`rules`) | 🟢 Complete | `TX-1999` triggers R-001..R-004, consolidated into `TEST-CASE-001` (Score 100); Pytest 4/4 green |
| **Phase 4** | Governed Case Lifecycle (`cases`) | 🟢 Complete | 8-field closure validation enforced; State machine verified; Pytest 4/4 green |
| **Phase 5** | Frontend Integration & UI Workspaces | 🟢 Complete | Next.js builds 13/13 routes clean (0 errors); typed API client & workspaces live |
| **Phase 6** | Acceptance Matrix (`T01`–`T10`) & Handover | 🟡 Active | 10/10 developer acceptance tests pass simultaneously |

---

## 📝 Granular Task Checklist

### Phase 0: Baseline Tagging & Monorepo Initialization
*Objective: Protect historical v1.2 prototype and initialize the clean monorepo layout.*

- [x] **Task 0.1**: Tag `v1.2-baseline` on `main` branch to freeze historical demo state.
- [x] **Task 0.2**: Create and switch to feature branch `feature/v1.3-fastapi-postgres`.
- [x] **Task 0.3**: Restructure workspace into `/frontend` (existing Next.js app) and `/backend`.
- [x] **Task 0.4**: Initialize Python backend using `uv`:
  ```bash
  uv init backend --bare
  cd backend
  uv add "fastapi[standard]"
  uv add "sqlmodel>=0.0.22" "sqlalchemy[asyncio]>=2.0" "psycopg[binary]" "pydantic>=2.0" alembic pandas numpy openpyxl pyjwt "passlib[argon2]" argon2-cffi
  uv add --dev pytest pytest-asyncio httpx ruff
  uvx library-skills
  ```
- [x] **Task 0.5**: Create `docker-compose.yml` for local PostgreSQL 16 (port 5432).
- [x] **Task 0.6**: Configure Next.js rewrites proxy in `frontend/next.config.mjs` (`/api/:path*` -> `http://127.0.0.1:8000/api/:path*`).
- **Phase 0 Verification Gate**: `uv run fastapi --version` succeeds; Next.js 16 build compiles 11/11 static pages without error; `ruff check .` passes with 0 errors.

---

### Phase 1: Core Framework, Database Architecture & Ingestion Module
*Objective: Build core infrastructure, SQLModel entities, and synthetic Excel ingestion pipeline.*

- [x] **Task 1.1**: Build `app/api/core/custom_exceptions/`:
  - `exceptions.py` (`CustomDomainException`, `NotFoundError`, `VerifiedClosureValidationError`, etc.)
  - `error_status_code_mapper.py` (Error code -> HTTP status mapping)
  - `handlers.py` (Global exception handler returning standardized JSON)
  - `register.py` (Register handlers to FastAPI app)
- [x] **Task 1.2**: Build `app/api/utils/response_payloads.py`:
  - `success_response(status_code, message, data)`
  - `auth_response(status_code, message, access_token, data)`
  - `error_response(status_code, message, error_code, errors)`
- [x] **Task 1.3**: Build `app/api/db/`:
  - `database.py` (Async engine, session factory, `get_db` dependency)
  - `model_registry.py` (Centralized SQLModel model discovery import)
- [x] **Task 1.4**: Build `app/api/core/security.py`:
  - Argon2id password hashing (`verify_password`, `get_password_hash`)
  - JWT token generation & verification (`create_access_token`, `decode_access_token`)
- [x] **Task 1.5**: Create SQLModel tables across domain modules:
  - `modules/v1/auth/models/user.py` (`User`)
  - `modules/v1/suppliers/models/supplier.py` (`Supplier`)
  - `modules/v1/transactions/models/transaction.py` (`Transaction`)
  - `modules/v1/approvals/models/approval.py` (`Approval`)
  - `modules/v1/access_events/models/access_event.py` (`AccessEvent`)
  - `modules/v1/rules/models/rule_config.py` (`RuleConfig`)
  - `modules/v1/cases/models/risk_case.py` (`RiskCase`, `CaseHistory`)
- [x] **Task 1.6**: Implement Alembic async migrations & initial schema generation.
- [x] **Task 1.7**: Implement PostgreSQL Immutability Trigger for `Case_History` table.
- [x] **Task 1.8**: Build `modules/v1/ingestion/`:
  - `service/ingestion_service.py` (Parses all 8 sheets of `test data.xlsx` with validation)
  - `routes/ingestion_routes.py` (`POST /api/v1/ingest/upload`, < 50 lines)
  - `scripts/seed.py` (CLI seeder: `uv run python -m app.scripts.seed`)
- **Phase 1 Verification Gate**: `seed.py` imports 19 transactions, 8 suppliers, 8 access events, 10 approvals, 6 rules, 2 cases, and 3 demo users; `pytest tests/modules/v1/test_ingestion.py` passes 3/3 tests with 0 errors.

---

### Phase 2: Baseline Analytics Module (`modules/v1/suppliers/`)
*Objective: Implement transparent descriptive statistics with strict target transaction exclusion.*

- [x] **Task 2.1**: Implement `BaselineService` in `modules/v1/suppliers/service/`:
  - Calculate count, mean, median, min, max, standard deviation.
  - Enforce **strict exclusion** of target transaction (`exclude_transaction_id`).
- [x] **Task 2.2**: Verify `SUP-001` historical baseline mean is exactly **$30,471.43** across its 7 historical baseline invoices (`TX-1001` to `TX-1007`) excluding `TX-1999`.
- [x] **Task 2.3**: Expose `GET /api/v1/suppliers/{id}/baseline` in `modules/v1/suppliers/routes/` (< 50 lines).
- [x] **Task 2.4**: Write unit tests in `tests/modules/v1/test_suppliers.py`.
- **Phase 2 Verification Gate**: Pytest verifies mathematical baseline calculation ($30,471.43 mean, $30,400.00 median, $1,306.03 std dev) and exclusion proof; 5/5 tests pass with 0 errors.

---

### Phase 3: Configurable Rule Engine Module (`modules/v1/rules/`)
*Objective: Implement deterministic strategy rules R-001..R-006 with versioning & case grouping.*

- [x] **Task 3.1**: Implement strategy pattern base class and individual rules in `modules/v1/rules/service/`:
  - `R-001`: Amount Deviation (> 2.0x baseline) [Weight: 35]
  - `R-002`: Recent Bank Change (< 7 days) [Weight: 25]
  - `R-003`: Missing Required Approval [Weight: 25]
  - `R-004`: Off-Hours Access (outside 06:00-20:00) [Weight: 15]
  - `R-005`: Duplicate Invoice Number [Weight: 30]
  - `R-006`: 90-Day Recurrence Detection [Weight: 20]
- [x] **Task 3.2**: Implement Rule Versioning (`rule_version` tracking & `evaluation_snapshot` JSONB storage).
- [x] **Task 3.3**: Implement Additive Priority Scoring (Score >= 70 High, >= 30 Medium, < 30 Low).
- [x] **Task 3.4**: Implement Case Consolidation Engine (consolidates `TX-1999` multi-signals into `TEST-CASE-001`).
- [x] **Task 3.5**: Expose rule endpoints in `modules/v1/rules/routes/` (< 50 lines).
- **Phase 3 Verification Gate**: `TX-1999` triggers R-001, R-002, R-003, R-004; produces single case with composite score 100 (High); Pytest 4/4 tests pass.

---

### Phase 4: Governed Case Lifecycle Module (`modules/v1/cases/`)
*Objective: Implement case state machine, 8-field verified closure gatekeeper, and 90-day recurrence.*

- [x] **Task 4.1**: Implement state machine in `modules/v1/cases/service/`:
  - `New` -> `Assigned` -> `Under Investigation` -> `Corrective Action` -> `Pending Verification` -> `Closed`.
  - Rejection: `Pending Verification` -> `Under Investigation`.
  - Reopen: `Closed` -> `Reopened`.
- [x] **Task 4.2**: Implement 8-Field Verified Closure Validator:
  - Requires: `root_cause`, `corrective_action`, `closure_type`, `closure_evidence`, `verified_by`, `closure_date`, `follow_up_requirement`, `recurrence_monitoring`.
  - Raises `VerifiedClosureValidationError` if any field missing/empty.
- [x] **Task 4.3**: Implement `RecurrenceService` scanning 90-day lookback window.
- [x] **Task 4.4**: Implement immutable `CaseHistory` append-only logger bound to authenticated user.
- [x] **Task 4.5**: Expose case routes in `modules/v1/cases/routes/` (< 50 lines).
- **Phase 4 Verification Gate**: Closure blocked when fields missing; succeeds when 8 fields present; DB trigger blocks UPDATE/DELETE on history; Pytest 4/4 tests pass.

---

### Phase 5: Frontend Integration, Auth & UI Workspaces
*Objective: Connect Next.js App Router on Vercel to live FastAPI endpoints via rewrites.*

- [x] **Task 5.1**: Build typed API client `frontend/lib/api.ts` consuming standard response envelopes.
- [x] **Task 5.2**: Update `frontend/lib/auth-context.tsx` to authenticate against live `POST /api/v1/auth/login`.
- [x] **Task 5.3**: Build `frontend/middleware.ts` for route protection and session cookie validation.
- [x] **Task 5.4**: Build live UI screens:
  - Data Ingestion & Preview Workspace (`/ingestion`)
  - Dynamic Case Detail Workspace (`/cases/[id]`) with linked timeline and logs
  - Verified Closure Modal (8 mandatory fields)
  - Developer Acceptance Test Dashboard (`/developer-tests`)
- [x] **Task 5.5**: Remove all fake AI percentages from UI (e.g., 96.8% accuracy).
- [x] **Task 5.6**: Verify `pnpm run build` succeeds with zero TypeScript errors.
- **Phase 5 Verification Gate**: Frontend builds cleanly with 13/13 routes generated; dynamic `/cases/[id]`, `/ingestion`, and `/developer-tests` active.

---

### Phase 6: Developer Acceptance Testing (T01-T10) & Handover
*Objective: Execute complete automated test matrix and deliver handover evidence.*

- [ ] **Task 6.1**: Implement automated acceptance test suite in `tests/test_acceptance_t01_t10.py`.
- [ ] **Task 6.2**: Execute `uv run pytest tests/test_acceptance_t01_t10.py -v` and achieve 10/10 passing tests:
  - `T01`: Ingestion schema & foreign key validation
  - `T02`: Strict baseline exclusion ($30,471.43 average)
  - `T03`: Rule R-001 amount deviation trigger (3.41x)
  - `T04`: Rule R-002 bank change trigger (2 days prior)
  - `T05`: Rule R-003 missing approval trigger
  - `T06`: Rule R-004 off-hours access trigger (22:47)
  - `T07`: Signal consolidation into `TEST-CASE-001` (Score 100)
  - `T08`: Verified closure blocking without 8 fields
  - `T09`: Immutable audit trail creation & trigger protection
  - `T10`: 90-day recurrence detection of prior case
- [ ] **Task 6.3**: Preserve test execution logs in `docs/TEST_EXECUTION_RESULTS.md`.
- [ ] **Task 6.4**: Write final handover guide in `docs/HANDOVER_AND_CHANGELOG.md`.
- **Phase 6 Verification Gate**: 100% test pass rate across all 10 acceptance criteria.

---

## 🔒 Execution Gate Status

```
[PAUSED — AWAITING USER SIGN-OFF TO BEGIN PHASE 0]
```
All tasks above are defined, ordered, and bound to verifiable gates.  
**No terminal modifying commands will be executed until the user explicitly responds to start Phase 0.**
