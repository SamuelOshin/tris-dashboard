# 📚 TRIS Project Documentation Hub
**Trust & Risk Intelligence System (TRIS) v1.3**

---

## 🌐 Live Deployments & Interactive Consoles

- **🚀 Web Application**: [`https://tris-sigma.vercel.app/`](https://tris-sigma.vercel.app/)
- **⚡ Backend API Engine**: [`https://tris-backend.fastapicloud.dev/`](https://tris-backend.fastapicloud.dev/)
- **📑 Interactive Swagger Docs**: [`https://tris-backend.fastapicloud.dev/docs`](https://tris-backend.fastapicloud.dev/docs)
- **📖 ReDoc API Reference**: [`https://tris-backend.fastapicloud.dev/redoc`](https://tris-backend.fastapicloud.dev/redoc)

---

## 📑 Complete Documentation Directory

1. **[Case Lifecycle & Governance Specification (`docs/CASE_LIFECYCLE_AND_GOVERNANCE_SPECIFICATION.md`)](./CASE_LIFECYCLE_AND_GOVERNANCE_SPECIFICATION.md)**
   - *State Machine Transitions, Reopened Pathways & SoD Roadmap*
   - Formal specification of the state machine, `Resume Investigation` vs. `Submit for Re-Verification` flows, 8-field verified closure dictionary, and v1.3 prototype vs. v1.4 production Segregation of Duties (SoD).

2. **[Architecture Decisions & Engineering Roadmap (`docs/ARCHITECTURE_DECISIONS_AND_ROADMAP.md`)](./ARCHITECTURE_DECISIONS_AND_ROADMAP.md)**
   - *Senior Principal Engineering Blueprint & Post-Review Decision Log (Rev 2.1)*
   - Formal ADRs (ADR-001 through ADR-010), pictorial database ERD, system topology, rule engine flowcharts, and milestone progress trackers.

3. **[Notification System Architecture (`docs/NOTIFICATION_SYSTEM_ARCHITECTURE.md`)](./NOTIFICATION_SYSTEM_ARCHITECTURE.md)**
   - *PostgreSQL-Backed Notification Hub & Event Alerts*
   - Multi-tier RBAC event routing (user, role, broadcast), automated domain event emitters from case transitions and ingestion jobs, popover UI, and unread badge counters.

4. **[Ingestion Engine Architecture & Resilience Plan (`docs/INGESTION_ARCHITECTURE_AND_RESILIENCE_PLAN.md`)](./INGESTION_ARCHITECTURE_AND_RESILIENCE_PLAN.md)**
   - *High-Volume, Fault-Isolated Ingestion Engine*
   - Asynchronous background jobs via `BackgroundTasks`, 20% circuit breaker policy, batch PK pre-fetching (eliminating N+1 queries), input sanitization, and transaction savepoints.

5. **[Engineering Handover & Changelog (`docs/HANDOVER_AND_CHANGELOG.md`)](./HANDOVER_AND_CHANGELOG.md)**
   - *Transition from Prototype to Enterprise Platform*
   - Complete technical handover, key architectural milestones, directory structure, and acceptance matrix.

6. **[Automated Test Execution Results (`docs/TEST_EXECUTION_RESULTS.md`)](./TEST_EXECUTION_RESULTS.md)**
   - *78/78 Automated Regression Tests Passing*
   - Granular breakdown of all 78 tests across access events, auth, cases, ingestion, notifications, rules, security remediations, suppliers, and transactions.

7. **[Synthetic Test Data & Test Matrix Reference (`docs/SYNTHETIC_TEST_DATA.md`)](./SYNTHETIC_TEST_DATA.md)**
   - *Complete Tabular Dataset Extracted from `test data.xlsx`*
   - Tabular reference for `Suppliers`, `Transactions`, `Access_Events`, `Approvals`, `Demo_Rules`, `Expected_Cases`, and `Case_Workflow_Sample` with mathematical baseline proofs.

8. **[TRIS v1.3 Scope of Work & Build Specification (`docs/v1_3_SCOPE_SPECIFICATION.md`)](./v1_3_SCOPE_SPECIFICATION.md)**
   - *Full Specification Extracted from `tris updated.pdf`*
   - Core objectives, architectural boundaries, data model entities, configurable rule catalog, verified closure requirements, and required deliverables.

9. **[Developer & Agent Guidelines (`AGENTS.md`)](../AGENTS.md)**
   - *Strict Architectural Boundaries & Engineering Conventions*
   - 4-layer module structure (`routes/` max 50 lines, `service/` raises domain exceptions, `models/` SQLModel tables only, `schemas/` Pydantic DTOs), response envelopes (`success_response()`, `error_response()`), and Argon2id password security.

10. **[System Architecture Specification (`architecture.md`)](../architecture.md)**
    - *Master System Architecture, Topology & Relational Models*
    - Vercel + FastAPI Cloud split-cloud architecture, API proxy routing, pictorial database ERD, rule engine strategy pattern, case state machine, and database immutability triggers.

11. **[Solution Design & Business-to-Value Mapping (`solution.md`)](../solution.md)**
    - *Problem Statement, Solution Pillars & Benchmark Verification*
    - Four core enterprise vulnerabilities, 4 solution pillars, complete step-by-step walkthrough of anomaly benchmark `TEST-CASE-001`, and the developer acceptance matrix (`T01` to `T10`).

12. **[Backend Architecture & Service Blueprint (`backend/backend.md`)](../backend/backend.md)**
    - *Module Layout, Service Contracts & REST API Catalog*
    - Directory structure, SQLAlchemy 2.0 async models vs. Pydantic v2 DTOs, service layer contracts (`IngestionService`, `BaselineService`, `RuleEngineService`, `CaseService`), database triggers, and API endpoints.

13. **[Milestone 1: Technical Assessment & Roadmap (`docs/MILESTONE_1_TECHNICAL_ASSESSMENT.md`)](./MILESTONE_1_TECHNICAL_ASSESSMENT.md)**
    - Answers to the 8 pre-development assessment questions, tech debt audit, and step-by-step implementation plan.
