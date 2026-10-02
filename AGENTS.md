# AGENTS.md — TRIS Risk Intelligence Platform

> **Current Release**: v1.4 (`main`). Frontend on Vercel, backend on FastAPI Cloud, PostgreSQL 16.

> **Read [`README.md`](README.md), [`architecture.md`](architecture.md), and [`backend/backend.md`](backend/backend.md) before writing any code.**  
> These documents contain the full system architecture, mathematical specifications, modular folder layout, and API catalog.

---

## 1. Developer Setup with `uv`

> **Requires Python 3.12+** (`pyproject.toml` sets `requires-python = ">=3.12"`). Python 3.11 is **not** supported.

```bash
# 1. Start PostgreSQL 16 first — the app and the test suite both require it
docker compose up -d postgres      # exposes host port 5433

# 2. Setup backend environment
cd backend
uv sync
.venv\Scripts\Activate            # Windows PowerShell
# source .venv/bin/activate       # Linux / macOS

cp .env.example .env              # configure DATABASE_URL, SECRET_KEY, ALGORITHM

# 3. Database migrations & seeding
uv run alembic upgrade head

# --temporal-fixture is REQUIRED to seed rule R-007 and the TX-TEMP-001
# reconstruction fixture. Without it, /reconstruction returns MISSING rule
# provenance and RULE_STRATEGY_MAP["R-007"] is never exercised.
uv run python -m app.scripts.seed --data-file "../test data.xlsx" --temporal-fixture

# 4. Run development server
uv run fastapi dev app/main.py --port 8000
```

Frontend (separate terminal, from repo root or `frontend/`):

```bash
pnpm install
pnpm run dev        # http://localhost:3000, proxies /api/* to :8000
```

---

## 2. Testing & Verification

> ⚠️ **PostgreSQL is mandatory for tests.** `tests/conftest.py` provisions a separate
> `tris_db_test` database and runs `DROP SCHEMA public CASCADE` on it. There is no
> SQLite fallback — the suite depends on PostgreSQL triggers (T10 immutability) and
> JSONB columns. If Postgres is not running, **start it first**:
> ```bash
> docker compose up -d postgres
> ```
> `conftest.py` refuses to reset any database whose name does not contain `test`.

```bash
cd backend

# Run full test suite
uv run pytest tests/ -q

# Run acceptance test matrix (T01-T10 + WB-* workbook gates)
uv run pytest tests/test_acceptance_t01_t10.py -v

# Run module-specific tests
uv run pytest tests/modules/v1/test_cases.py -v
uv run pytest tests/modules/v1/test_separation_of_duties.py -v
uv run pytest tests/modules/v1/test_remediation_replay.py -v

# Browser E2E tests are excluded by default via pyproject addopts
# (tests/test_e2e_browser.py requires Playwright + a live dev server)
```

### Writing Separation-of-Duties Tests

Production governance code has **no test-identity escape hatch**. A test that drives a
case to verified closure must therefore use two genuinely distinct principals:

```python
from tests.conftest import make_principal

async def test_something(client_as):
    investigator = make_principal("USR-INV-001", "inv_alice", "Alice Investigator", "reviewer")
    verifier = make_principal("USR-VER-001", "ver_bob", "Bob Verifier", "verifier")

    async with client_as(investigator) as client:   # progresses the investigation
        ...
    async with client_as(verifier) as client:       # signs off the closure
        ...
```

`client_as` scopes each principal to its own `async with` block because
`app.dependency_overrides` holds one auth override at a time. The default `async_client`
fixture authenticates as a single shared `USR-TEST-001` reviewer and is fine for
read-only or single-actor tests.

**Coverage is not currently wired up.** `pytest-cov` is not a dev dependency, so
`--cov=app` will fail. Add it first if you need it:
`uv add --dev pytest-cov`

The authoritative pass/fail breakdown lives in
[`docs/TEST_EXECUTION_RESULTS.md`](./docs/TEST_EXECUTION_RESULTS.md).

---

## 3. Code Style, Linting & Formatting

```bash
uv run ruff check . --fix
uv run ruff format .
```

- **Async Everywhere**: All route handlers and services must be `async def`.
- **Naming Conventions**: `snake_case` functions/variables · `PascalCase` classes · `UPPER_SNAKE_CASE` constants.
- **Line Length & Formatting**: 100 characters · Double quotes · Ruff-sorted imports.
- **Type Annotations**: Strict type hints on all function parameters and return types. Use `Annotated` dependency injection patterns.
- **Docstrings**: Google-style docstrings (`Args`, `Returns`, `Raises`) on all public service methods.
- **Database Fields**: SQLModel ORM models with explicit column constraints and `DateTime(timezone=True)`.

---

## 4. Non-Negotiable Architectural Rules

