# 📚 TRIS Project Documentation Hub
**Trust & Risk Intelligence System (TRIS) v1.3**

---

## 📑 Core Documentation Index

1. **[Developer & Agent Guidelines (`AGENTS.md`)](../AGENTS.md)**
   - *Strict Architectural Boundaries & Engineering Conventions*
   - Defines the 4-layer module structure (`routes/` max 50 lines, `service/` raises domain exceptions, `models/` SQLModel tables only, `schemas/` Pydantic DTOs), standard response payloads (`success_response()`, `error_response()`), Argon2id password security, and developer commands with `uv`.

2. **[System Architecture Specification (`architecture.md`)](../architecture.md)**
   - *Master System Architecture, Topology & Relational Models*
   - Vercel + FastAPI Cloud split-cloud architecture, API proxy routing, pictorial database ERD with all 7 entities, rule engine strategy pattern, case state machine, database immutability triggers, and ADR summaries.

2. **[Solution Design & Business-to-Value Mapping (`solution.md`)](../solution.md)**
   - *Problem Statement, Solution Pillars & Benchmark Verification*
   - Explains the four core enterprise vulnerabilities, the 4 solution pillars, complete step-by-step walkthrough of anomaly benchmark `TEST-CASE-001`, and the developer acceptance matrix (`T01` to `T10`).

3. **[Backend Architecture & Service Blueprint (`backend/backend.md`)](../backend/backend.md)**
   - *Module Layout, Service Contracts & REST API Catalog*
   - Directory structure, SQLAlchemy 2.0 async models vs. Pydantic v2 DTOs, service layer contracts (`IngestionService`, `BaselineService`, `RuleEngineService`, `CaseService`), database triggers, and API endpoints.

4. **[Architecture Decision Records (ADRs) & Engineering Roadmap](./ARCHITECTURE_DECISIONS_AND_ROADMAP.md)**
   - *Senior Principal Engineering Blueprint & Post-Review Decision Log (Rev 2.1)*
   - Detailed ADR-001 through ADR-008, tradeoffs, risk analysis, review logs, and visual diagrams.

5. **[TRIS v1.3 Scope of Work & Build Specification](./v1_3_SCOPE_SPECIFICATION.md)**
   - *Full specification extracted from `tris updated.pdf`*
   - Core objectives, architectural boundaries, data model entities, configurable rule catalog, verified closure requirements, and required deliverables.

6. **[Synthetic Test Data & Test Matrix Reference](./SYNTHETIC_TEST_DATA.md)**
   - *Complete tabular dataset extracted from `test data.xlsx`*
   - Worksheets: `Suppliers`, `Transactions`, `Access_Events`, `Approvals`, `Demo_Rules`, `Expected_Cases`, `Case_Workflow_Sample`, `Developer_Tests`, `Data_Dictionary`.

7. **[Milestone 1: Technical Assessment & Roadmap](./MILESTONE_1_TECHNICAL_ASSESSMENT.md)**
   - Answers to the 8 pre-development assessment questions, tech debt audit, and step-by-step v1.3 implementation plan.

8. **[Ingestion Engine — Architecture, Resilience & Scale Plan](./INGESTION_ARCHITECTURE_AND_RESILIENCE_PLAN.md)**
   - *Senior Architect Blueprint for High-Volume, Fault-Isolated Ingestion*
   - Specifications for asynchronous processing via `BackgroundTasks`, 20% circuit breaker policy, batch PK pre-fetching (eliminating N+1 queries), input sanitization, referential integrity guards, and v1.4 migration path to Redis/`arq`.
