# TRIS v1.3 — Engineering Handover & Changelog

> **TRIS (Total Risk Intelligence System) — Version 1.3 Implementation Handover**  
> Complete transition from client-side prototype to an enterprise-grade FastAPI + PostgreSQL risk platform.

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
7. **Unified Developer Acceptance Matrix & Full Suite**: Automated test suite achieving **78/78 overall backend tests passing (100% pass rate)**.

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
│   ├── tests/                      # Automated test suite (78 tests)
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