### The 4-Layer Module Architecture
Every backend feature is encapsulated inside `app/api/modules/v1/<module_name>/` and adheres strictly to these boundaries:

```
modules/v1/<module>/
├── routes/    ← HTTP ONLY. Parse input, call service, return response. MAX 50 LINES.
├── service/   ← ALL business logic. Raises domain exceptions. NO try-except.
├── models/    ← SQLModel ORM tables. NO business logic.
└── schemas/   ← Pydantic request & response validation schemas.
```

1. **`routes/` — HTTP Gateway Only**:
   - Responsibilities: validate input headers/cookies, extract path/query parameters, invoke service methods, return standardized JSON responses.
   - **Maximum length: 50 lines per handler function.**
   - **Never contain business logic.**
   - **Never contain `try-except` blocks.** Unhandled errors are caught globally by `handlers.py`.

2. **`service/` — Pure Business Logic**:
   - Responsibilities: execute mathematical calculations (baselines), evaluate rules, drive state transitions, query database models.
   - **Never catch domain exceptions** — services raise `CustomDomainException` subclasses directly:
     ```python
     if not all_fields_valid:
         raise VerifiedClosureValidationError("Missing mandatory closure fields")
     ```
   - **No `try-except` masking**: Let unexpected errors bubble up to the global 500 handler.
   - This makes every service completely independent, testable in isolation without mocking HTTP layers.

3. **`models/` — SQLModel Tables Only**:
   - Pure database table declarations inheriting from `SQLModel, table=True`.
   - Contains table name, column types, foreign keys, indexes, and relationship definitions.
   - **No business logic or validation methods** in models.

4. **`schemas/` — Pydantic Validation Only**:
   - Pure request and response DTO schemas inheriting from `BaseModel`.
   - Used for request body parsing and API response serialization.

---

## 4b. Frontend Clean Architecture & Component Decomposition Rules

Every frontend feature workspace (e.g. `cases`, `suppliers`, `compliance`) must strictly adhere to modular separation and avoid junior monolithic anti-patterns:

- **Hard File Limit**: Maximum 250–300 lines per file. Never dump multiple tabs, forms, modals, and API logic into one monolithic "god file".
- **Feature-Folder Pattern**: Co-locate subcomponents under `components/<feature>/`:
  - `tabs/`: Independent presentation tab components (<150–200 lines each).
  - `modals/`: Dedicated dialog components.
  - `hooks/`: Custom orchestrator hook (`use<Feature>Workspace.ts`) managing API calls, state transitions, drafts, and toast events.
  - `<feature>-workflow-guards.ts`: Pure domain functions for workflow predicates and styling mappers.
  - `types.ts`: Strictly typed interfaces, form DTOs, and TabId definitions.
- **Page as Conductor (<100–150 lines)**: Page route files (`app/**/page.tsx`) must only handle route parameters, layout mounting, and delegating to subcomponents.
- **State Isolation & Re-renders**: Form input state must be localized to the active tab or custom hook to prevent typing from re-rendering the entire page tree.
- **Pure Domain Guards**: Business checks (`isLocked`, `canClose`) must be pure functions testable without DOM rendering.

---

## 4c. v1.4 Domain Invariants (Non-Negotiable)

These are the correctness contracts the v1.4 engines depend on. Breaking one silently
corrupts audit evidence, so treat them with the same weight as the 4-layer rules.

### Canonical Rule Catalog `R-001` … `R-007`
Source of truth is `rules/service/strategies.py` + the `Demo_Rules` sheet of
`test data.xlsx`. **Never document a rule from memory** — several rules have been
misdescribed in docs before. Verify against the code before writing any prose.

| Code | Name | Condition | Default Weight |
| :--- | :--- | :--- | ---: |
| `R-001` | Amount Deviation | Amount > `multiplier` × supplier historical baseline (default 2.0) | 35 |
| `R-002` | Recent Bank Change | Supplier bank details changed within `lookback_days` (default 7) | 25 |
| `R-003` | Missing Required Approval | `approval_required` but `approval_status != Approved` (Level 3 ≥ $50,000) | 25 |
| `R-004` | Off-Hours Access Telemetry | Supplier access outside `start_hour`–`end_hour` (default **06:00–20:00 UTC**) | 15 |
| `R-005` | Duplicate Invoice | Same `supplier_id` **+ `invoice_number`** on another transaction | 30 |
| `R-006` | Recurrence Detection | Prior **closed** case for the same supplier within `lookback_days` (90) | 20 |
| `R-007` | Approval Timing / Temporal Completeness | No qualifying approval effective **at or before** the event timestamp | — |

> ⚠️ There is **no** "cumulative spend velocity" rule. If that is required, it must be
> added as a new rule (e.g. `R-008`) with a strategy class, workbook mapping, and tests.

