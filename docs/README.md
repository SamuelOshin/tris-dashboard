# 📚 TRIS Project Documentation Hub
**Trust & Risk Intelligence System (TRIS) v1.4**, with the **v2.0 Material Cost Intelligence extension** on branch `v2.0-manufacturing-extension` (complete up to Ticket 13; not yet merged or tagged)

---

## 🌐 Live Deployments & Interactive Consoles

- **🚀 Web Application**: [`https://tris-sigma.vercel.app/`](https://tris-sigma.vercel.app/)
- **⚡ Backend API Engine**: [`https://tris-backend.fastapicloud.dev/`](https://tris-backend.fastapicloud.dev/)
- **📑 Interactive Swagger Docs**: [`https://tris-backend.fastapicloud.dev/docs`](https://tris-backend.fastapicloud.dev/docs)
- **📖 ReDoc API Reference**: [`https://tris-backend.fastapicloud.dev/redoc`](https://tris-backend.fastapicloud.dev/redoc)

---

## 🏭 v2.0 Material Cost Intelligence — start here

| Document | What it is |
|:---|:---|
| [`DEMO_GUIDE.md`](./DEMO_GUIDE.md) | How to run the demo from sign-in to validation |
| [`CASE_STUDY_01.md`](./CASE_STUDY_01.md) | One reproducible end-to-end case study (with a script that checks every figure) |
| [`ARCHITECTURE_MATERIAL_COST_INTELLIGENCE.md`](./ARCHITECTURE_MATERIAL_COST_INTELLIGENCE.md) | Modules, data flow, integrity rules, what is not built |
| [`UI_NAVIGATION_SPEC.md`](./UI_NAVIGATION_SPEC.md) | Screens, navigation, roles, key actions |
| [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md), [`ERP_MAPPING_GUIDE.md`](./ERP_MAPPING_GUIDE.md) | Canonical schema; importing files |
| [`MATERIAL_DETECTION_METHOD.md`](./MATERIAL_DETECTION_METHOD.md), [`MODEL_METHODOLOGY.md`](./MODEL_METHODOLOGY.md), [`FINANCIAL_EXPOSURE_METHOD.md`](./FINANCIAL_EXPOSURE_METHOD.md), [`RISK_SCORING_METHOD.md`](./RISK_SCORING_METHOD.md), [`MATERIAL_CASE_INTEGRATION.md`](./MATERIAL_CASE_INTEGRATION.md) | How each calculation works and its limits |
| [`VALIDATION_PROTOCOL.md`](./VALIDATION_PROTOCOL.md), [`VALIDATION_RESULTS.md`](./VALIDATION_RESULTS.md), [`TRANSFERABILITY_TEST.md`](./TRANSFERABILITY_TEST.md) | How it was checked, the real results (including failures), the second environment |
| [`BASELINE_README.md`](./BASELINE_README.md), [`HANDOVER_AND_CHANGELOG.md`](./HANDOVER_AND_CHANGELOG.md) | What existed before; dated changes, known issues, future work |

Evidence for every ticket (raw test output, screenshots, completion reports) is in `docs/evidence/ticket-N/`.

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
   - *127/127 Automated Regression Tests Passing (100%)*
   - Granular breakdown of all 127 tests across access events, auth, cases, ingestion, notifications, rules (including R-007), security remediations, suppliers, transactions, historical reconstruction, remediation replay, and user management.

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
