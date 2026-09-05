# 🛡️ Trust & Risk Intelligence System (TRIS)

**Enterprise Financial Fraud Detection, Supplier Risk Intelligence & Internal Control Auditing**

[![Deployed on Vercel](https://img.shields.io/badge/Frontend-Vercel%20(Next.js%2016)-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Backend FastAPI Cloud](https://img.shields.io/badge/Backend-FastAPI%20Cloud%20(Python%203.11+)-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Database PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org)

---

## 📖 Overview

The **Trust & Risk Intelligence System (TRIS)** is a specialized risk intelligence platform engineered for enterprise supply chain operations, manufacturing procurement, and corporate finance audit teams. 

Traditional fraud monitoring systems rely either on brittle, disconnected filters or opaque "black-box" AI models that output unexplainable percentages (e.g., *"96.8% accuracy"*). TRIS replaces these with **Explainability by Construction**: every alert, score, and investigation case is strictly backed by deterministic mathematical deviations, cross-vector data correlation, and an immutable audit trail.

### 🌟 Core Architectural Pillars

1. **Zero Fake Metrics (Mathematical Explainability)**: Eliminates fabricated AI confidence percentages. Anomalies are mathematically proven against supplier historical baselines that strictly exclude the evaluated transaction.
2. **Multi-Vector Telemetry Correlation**: Correlates four distinct enterprise domains in real time: Accounts Payable Invoices, Vendor Master Bank Modifications, Identity & Access Event Logs, and Hierarchical Approval Thresholds.
3. **Configurable Strategy Rule Engine**: Modular, version-tracked rule catalog (`R-001` through `R-006`) with runtime threshold adjustments and JSONB evaluation snapshots.
4. **Enforced Verified Closure Gatekeeper**: A state machine that strictly prohibits closing risk cases without 8 mandatory compliance fields (root cause, corrective action, closure type, evidence ID, named verifier, closure date, follow-up requirement, and 90-day recurrence monitoring).
5. **Database-Level Immutability**: PostgreSQL engine triggers prevent `UPDATE` or `DELETE` operations on the audit history table, guaranteeing compliance integrity.

---

## 🏛️ High-Level System Architecture

TRIS uses a modern, decoupled split-cloud architecture: the Next.js 16 App Router on Vercel delivers high-velocity UI and dynamic server rendering, while the FastAPI Cloud backend executes statistical calculations, rule evaluation pipelines, and database operations. Next.js internal `rewrites` transparently proxy API traffic to eliminate browser CORS friction:

```mermaid
flowchart TB
    subgraph Client ["Client Layer"]
        Browser["User Browser<br/>(Chrome / Safari / Edge)"]
    end

    subgraph Vercel ["Frontend Layer — Vercel (Node.js 16 Runtime)"]
        NextServer["Next.js 16 App Router Server"]
        RSC["React Server Components<br/>(SSR, Geist Font, Vercel Analytics)"]
        ClientUI["Interactive Dashboards<br/>(shadcn/ui, Tailwind CSS v4, Recharts)"]
        DynRoutes["Dynamic Server Routes<br/>/cases/[id], /suppliers/[id]"]
        Middleware["Edge Middleware<br/>(Auth Guard & HttpOnly Cookie Check)"]
        Proxy["Next.js Rewrites API Proxy<br/>/api/:path* → FastAPI Cloud Origin"]
        
        NextServer --> Middleware
        Middleware --> RSC
        RSC --> ClientUI
        RSC --> DynRoutes
        NextServer --> Proxy
    end

    subgraph BackendHost ["Backend Layer — FastAPI Cloud (Python 3.11+)"]
        API["FastAPI App (v0.115+)<br/>Uvicorn ASGI Engine"]
        
        subgraph Endpoints ["REST API Endpoints (/api/v1/*)"]
            AuthEP["/auth/login & /auth/me"]
            SuppliersEP["/suppliers/* (Baseline Stats)"]
            TxEP["/transactions/*"]
            CasesEP["/cases/* (State Machine & Closure)"]
            RulesEP["/rules/* (Config & Versioning)"]
            IngestEP["/ingest/* (Excel / CSV Parser)"]
        end
        
        subgraph CoreEngines ["Core Domain Logic Engines"]
            BaselineEng["Baseline Calculation Engine<br/>(Strict Target Exclusion)"]
            RuleEng["Strategy Rule Engine (R-001..R-006)<br/>(Rule Versioning & Snapshots)"]
            ConsolidationEng["Case Consolidation Engine<br/>(Multi-Signal Grouping)"]
            StateMachineEng["State Machine & 8-Field Guard"]
            AuditEng["Immutable Audit History Logger"]
        end
        
        API --> Endpoints
        Endpoints --> CoreEngines
    end

    subgraph DatabaseHost ["Database Layer — PostgreSQL 16 (Relational & ACID)"]
        PG[("PostgreSQL 16 Database")]
        
        subgraph RelationalSchema ["Relational Tables & Constraints"]
            T_Suppliers["Suppliers Table"]
            T_Transactions["Transactions Table (FK)"]
            T_Approvals["Approvals Table (FK)"]
            T_AccessEvents["Access_Events Table"]
            T_RiskCases["Risk_Cases Table (FKs)"]
            T_CaseHistory["Case_History Table (FK)"]
            T_RuleConfig["Rule_Config Table"]
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

| Document | Purpose & Contents |
| :--- | :--- |
| **[`AGENTS.md`](./AGENTS.md)** | **Developer & Agent Guidelines**: Strict 4-layer module boundaries (routes max 50 lines, services raise domain exceptions, models SQLModel only, schemas Pydantic), standard response payloads, Argon2 security, and developer workflows. |
| **[`architecture.md`](./architecture.md)** | **System Architecture Specification**: Deployment topology, pictorial database ERD, networking proxy flow, rule engine design, state machine transitions, and ADR summaries. |
| **[`solution.md`](./solution.md)** | **Solution Design & Problem-to-Value Mapping**: Problem statement, the 4 architectural pillars, complete walkthrough of `TEST-CASE-001`, and developer acceptance matrix (`T01`-`T10`). |
| **[`backend/backend.md`](./backend/backend.md)** | **Backend Architecture & Implementation Guide**: Technology stack, modular directory layout (`modules/v1/`), service contracts, custom exceptions, response utilities, and REST API catalog. |
| **[`docs/v1_3_SCOPE_SPECIFICATION.md`](./docs/v1_3_SCOPE_SPECIFICATION.md)** | **TRIS v1.3 Build Specification**: Full requirements, architectural boundaries, minimum screens, and acceptance criteria extracted from `tris updated.pdf`. |
| **[`docs/SYNTHETIC_TEST_DATA.md`](./docs/SYNTHETIC_TEST_DATA.md)** | **Synthetic Test Data Reference**: Complete tabular tables extracted from `test data.xlsx` across all 8 sheets with mathematical baseline proofs. |
| **[`docs/ARCHITECTURE_DECISIONS_AND_ROADMAP.md`](./docs/ARCHITECTURE_DECISIONS_AND_ROADMAP.md)** | **Architecture Decision Records (ADRs) & Engineering Roadmap**: Formal ADRs (ADR-001 through ADR-008) with Senior Principal Engineer review log and granular phase trackers. |
| **[`docs/MILESTONE_1_TECHNICAL_ASSESSMENT.md`](./docs/MILESTONE_1_TECHNICAL_ASSESSMENT.md)** | **Milestone 1 Technical Assessment**: In-depth answers to pre-development questions, code audit findings, and verification alignment. |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js `20.x` or `22.x`
- Python `3.11` or `3.12`
- [`uv`](https://github.com/astral-sh/uv)
- Docker & Docker Compose (for PostgreSQL 16)

### 1. Database Setup
```bash
docker compose up -d postgres
```

### 2. Backend Setup
```bash
cd backend
uv sync
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux / macOS: source .venv/bin/activate
uv run alembic upgrade head
uv run python -m app.scripts.seed --data-file "../test data.xlsx"
uv run fastapi dev app/main.py --port 8000
```
Interactive API documentation: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
```bash
# In project root:
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.