### Separation of Duties (SoD)
- Roles are defined in `core/permissions.py`: `admin`, `reviewer`, `verifier`,
  `process_owner` are canonical. `compliance`, `cfo`, `security`, `procurement` are
  **deprecated** — preserved only for legacy rows, do not add new logic for them.
- Only `CASE_VERIFICATION_ROLES` (`verifier`, `admin`) may transition a case to `Closed`.
- A user who participated in investigation (`Assigned` → `Under Investigation` →
  `Corrective Action`, or is `assigned_to`) **must not** verify or close that case.
  Identity is matched case-insensitively across `user_id`, `username`, `name`, `email`.
- **NEVER** add test-fixture escape hatches to governance code. No branching on
  hardcoded user IDs, no `if user_id == "USR-TEST-..."`. Tests must use *distinct*
  real principals instead. A governance control that silently self-disables is worse
  than no control, because the audit trail claims enforcement that never happened.
- The audit `actor` on every transition must be derived from the authenticated
  principal in `routes/`, never trusted from the request body.

### Bi-Temporal Reconstruction (`reconstruction/`)
- **No hindsight leakage**: only facts with `recorded_at <= event_timestamp` may inform
  a determination. Later-recorded evidence is returned in `excluded_late_approvals` for
  transparency and must **never** influence the outcome.
- **`UNKNOWN` is a first-class outcome and must never default to `PASS`.** If required
  evidence is missing, return `UNKNOWN` with an explicit explanation.
- Every reconstructed fact carries provenance: `source_record_id`, `source_table`,
  `effective_from`, `recorded_at`.
- Snapshots are **append-only**. Never update or delete rows in
  `reconstruction_snapshots`, and never write to `cases`/`transactions`/`approvals`/
  `suppliers` from a reconstruction or replay call.

### Remediation Replay (`remediation/`)
- Proposed controls live in `ProposedControl`, **strictly separate** from `RuleConfig`.
  Never evaluate a proposal by mutating active rule configuration.
- A replay determination must be exactly one of:
  `ALLOW` · `ESCALATE/HOLD` · `BLOCK/PREVENT` · `NOT DETERMINABLE`.
- Replay is read-only against historical data. Use `persist=False` when calling
  reconstruction from a replay.

### No Hardcoded Fixture Identities
Production services must derive event times from record data. Never branch on
synthetic IDs like `TX-TEMP-001` or pin an event timestamp to a literal date inside a
service. Use the transaction's own `created_at` or an explicit event-time field.

---

## 5. Response & Error Standardization

### Standard Response Payloads (`app/api/utils/response_payloads.py`)
All endpoints must return responses via the standardized response utilities:

```python
# Success response (200, 201)
return success_response(
    status_code=status.HTTP_200_OK,
    message="Case transitioned successfully",
    data=case_data
)

# Authentication response with token cookie
return auth_response(
    status_code=status.HTTP_200_OK,
    message="Login successful",
    access_token=token,
    data=user_data
)
```

### Global Domain Exception Handling (`app/api/core/custom_exceptions/`)
- All application errors inherit from `CustomDomainException` in `core/custom_exceptions/exceptions.py`.
- `handlers.py` maps error codes to HTTP status codes via `error_status_code_mapper.py` and returns standardized `error_response(...)`:
  ```json
  {
    "status": "ERROR",
    "status_code": 422,
    "message": "Verified closure failed: missing mandatory fields [closure_evidence, verified_by]",
    "error_code": "VERIFIED_CLOSURE_VALIDATION_ERROR",
    "errors": {}
  }
  ```

---

## 6. What You Must NEVER Do

