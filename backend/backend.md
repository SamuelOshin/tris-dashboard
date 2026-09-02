# ⚙️ TRIS Backend Architecture & Implementation Guide

> **This is a guide** for the TRIS backend architecture, modular layout, service contracts, package management with `uv`, Argon2 password security, and testing workflows.

**Component**: Backend API & Risk Analytics Engine  
**System**: Trust & Risk Intelligence System (TRIS)  
**Version**: 1.3 (Synthetic-Data Driven Architecture)  
**Location**: `/backend`  
**Package Manager**: `uv`  
**ORM & Database**: SQLModel / SQLAlchemy 2.0 async + PostgreSQL 16  
**Password Hashing**: Argon2id (`argon2-cffi` / `passlib[argon2]`)  
**Status**: APPROVED GUIDE (Pending Phase 0 Execution Go-Ahead)  

---

## 1. Technology Stack & Framework Choices

The TRIS backend is built using a modern, high-performance Python 3.11+ stack structured around domain-driven modules:

- **Package & Environment Manager**: [uv](https://github.com/astral-sh/uv) (Extremely fast Python package installer and resolver written in Rust).
- **Web Framework**: [FastAPI](https://fastapi.tiangolo.com/) (`"fastapi[standard]" >= 0.115.0`) with ASGI server [Uvicorn](https://www.uvicorn.org/).
- **Data Validation & Serialization**: [Pydantic v2](https://docs.pydantic.dev/) (compiled in Rust for maximum throughput).
- **ORM & Database Abstraction**: [SQLModel](https://sqlmodel.tiangolo.com/) with SQLAlchemy 2.0 async core (`AsyncSession`, `create_async_engine`).
- **Database Driver**: `psycopg[binary]` / `asyncpg` for PostgreSQL 16.
- **Database Migrations**: [Alembic](https://alembic.sqlalchemy.org/) with async environment template.
- **Analytics & Spreadsheet Ingestion**: [Pandas](https://pandas.pydata.org/), [NumPy](https://numpy.org/), and [openpyxl](https://openpyxl.readthedocs.io/).
- **Authentication & Cryptography**:
  - JWT tokens via [PyJWT](https://pyjwt.readthedocs.io/).
  - Password hashing via **Argon2id** (`argon2-cffi` and `passlib[argon2]`).
  - *Why Argon2 instead of bcrypt?* Argon2 is the winner of the Password Hashing Competition (PHC). It provides configurable memory-hardness and time-cost parameters, effectively preventing GPU/ASIC hardware brute-force attacks and avoiding bcrypt's 72-byte password truncation limitation.
- **Testing**: [pytest](https://docs.pytest.org/), `pytest-asyncio`, and [HTTPX](https://www.python-httpx.org/) (`AsyncClient`).

---

## 2. Modular Directory Structure & Layout

The codebase follows the enterprise domain-module pattern established in `cre8us-ai-be`:

```
backend/
├── app/
│   ├── main.py                     # FastAPI app initialization, middleware & exception handler registration
│   ├── api/
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic BaseSettings (DB URL, JWT Secret, Environment)
│   │   │   ├── custom_exceptions/  # Centralized exception management
│   │   │   │   ├── exceptions.py   # CustomDomainException hierarchy (NotFound, ValidationError, etc.)
│   │   │   │   ├── handlers.py     # Global exception handlers → standardized JSON error_response
│   │   │   │   ├── register.py     # Registers all exception handlers onto the FastAPI application
│   │   │   │   └── error_status_code_mapper.py # Maps domain error codes to HTTP status codes
│   │   │   ├── dependencies/       # Shared FastAPI dependencies (get_current_user, pagination)
│   │   │   ├── middleware/         # Security headers, CORS, request rate limiting
│   │   │   ├── security.py         # Argon2id password hashing, JWT token creation & verification
│   │   │   └── schemas/            # Standardized success and error envelope schemas
│   │   ├── db/
│   │   │   ├── database.py         # Async engine, sessionmaker, get_db dependency
│   │   │   └── model_registry.py   # Imports all SQLModel classes to ensure table discovery
│   │   ├── utils/
│   │   │   └── response_payloads.py # success_response(), auth_response(), error_response()
│   │   └── modules/
│   │       └── v1/
│   │           ├── router.py       # Assembles all sub-routers under /api/v1 prefix
│   │           ├── auth/           # Authentication & Session Management
│   │           │   ├── routes/     # HTTP route handlers (max 50 lines, no business logic)
│   │           │   ├── service/    # Login, password verification, token issuance (raises exceptions)
│   │           │   ├── models/     # SQLModel user/persona tables
│   │           │   └── schemas/    # LoginRequest, TokenResponse, UserProfile schemas
│   │           ├── suppliers/      # Supplier Master & Baseline Engine
│   │           │   ├── routes/     # Supplier endpoints (list, detail, baseline calculation)
│   │           │   ├── service/    # BaselineService calculating stats with strict target exclusion
│   │           │   ├── models/     # SQLModel Supplier table
│   │           │   └── schemas/    # Supplier schemas, BaselineStatsResponse
│   │           ├── transactions/   # Financial Transaction Ledger
│   │           │   ├── routes/     # Transaction endpoints
│   │           │   ├── service/    # Transaction retrieval and filtering
│   │           │   ├── models/     # SQLModel Transaction table
│   │           │   └── schemas/    # TransactionCreate, TransactionResponse
│   │           ├── approvals/      # Internal Control Hierarchies
│   │           │   ├── routes/     # Approval endpoints
│   │           │   ├── service/    # Threshold checks, approval lookups
│   │           │   ├── models/     # SQLModel Approval table
│   │           │   └── schemas/    # Approval schemas
│   │           ├── access_events/  # Security & Identity Telemetry
│   │           │   ├── routes/     # Telemetry endpoints
│   │           │   ├── service/    # Off-hours access log queries
│   │           │   ├── models/     # SQLModel AccessEvent table
│   │           │   └── schemas/    # AccessEvent schemas
│   │           ├── rules/          # Deterministic Rule Engine (R-001 to R-006)
│   │           │   ├── routes/     # Rule listing, parameter configuration, evaluation trigger
│   │           │   ├── service/    # Strategy pattern evaluators, additive scoring, snapshots
│   │           │   ├── models/     # SQLModel RuleConfig table
│   │           │   └── schemas/    # RuleConfigUpdate, EvaluationSummary schemas
│   │           ├── cases/          # Risk Cases & Governed State Machine
│   │           │   ├── routes/     # Case endpoints (list, detail, assign, transition, close)
│   │           │   ├── service/    # State machine, 8-field verified closure guard, 90-day recurrence
│   │           │   ├── models/     # SQLModel RiskCase, CaseHistory tables
│   │           │   └── schemas/    # VerifiedClosureRequest, CaseHistoryResponse schemas
│   │           └── ingestion/      # Synthetic Data Loader
│   │               ├── routes/     # Upload & preview endpoints
│   │               ├── service/    # IngestionService parsing 8 sheets of test data.xlsx
│   │               └── schemas/    # IngestionReport schemas
│   └── scripts/
│       └── seed.py                 # CLI script populating database from test data.xlsx
├── alembic/                        # Database Migration Environment
│   ├── env.py                      # Async Alembic runner
│   └── versions/                   # Migration revision scripts
├── tests/                          # Automated Pytest Suite
│   ├── conftest.py                 # Test fixtures, mock DB, test clients
│   ├── modules/
│   │   ├── v1/
│   │   │   ├── test_auth.py
│   │   │   ├── test_suppliers.py
│   │   │   ├── test_cases.py
│   │   │   └── test_rules.py
│   └── test_acceptance_t01_t10.py  # Developer Acceptance Matrix (T01 through T10)
├── pyproject.toml                  # Python package configuration generated by uv
└── docker-compose.yml              # PostgreSQL 16 container definition
```

---

## 3. The 4-Layer Module Architecture Rules

Every module in `app/api/modules/v1/` strictly adheres to four isolated layers:

| Layer | Responsibility | Constraints |
| :--- | :--- | :--- |
| **`routes/`** | HTTP transport gateway only. Parse request parameters, headers, or body, call the appropriate service method, and return standardized JSON response. | **Max 50 lines per function.** Never contains business logic. Never contains `try-except` blocks. |
| **`service/`** | Pure business logic, analytics calculations, rule evaluations, and database operations. | **Never catches exceptions.** Raises `CustomDomainException` subclasses directly. Fully independent and unit-testable. |
| **`models/`** | Database schema definitions using SQLModel (`table=True`). | **No business logic.** Plain table, column, index, and relationship definitions only. |
| **`schemas/`** | Public API contracts and validation using Pydantic v2 (`BaseModel`). | Separate `*Create`, `*Update`, and `*Response` DTOs. |

### Global Exception Handling (`app/api/core/custom_exceptions/`)
Services never catch exceptions — they raise them, and the global handler converts them to standardized JSON responses:

```python
# In service:
if not supplier:
    raise NotFoundError(f"Supplier with ID {supplier_id} not found")

if missing_fields:
    raise VerifiedClosureValidationError(
        message=f"Verified closure failed: missing mandatory fields {missing_fields}",
        code="VERIFIED_CLOSURE_VALIDATION_ERROR"
    )
```

The global handler (`handlers.py`) catches `CustomDomainException` and automatically outputs:
```json
{
  "status": "ERROR",
  "status_code": 422,
  "message": "Verified closure failed: missing mandatory fields ['closure_evidence', 'verified_by']",
  "error_code": "VERIFIED_CLOSURE_VALIDATION_ERROR",
  "errors": {}
}
```

### Standard Response Envelopes (`app/api/utils/response_payloads.py`)
All routes return responses using `success_response()` or `auth_response()`:
```python
@router.post("/close", response_model=None)
async def close_case(
    case_id: str,
    payload: VerifiedClosureRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = await CaseService.close_case(
        case_id=case_id,
        closure_data=payload,
        actor=current_user.name,
        session=db
    )
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Case verified and closed successfully",
        data=case.model_dump()
    )
```

---

## 4. Security & Argon2 Password Hashing Guide

In `app/api/core/security.py`, password hashing is implemented using **Argon2id**:

```python
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
import jwt
from app.api.core.config import settings

# Argon2id password hashing context
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
    argon2__memory_cost=65536,  # 64 MB
    argon2__time_cost=3,        # 3 iterations
    argon2__parallelism=4       # 4 parallel threads
)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against an Argon2id hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hashes a password using Argon2id."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Creates a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```

---

## 5. Database Immutability Trigger

The `Case_History` table is guarded at the PostgreSQL engine level against `UPDATE` and `DELETE` operations:

```sql
CREATE OR REPLACE FUNCTION prevent_case_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Case_History rows are immutable: UPDATE and DELETE operations are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_history_immutable
    BEFORE UPDATE OR DELETE ON case_history
    FOR EACH ROW EXECUTE FUNCTION prevent_case_history_mutation();
```

---

## 6. Guide: Environment Setup & Execution with `uv`

> [!NOTE]
> **Execution Status**: The commands below are documented for execution during **Phase 0**. They will **not be executed** until explicit user sign-off is provided.

### Step 1: Initialize Backend Project with `uv`
```bash
# From workspace root:
uv init backend --bare
cd backend
```

### Step 2: Add Dependencies Using `uv add`
```bash
# Add FastAPI with standard bundle (includes Uvicorn, httptools, etc.):
uv add "fastapi[standard]"

# Add Database, ORM & Analytics libraries:
uv add "sqlmodel>=0.0.22" "sqlalchemy[asyncio]>=2.0" "psycopg[binary]" "pydantic>=2.0" alembic pandas numpy openpyxl

# Add Security & Argon2 Password Hashing:
uv add pyjwt "passlib[argon2]" argon2-cffi

# Add Development & Testing dependencies:
uv add --dev pytest pytest-asyncio httpx ruff

# Skills & Tooling runner:
uvx library-skills
```

### Step 3: Start Local PostgreSQL Database
```bash
docker compose up -d postgres
```

### Step 4: Run Migrations & Seed Data
```bash
uv run alembic upgrade head
uv run python -m app.scripts.seed --data-file "../test data.xlsx"
```

### Step 5: Start FastAPI Development Server
```bash
uv run fastapi dev app/main.py --port 8000
```
Interactive API docs available at `http://127.0.0.1:8000/docs`.

### Step 6: Execute Pytest Acceptance Suite
```bash
uv run pytest tests/ -v
```
All 10 developer acceptance tests (`T01` to `T10`) must pass with zero failures.
