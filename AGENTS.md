# AGENTS.md — TRIS Risk Intelligence Platform

> **Read [`architecture.md`](architecture.md), [`solution.md`](solution.md), and [`backend/backend.md`](backend/backend.md) before writing any code.**  
> These documents contain the full system architecture, mathematical specifications, modular folder layout, and implementation roadmap.

---

## 1. Developer Setup with `uv`

```bash
# Setup backend environment (Python 3.11+)
cd backend
uv sync
.venv\Scripts\Activate           # Windows PowerShell
# source .venv/bin/activate      # Linux / macOS

cp .env.example .env             # configure DATABASE_URL, SECRET_KEY, ALGORITHM

# Database migrations & seeding
uv run alembic upgrade head
uv run python -m app.scripts.seed --data-file "../test data.xlsx"

# Run development server
uv run fastapi dev app/main.py --port 8000
```

---

## 2. Testing & Verification

```bash
cd backend
# Run full test suite
uv run pytest -v

# Run acceptance test matrix (T01 through T10)
uv run pytest tests/test_acceptance_t01_t10.py -v

# Run module-specific tests
uv run pytest tests/modules/v1/cases/ -v
uv run pytest tests/modules/v1/suppliers/ -v

# Run test coverage
uv run pytest --cov=app tests/
```

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

---

## 7. Git & PR Workflow

- All work branches from `feature/v1.3-fastapi-postgres` (or `dev`).
- Branch naming convention: `feat/<module>-<description>` (e.g., `feat/cases-state-machine`).
- PR title format: `[<module>] Brief description` (e.g., `[cases] Implement 8-field verified closure validator`).
- Prior to pushing:
  ```bash
  uv run ruff check . --fix
  uv run ruff format .
  uv run pytest tests/ -v
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
