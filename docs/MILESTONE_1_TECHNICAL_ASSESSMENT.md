# TRIS v1.3: Milestone 1 - Technical Assessment & Architecture Plan
**Trust & Risk Intelligence System (TRIS)**
*Developer Technical Assessment | Milestone 1 (Pre-Development)*

---

## 1. Technical Assessment Answers

### Q1: What framework and language does the current TRIS web application use?
- **Framework**: Next.js 16.0.3 (App Router) with React 19.2.0.
- **Language**: TypeScript (v5.x).
- **Styling**: Tailwind CSS v4.1.9 with OKLCH theme tokens and shadcn/ui (Radix UI primitives).
- **Data Visualization**: Recharts for scatter plots, stacked area charts, line charts, and bar matrices.

### Q2: Where is the source code stored and how is it versioned?
- **Source Code**: Local workspace at c:\Users\dell\Documents\tris-app, mapped to GitHub repository SamuelOshin/tris-dashboard.
- **Version Strategy**: The existing v1.2 demonstration prototype must be preserved with a Git tag 1.2-baseline. A new branch eature/v1.3-data-driven will be used for v1.3 development.

### Q3: How is the current application deployed to Vercel?
- Connected via Git repository integration to Vercel with @vercel/analytics enabled.
- Branch preview deployments provide a dedicated staging URL for v1.3 review prior to production promotion.

### Q4: Is there already a backend, API layer, authentication, or database?
- **Backend/API Layer**: None currently. No Next.js server route handlers (pp/api/*) exist.
- **Database**: None. All data is currently hardcoded mock data inside React component state.
- **Authentication**: Simulated client-side session persisted in localStorage under 	ris_user with 5 demo personas (CFO, Procurement, Compliance, Security, Admin).
- **v1.3 Action**: Implement a lightweight relational database schema (SQLite via Prisma or PostgreSQL) and server route handlers.

### Q5: Which existing screens/components can be reused for v1.3?
- components/dashboard-layout.tsx: Collapsible sidebar, header search, notification tray, and user profile avatar.
- components/fraud-detection/anomaly-chart.tsx: Scatter plot for transaction anomaly distribution.
- components/fraud-detection/suspicious-transactions.tsx: Table layout for exceptions and suspicious ledgers.
- components/suppliers/supplier-table.tsx: Directory ledger for vendor baseline stats.
- components/compliance/audit-trail.tsx: Immutable case history timeline and log drawer.

### Q6: What technical debt or security issues should be addressed?
- 
ext.config.mjs has 	ypescript.ignoreBuildErrors: true and slint.ignoreDuringBuilds: true. Types and lint checks should be addressed.
- Remove all unvalidated AI confidence or accuracy claims to comply with Section 4(E) of the specification.
- Replace client-side mock storage with database persistence so that assignments, status changes, and case closures persist across browser reloads.

### Q7: What backend/database architecture do you recommend for v1.3 and why?
- **Recommendation**: SQLite via Prisma ORM for local and staging zero-configuration portability, or PostgreSQL / Supabase for hosted staging.
- **Why**: Fully relational structure supports foreign-key constraints across Suppliers -> Transactions -> Approvals -> Access Events -> Risk Cases -> Case History. Prisma provides typed queries, automatic migrations, and effortless seeding from 	est data.xlsx.

### Q8: What is the proposed milestone plan, estimate, and implementation sequence?
1. **Preservation**: Tag 1.2-baseline and branch eature/v1.3-data-driven.
2. **Database & Ingestion**: Define Prisma schema and seed script importing all 8 sheets from 	est data.xlsx.
3. **Baseline Analysis**: Implement server-side calculation of supplier historical averages/medians (excluding evaluated transactions).
4. **Rule Engine**: Implement configurable demonstration rules R-001 through R-006 generating plain-language explanations.
5. **Case Management & Verified Closure**: Implement workflow state machine (New -> Closed) and enforce 8-field verification before closure.
6. **Recurrence & Audit Log**: Implement 90-day recurrence detection and immutable case history.
7. **Acceptance Testing**: Execute and document all 10 developer tests (T01 to T10).

---

## 2. Acceptance Matrix Alignment (Developer_Tests)

| Test ID | Test Name | Target Entity / Rule | Acceptance Requirement |
| :--- | :--- | :--- | :--- |
| **T01** | Data Import | All 4 entity tables | Ingest synthetic data with schema validation |
| **T02** | Baseline Calculation | SUP-001 | Calculate historical stats strictly excluding TX-1999 |
| **T03** | Primary Exception | TX-1999 | Trigger R-001, R-002, R-003, R-004 in one High case |
| **T04** | Explainability | TEST-CASE-001 | Plain-language reasons; zero unsupported AI metrics |
| **T05** | Ownership Persistence | TEST-CASE-001 | Assigned owner/department/status persists across reload |
| **T06** | Verified Closure | TEST-CASE-001 | Block closure until root cause, evidence, and verifier are provided |
| **T07** | Recurrence Detection | SUP-001 | Surface prior case and corrective actions within 90 days |
| **T08** | Duplicate Invoice | TX-4002 | Trigger R-005 pointing to TX-4001 |
| **T09** | Normal Control | SUP-002 | Normal transactions generate no material cases |
| **T10** | Immutable Audit Trail | Case History | Timestamped logs of all edits and transitions |
