# 🛡️ Trust & Risk Intelligence System (TRIS)

**Enterprise Financial Fraud Detection, Supplier Risk Intelligence & Internal Control Auditing**

[![Frontend Live](https://img.shields.io/badge/Frontend-Live%20on%20Vercel-black?style=for-the-badge&logo=vercel)](https://tris-sigma.vercel.app/)
[![Backend API](https://img.shields.io/badge/Backend-FastAPI%20Cloud-009688?style=for-the-badge&logo=fastapi)](https://tris-backend.fastapicloud.dev/)
[![Swagger Docs](https://img.shields.io/badge/Swagger-API%20Interactive%20Docs-85EA2D?style=for-the-badge&logo=swagger)](https://tris-backend.fastapicloud.dev/docs)
[![Python Version](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python)](https://www.python.org/)
[![Database PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org)
[![Test Suite](https://img.shields.io/badge/Tests-78%2F78%20Passing%20(100%25)-brightgreen?style=for-the-badge)](https://github.com/)

---

## 🌐 Live Production & Evaluation Deployments

| Resource | URL | Description |
| :--- | :--- | :--- |
| **🚀 Web Application** | **[`https://tris-sigma.vercel.app/`](https://tris-sigma.vercel.app/)** | Next.js 16 App Router UI with real-time risk intelligence dashboards, baseline visualizer, dynamic case detail workspaces, and 8-field verified closure modal. |
| **⚡ Backend API Engine** | **[`https://tris-backend.fastapicloud.dev/`](https://tris-backend.fastapicloud.dev/)** | Asynchronous Python 3.12 FastAPI backend powered by SQLModel, Argon2id security, deterministic rule engine (R-001..R-006), and PostgreSQL immutability triggers. |
| **📑 Swagger Interactive Docs** | **[`https://tris-backend.fastapicloud.dev/docs`](https://tris-backend.fastapicloud.dev/docs)** | OpenAPI / Swagger interactive schema browser and live REST API test console. |
| **📖 ReDoc API Reference** | **[`https://tris-backend.fastapicloud.dev/redoc`](https://tris-backend.fastapicloud.dev/redoc)** | Clean, formal OpenAPI documentation reference. |

---

## 🔑 Demo Evaluation Personas & Credentials

The live deployment and local seed scripts provide four pre-configured evaluation accounts:

| Persona Role | User Name | Email Address | Password | Permissions & Operational Clearance |
| :--- | :--- | :--- | :--- | :--- |
| **Risk Reviewer** | `A. Reviewer` | `a.reviewer@tris.internal` | `Reviewer2026!` | Lead investigator; case assignment, deep forensic investigation, corrective actions, submit for verification. |
| **Compliance Verifier** | `B. Verifier` | `b.verifier@tris.internal` | `Verifier2026!` | Independent compliance auditor; 8-field verified closure evaluation, case sealing, rejection & rework routing. |
| **Compliance Officer** | `C. Officer` | `c.officer@tris.internal` | `Compliance2026!` | Cross-department compliance surveillance, audit exports, high-risk threshold override. |
| **System Admin** | `Super Admin` | `admin@tris.internal` | `Admin2026!` | Full administrative clearance, rule configuration & versioning, multi-sheet workbook ingestion, telemetry override. |

---

## 📖 Overview

The **Trust & Risk Intelligence System (TRIS)** is a specialized enterprise risk intelligence and financial fraud detection platform engineered for corporate finance teams, manufacturing supply chain managers, and internal audit leadership.

Traditional fraud monitoring systems rely either on brittle, disconnected spreadsheet filters or opaque "black-box" AI models that output unexplainable confidence percentages (e.g., *"96.8% risk score"*). TRIS replaces these with **Explainability by Construction**: every alert, score, and investigation case is strictly backed by deterministic mathematical deviations, cross-vector data correlation, and an append-only immutable audit trail.

### 🌟 Core Architectural Pillars

1. **Zero Fake Metrics (Mathematical Explainability)**: Eliminates fabricated AI confidence percentages. Anomalies are mathematically proven against supplier historical baselines that strictly exclude the evaluated target transaction (e.g. `SUP-001` historical mean = **$30,471.43** vs target anomaly `TX-1999` = **$104,000.00** $\implies$ **3.41x deviation**).
2. **Multi-Vector Telemetry Correlation**: Correlates four distinct enterprise domains in real time: Accounts Payable Invoices, Vendor Master Bank Modifications, Identity & Access Event Logs, and Hierarchical Approval Thresholds.
3. **Deterministic Strategy Rule Engine**: Modular, version-tracked rule catalog (`R-001` through `R-006`) with runtime threshold adjustments, additive scoring ($35 + 25 + 25 + 15 = 100 \implies \text{High Priority}$), and JSONB evaluation snapshots.
4. **Enforced Verified Closure Gatekeeper**: A governed state machine that strictly prohibits closing risk cases without 8 mandatory compliance fields (`root_cause`, `corrective_action`, `closure_type`, `closure_evidence`, `verified_by`, `closure_date`, `follow_up_requirement`, and `recurrence_monitoring`).
5. **Database-Level Immutability**: PostgreSQL engine triggers prevent `UPDATE` or `DELETE` operations on the `case_history` audit table, guaranteeing regulatory compliance and non-repudiation.
6. **Real-Time Notification Hub**: Multi-tier notification bus delivering user-specific, role-scoped, and broadcast alerts across case transitions and ingestion jobs.

---

## 🏛️ High-Level System Architecture

TRIS uses a decoupled split-cloud architecture: Next.js 16 App Router on Vercel delivers high-velocity UI with server-rendered React components, while the FastAPI Cloud backend executes statistical calculations, rule evaluation pipelines, and database operations. Next.js internal `rewrites` transparently proxy API traffic to eliminate browser CORS friction:

```mermaid
flowchart TB
    subgraph Client ["Client Layer"]
        Browser["User Browser<br/>(Chrome / Safari / Edge)"]
    end

    subgraph Vercel ["Frontend Layer — Vercel (Next.js 16 App Router)"]
        NextServer["Next.js 16 Server Engine"]
        RSC["React Server Components<br/>(SSR, Geist Font, Vercel Analytics)"]
        ClientUI["Interactive Dashboards<br/>(shadcn/ui, Tailwind CSS v4, Recharts, Lucide)"]
        DynRoutes["Dynamic Server Routes<br/>/cases/[id], /suppliers/[id]"]
        Middleware["Edge Middleware<br/>(Auth Guard & Session Cookie Check)"]
        Proxy["Next.js Rewrites API Proxy<br/>/api/:path* → FastAPI Cloud Origin"]
        
        NextServer --> Middleware
        Middleware --> RSC
        RSC --> ClientUI
        RSC --> DynRoutes
        NextServer --> Proxy
    end

    subgraph BackendHost ["Backend Layer — FastAPI Cloud (Python 3.12+)"]
        API["FastAPI App (v0.115+)<br/>Uvicorn ASGI Engine"]
        
        subgraph Endpoints ["REST API Endpoints (/api/v1/*)"]
            AuthEP["/auth/login & /auth/me"]
            SuppliersEP["/suppliers/* (Baseline Stats)"]
            TxEP["/transactions/*"]
            ApprovalsEP["/approvals/*"]
            AccessEP["/access-events/* (Zero-Trust Telemetry)"]
            CasesEP["/cases/* (State Machine & 8-Field Closure)"]
            RulesEP["/rules/* (Strategy Catalog & Versioning)"]
            IngestEP["/ingestion/* (Excel Parser & Async Jobs)"]
            NotifEP["/notifications/* (Notification Hub)"]
        end
        
        subgraph CoreEngines ["Core Domain Logic Engines"]
            BaselineEng["Baseline Calculation Engine<br/>(Strict Target Exclusion)"]
            RuleEng["Strategy Rule Engine (R-001..R-006)<br/>(Rule Versioning & Snapshots)"]
            ConsolidationEng["Case Consolidation Engine<br/>(Multi-Signal Grouping & Score 100)"]
            StateMachineEng["State Machine & 8-Field Closure Guard"]
            AuditEng["Immutable Audit History Logger"]
            NotifHub["PostgreSQL Notification Bus"]
        end
        
        API --> Endpoints
        Endpoints --> CoreEngines
    end

    subgraph DatabaseHost ["Database Layer — PostgreSQL 16 (Relational & ACID)"]
        PG[("PostgreSQL 16 Database")]
        
        subgraph RelationalSchema ["Relational Tables & Constraints"]
            T_Suppliers["suppliers"]
            T_Transactions["transactions (FK: supplier_id)"]
            T_Approvals["approvals (FK: transaction_id)"]
            T_AccessEvents["access_events"]
            T_RiskCases["risk_cases (FK: supplier_id, transaction_id)"]
            T_CaseHistory["case_history (FK: case_id)"]
            T_RuleConfig["rule_config"]
            T_Notifications["notifications (FK: user_id)"]
            T_IngestionJobs["ingestion_jobs"]
        end
        
        subgraph Enforcement ["Database-Level Enforcement"]
            FK_Const["Foreign Key Cascading & Constraints"]
            Trigger["PostgreSQL Immutability Trigger<br/>(BEFORE UPDATE OR DELETE ON case_history)"]
            JSONB_Snap["JSONB Rule Evaluation Snapshot Storage"]
        end
        
        PG --- RelationalSchema
        PG --- Enforcement
    end

    Browser <-->|HTTPS / HTML & React Bundles| NextServer
    Browser <-->|Fetch /api/* - Cookies Included| Proxy
    Proxy <-->|Internal TLS API Proxy| API
    CoreEngines <-->|SQLAlchemy 2.0 Async - asyncpg / psycopg| PG
```

---

## 📑 Core Documentation Index

| Document | Purpose & Key Contents |
| :--- | :--- |
| **[`docs/CASE_LIFECYCLE_AND_GOVERNANCE_SPECIFICATION.md`](./docs/CASE_LIFECYCLE_AND_GOVERNANCE_SPECIFICATION.md)** | **Case Lifecycle & Governance Specification**: State machine transitions, Reopened workflows (`Resume Investigation` vs. `Submit for Re-Verification`), 8-field verified closure dictionary, and Segregation of Duties (SoD) roadmap. |
| **[`docs/ARCHITECTURE_DECISIONS_AND_ROADMAP.md`](./docs/ARCHITECTURE_DECISIONS_AND_ROADMAP.md)** | **Architecture Decision Records (ADRs) & Engineering Roadmap**: 10 formal ADRs (ADR-001 through ADR-010), pictorial database ERD, system topologies, and phased engineering milestone trackers. |
| **[`docs/NOTIFICATION_SYSTEM_ARCHITECTURE.md`](./docs/NOTIFICATION_SYSTEM_ARCHITECTURE.md)** | **Notification System Architecture**: Multi-tier RBAC event routing, automated domain event emitters, popover UI, and unread badge counters. |
| **[`docs/INGESTION_ARCHITECTURE_AND_RESILIENCE_PLAN.md`](./docs/INGESTION_ARCHITECTURE_AND_RESILIENCE_PLAN.md)** | **Ingestion Engine Architecture & Resilience**: Asynchronous background jobs, 20% circuit breaker policy, batch PK pre-fetching, input sanitization, and transaction savepoints. |
| **[`docs/HANDOVER_AND_CHANGELOG.md`](./docs/HANDOVER_AND_CHANGELOG.md)** | **Engineering Handover & Changelog**: Implementation history, architectural milestones, directory structure, and acceptance matrix. |
| **[`docs/SYNTHETIC_TEST_DATA.md`](./docs/SYNTHETIC_TEST_DATA.md)** | **Synthetic Test Data Reference**: Complete tabular tables extracted from `test data.xlsx` across all 8 sheets with mathematical baseline proofs. |
| **[`docs/TEST_EXECUTION_RESULTS.md`](./docs/TEST_EXECUTION_RESULTS.md)** | **Test Execution Results**: Detailed breakdown of the 78 automated test cases, execution timings, and coverage. |
| **[`docs/v1_3_SCOPE_SPECIFICATION.md`](./docs/v1_3_SCOPE_SPECIFICATION.md)** | **TRIS v1.3 Scope Specification**: Requirements, boundaries, minimum screens, and acceptance criteria extracted from `tris updated.pdf`. |
| **[`AGENTS.md`](./AGENTS.md)** | **Developer & Agent Guidelines**: 4-layer module boundaries (routes max 50 lines, services raise domain exceptions, models SQLModel only, schemas Pydantic), standard response envelopes, and Argon2id password security. |
| **[`architecture.md`](./architecture.md)** | **System Architecture Specification**: Architectural principles, pictorial ERD, networking proxy flow, rule engine design, and database immutability. |
| **[`solution.md`](./solution.md)** | **Solution Design & Problem-to-Value Mapping**: Problem statement, the 4 architectural pillars, walkthrough of `TEST-CASE-001`, and developer acceptance matrix (`T01`-`T10`). |
| **[`backend/backend.md`](./backend/backend.md)** | **Backend Service Contracts & API Guide**: Directory layout (`modules/v1/`), service contracts, custom domain exceptions, response utilities, and REST API catalog. |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js**: `20.x` or `22.x` (or `pnpm` / `npm`)
- **Python**: `3.12+`
- **Package Manager**: [`uv`](https://github.com/astral-sh/uv)
- **Database Engine**: Docker & Docker Compose (for PostgreSQL 16)

---

### 1. Database Setup (PostgreSQL 16)

```bash
docker compose up -d postgres
```

---

### 2. Backend Setup (FastAPI + SQLModel)

```bash
cd backend

# 1. Sync dependencies with uv
uv sync

# 2. Activate virtual environment
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux / macOS:
# source .venv/bin/activate

# 3. Apply database migrations & seed reference data
uv run alembic upgrade head
uv run python -m app.scripts.seed --data-file "../test data.xlsx"

# 4. Start backend API development server
uv run fastapi dev app/main.py --port 8000
```

- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
- **ReDoc API Explorer**: `http://127.0.0.1:8000/redoc`

---

### 3. Frontend Setup (Next.js 16 App Router)

```bash
cd frontend

# 1. Install dependencies
pnpm install
# (or npm install)

# 2. Start frontend development server
pnpm run dev
# (or npm run dev)
```

- **Web Application**: `http://localhost:3000`

---

## 🧪 Automated Testing & Verification

TRIS maintains a comprehensive 78-test automated regression suite covering domain services, mathematical baselines, security boundaries, and the T01–T10 developer acceptance matrix:

```bash
cd backend

# Run the 10-point Developer Acceptance Matrix (T01 through T10)
uv run pytest tests/test_acceptance_t01_t10.py -v

# Run the full test suite (78 tests, 100% pass rate)
uv run pytest tests/ -v

# Run Ruff linter and code formatter
uv run ruff check . --fix
uv run ruff format .
```

### Developer Acceptance Criteria Matrix (T01–T10)

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

## 🔒 Security & Compliance Posture

- **Password Hashing**: **Argon2id** (memory-hard, GPU-resistant algorithm).
- **Session Delivery**: Secure **HttpOnly, SameSite=Lax** cookies.
- **Audit Immutability**: PostgreSQL database triggers block `UPDATE` and `DELETE` on the `case_history` ledger.
- **Segregation of Duties**: 8-field verification validation required prior to case closure.
- **Input Sanitization**: Multi-sheet workbook ingestion validates cell data types, foreign key referential integrity, and isolates bad rows via transaction savepoints.