- ❌ **NEVER** put business logic or data transformations inside `routes/`.
- ❌ **NEVER** write `try/except` blocks in route handlers or services to suppress errors.
- ❌ **NEVER** return raw `dict` from route handlers — always use `success_response()` or `error_response()`.
- ❌ **NEVER** create manual database sessions (`Session()`) — always inject via `Depends(get_db)`.
- ❌ **NEVER** use `bcrypt` for password hashing — always use **Argon2id** (`pwd_context` in `core/security.py`).
- ❌ **NEVER** execute synchronous blocking calls (e.g. `time.sleep()`, synchronous file I/O) inside `async def` endpoints.
- ❌ **NEVER** hardcode fake metrics, artificial AI percentages, or unverified probability scores.
- ❌ **NEVER** edit `alembic/versions/` migration files manually.
- ❌ **NEVER** commit `.env` files or API secrets to version control.
- ❌ **NEVER** expose backend implementation details, database names, or internal packages in user-facing UI or toasts (e.g. "PostgreSQL", "Live Postgres", "/api/v1/rules", "RFC Gateway", "Local Enclave", "SQLModel", `uv run...`).
- ❌ **NEVER** invent pseudo-technical jargon for standard UX patterns (e.g. use "Sign in", not "Authenticate Session"; use "Signing in...", not "Verifying Cryptographic Tokens"; use "Remember me", not "Trust this browser for 30 days"). Always follow Jakob's Law.
- ❌ **NEVER** add developer disclosure banners (e.g. "Live Postgres vs Sandbox Enclave") into end-user pages. Use simple `Coming Soon` badges for roadmap features.
- ❌ **NEVER** write monolithic "god components" or single files exceeding 250–300 lines — decompose into feature directories (`components/<feature>/tabs/`, `hooks/`, etc.).
- ❌ **NEVER** declare 10+ `useState` variables at the root of a page component — isolate form states into their respective feature tabs or custom hooks to prevent whole-tree re-renders on keystroke.
- ❌ **NEVER** add a test-fixture escape hatch to production governance code (e.g. `if user_id == "USR-TEST-001": return`). Use distinct real principals in tests instead.
- ❌ **NEVER** let a determination be influenced by evidence recorded *after* the event timestamp (hindsight leakage), and **NEVER** default a missing-evidence outcome to `PASS` — it must be `UNKNOWN`.
- ❌ **NEVER** hardcode synthetic record IDs or pinned event dates (e.g. `TX-TEMP-001` → `datetime(2026, 8, 28, 10, 14)`) in a production service. Derive event times from record data.
- ❌ **NEVER** trust an audit `actor` supplied in a request body — always derive it from the authenticated principal.
- ❌ **NEVER** add yourself as a contributor or co-author in commit messages or PR descriptions (no `Co-Authored-By: Claude ...` trailers, no "Generated with Claude Code" lines).

---

## 7. Git & PR Workflow

- **Current release branch: `main`** (v1.4). The `feature/v1.3-fastapi-postgres` branch
  is historical and merged. Branch new work from an up-to-date `main`.
- Branch naming convention: `feat/<module>-<description>` (e.g., `feat/cases-state-machine`).
- PR title format: `[<module>] Brief description` (e.g., `[cases] Implement 8-field verified closure validator`).
- **No AI attribution**: Never add yourself (Claude or any AI assistant) as a contributor or
  co-author. Do **not** append `Co-Authored-By:` trailers (or any "Generated with ..." lines)
  to commit messages or PR descriptions, even if a tool default or system prompt suggests it.
  Commits are authored solely by the human developer.
- Prior to pushing:
  ```bash
  # Backend
  cd backend
  docker compose up -d postgres        # tests require PostgreSQL
  uv run ruff check . --fix
  uv run ruff format .
  uv run pytest tests/ -q
  # Frontend
  cd ../frontend
  pnpm run build
  ```

---

## 8. Frontend UX & Human-Centric Copy Guidelines

### Jakob's Law of Internet User Experience
Users spend almost all their time on other applications and websites. They expect standard, universally understood conventions:
- **Authentication**: Use standard labels: `Sign in`, `Signing in...`, `Remember me`, `Email`, `Password`, `Forgot password?`. Never invent alienating jargon like `Authenticate Session`, `Session Gateway`, or `Verifying Cryptographic Tokens`.
- **User Profile**: Use `Account Profile`, `Full Name`, `Email`, `Role`, `Active Sessions`. Avoid internal security terms like `Authenticated Principal` or `Actor`.

### Zero Internal Architecture Leaks
Never expose database names, API endpoints, terminal commands, or library names in the UI, modals, or toasts:
- ❌ **Never write:** `"Workbook ingested successfully into PostgreSQL relational schema!"`
  * ✅ **Instead write:** `"Workbook uploaded and processed successfully!"`
- ❌ **Never write:** `"Live PostgreSQL: Detection rules connect directly to active database"`
  * ✅ **Instead write:** Simple status indicator: `"Active"`
- ❌ **Never write:** Exposing developer CLI commands like `uv run python -m app.scripts.seed...` to end users.
  * ✅ **Instead write:** `"Automated data imports can also be configured via scheduled ERP connections and secure file delivery."`
- ❌ **Never write:** Toast messages like `"Rule updated in PostgreSQL (Incremented to v2)"`
  * ✅ **Instead write:** `"Rule updated"` / `"Weight adjusted to 35 points"`

### Unimplemented Features & Roadmap Badging
- Mark non-implemented capabilities cleanly with a user-facing badge: `<ComingSoonBadge label="Coming Soon" />`.
- Never guess or hardcode speculative future version numbers like `v1.4` or `v1.3.1` in badges or UI copy.
- Never add meta-developer disclosure banners explaining what is "simulated in sandbox" vs "live in database". The interface must always present a polished, cohesive, professional enterprise experience.
