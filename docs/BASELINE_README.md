# TRIS v1.4 Baseline — What Exists Before the v2.0 Extension

**Captured**: 2026-09-30  
**Git tag**: `v1.4-baseline` (commit `72460432ef8fee8e6bce81bf5ad7ee416436c267`)  
**Branch for all v2.0 work**: `v2.0-manufacturing-extension` (created from this tag)

This document records exactly what the TRIS platform consists of at the point before any v2.0 manufacturing-domain code is written. Its purpose is to serve as the unambiguous "before" reference for the entire v2.0 backlog.

---

## 1. Platform Identity

**TRIS** — Transaction Risk Intelligence System (v1.4)

A governed, explainable risk-case management platform for accounts-payable fraud and financial exception detection. Built as a split-cloud architecture:

| Layer | Technology | Deployment |
|:------|:-----------|:-----------|
| Frontend | Next.js 16.3.4 (App Router, Turbopack) | Vercel |
| Backend | FastAPI (Python 3.12+) | FastAPI Cloud |
| Database | PostgreSQL 16 | Managed (port 5433 locally via Docker) |

---

## 2. Existing Modules

All modules reside under `backend/app/api/modules/v1/` and adhere strictly to the 4-layer architecture (`routes/` → `service/` → `models/` → `schemas/`).

| Module | Responsibility |
|:-------|:--------------|
| `auth` | JWT issue/refresh, Argon2id password hashing, session cookies, rate-limiting |
| `users` | User management, role provisioning, account lock/unlock, security audit logs |
| `cases` | Governed risk-case lifecycle state machine, 8-field verified closure, assignment, SoD |
| `rules` | Deterministic strategy rule engine (R-001–R-007), JSONB scoring snapshots, `RuleConfig` versioning |
| `suppliers` | Vendor master data, statistical baseline calculation (strict target exclusion) |
| `transactions` | Accounts-payable invoice transactions, event timestamps |
| `approvals` | Financial approval records linked to transactions (R-003, R-007) |
| `access_events` | Identity & access telemetry events, off-hours detection (R-004) |
| `ingestion` | Multi-sheet Excel workbook parsing, batch ingestion, 20% error circuit-breaker |
| `reconstruction` | Bi-temporal point-in-time historical reconstruction (no hindsight leakage) |
| `remediation` | Remediation replay sandbox; simulates proposed controls against historical state |
| `notifications` | RBAC notification hub, event broadcasting |

---

## 3. Frontend Routes (v1.4 Baseline)

14 routes generated at build time (exit code 0, captured 2026-09-30):

| Route | Type | Purpose |
|:------|:-----|:--------|
| `/` | Static | Root redirect |
| `/_not-found` | Static | 404 handler |
| `/login` | Static | Authentication page |
| `/risk-cases` | Static | Risk case list & overview |
| `/cases/[id]` | Dynamic | Case detail, lifecycle, closure |
| `/suppliers` | Static | Supplier management |
| `/ingestion` | Static | Workbook upload & ingestion |
| `/fraud-detection` | Static | Detection rules dashboard |
| `/compliance` | Static | Compliance & reporting |
| `/dashboard/correlation` | Static | Correlation analysis |
| `/dashboard/reports` | Static | Reports |
| `/dashboard/settings` | Static | Settings & governance |
| `/zero-trust` | Static | Access event monitoring |
| `/developer-tests` | Static | Developer test harness |

**Two deprecation warnings noted (not errors, not new)**:
- `middleware` file convention deprecated → `proxy` (cosmetic, no functional impact)
- TypeScript 5.0.2 detected, minimum recommended is 5.1.0 (cosmetic)

---

## 4. Detection Rules Catalogue (R-001–R-007)

| Code | Name | Condition | Default Weight |
|:-----|:-----|:----------|---------------:|
| R-001 | Amount Deviation | Amount > 2.0× supplier historical baseline | 35 |
| R-002 | Recent Bank Change | Supplier bank details changed within 7 days | 25 |
| R-003 | Missing Required Approval | `approval_required` but status ≠ Approved (Level 3 ≥ $50,000) | 25 |
| R-004 | Off-Hours Access Telemetry | Supplier access outside 06:00–20:00 UTC | 15 |
| R-005 | Duplicate Invoice | Same `supplier_id` + `invoice_number` on another transaction | 30 |
| R-006 | Recurrence Detection | Prior closed case for same supplier within 90 days | 20 |
| R-007 | Approval Timing / Temporal Completeness | No qualifying approval effective at or before event timestamp | — |

Risk score thresholds: **High** ≥ 70 · **Medium** 30–69 · **Low** < 30

---

## 5. RBAC — Four Core Roles

| Role (internal value) | Display Name | Key Capabilities |
|:----------------------|:-------------|:-----------------|
| `admin` | System Administrator | Full access, user management, rule configuration, all write ops |
| `reviewer` | Risk Reviewer | Investigate cases, document findings, propose remediation; cannot close cases |
| `verifier` | Compliance Verifier | Independent 8-field closure verification; cannot verify cases they investigated |
| `process_owner` | Process Owner | Inspect reconstructions, execute remediation replays |

Four deprecated legacy roles preserved for backward compat only: `compliance`, `cfo`, `security`, `procurement`.

**Separation of Duties invariants**:
- Only `verifier` and `admin` may transition a case to `Closed`
- A user who participated in investigation cannot verify or close that case (matched case-insensitively across `user_id`, `username`, `name`, `email`)

---

## 6. Governance Invariants (Non-Negotiable)

- **8-field verified closure gate**: `root_cause`, `corrective_action`, `closure_type`, `closure_evidence`, `verified_by`, `closure_date`, `follow_up_requirement`, `recurrence_monitoring` — all mandatory before `Closed` transition
- **Bi-temporal reconstruction**: only facts with `recorded_at <= event_timestamp` inform a determination; `UNKNOWN` is a first-class outcome and never defaults to `PASS`
- **Immutable audit trail**: PostgreSQL trigger `case_history_immutable` blocks `UPDATE` and `DELETE` on `case_history` at the database level
- **No hardcoded identities in production governance code**: services derive event times from record data; no branching on synthetic IDs
- **Argon2id** for all password hashing — bcrypt is never used

---

## 7. Test Suite (v1.4)

Full test suite lives under `backend/tests/`. Requires PostgreSQL (`tris_db_test` schema). Tests captured at baseline in `docs/baseline/v14_baseline_tests.txt`.

**Acceptance matrix**: `tests/test_acceptance_t01_t10.py` (T01–T10 + WB-04–WB-09 workbook gates)

**Module test files**:
- `test_acceptance_t01_t10.py` · `test_auth.py` · `test_cases.py` · `test_historical_reconstruction.py`
- `test_ingestion.py` · `test_notifications.py` · `test_process_owner_permissions.py`
- `test_r007_approval_timing.py` · `test_remediation_replay.py` · `test_rules.py`
- `test_security_remediation.py` · `test_separation_of_duties.py` · `test_suppliers.py`
- `test_temporal_fixture_isolation.py` · `test_transactions.py` · `test_user_management.py`
- `test_access_events.py` · `test_config.py`

---

## 8. Synthetic Test Data

| File | Purpose |
|:-----|:--------|
| `test data.xlsx` | Canonical 8-sheet workbook (seed source for all acceptance tests) |
| `tris_synthetic_test_data_expanded.xlsx` | Expanded dataset for load/variance testing |
| `tris_synthetic_test_data_faulty.xlsx` | Fault-injection dataset for circuit-breaker testing |

All data is explicitly synthetic. The login page and UI carry an `Evaluation Environment · Synthetic Test Data Only` label.

---

## 9. What v2.0 Will Add (But Has Not Yet Built)

The `v2.0-manufacturing-extension` branch will add a complete Material-Cost Intelligence domain as a layer on top of this foundation. See:
- `docs/TRIS_v2.0_Consolidated_Implementation_Instruction.md` — decisions and canonical schema
- `docs/TRIS_v2.0_Tickets_and_Verification_Loop.md` — 14-ticket backlog and verification protocol

**Nothing in this baseline changes.** Every existing module, route, role, rule, test, and governance invariant listed above is off-limits to modification. All v2.0 work is strictly additive.

---

## 10. Evidence Files

| File | Contents |
|:-----|:---------|
| `docs/baseline/v14_baseline_build.txt` | Raw `pnpm run build` output (exit code 0, 14 routes) |
| `docs/baseline/v14_baseline_tests.txt` | Raw `pytest tests/ -v` output (captured after PostgreSQL available) |

Screenshots of every v1.4 screen are captured manually and stored in `docs/baseline/screenshots/` (to be added; see §11 for the recorded deferral).

---

## 11. Decisions, Deferrals and Known Issues

Recorded so the baseline's limits are explicit rather than implied.

### Deferred: "before" screenshots
- The Ticket 1 acceptance criteria list a screenshot set of every working screen. It was deliberately deferred in the Ticket 1 implementation plan: capture is **manual**, and was accepted as non-blocking for Ticket 1 by the project owner.
- **Status: not yet captured.** `docs/baseline/screenshots/` does not exist yet.
- **Due before Ticket 3 (Navigation / UI Shell) changes the UI**, because that is the point at which a "before" reference stops being recoverable from the running app.
- Expected coverage: login, risk cases, case detail, suppliers, ingestion, fraud detection, compliance, the three dashboard pages (correlation, reports, settings), zero trust, user administration.

### Known issue: concurrent test sessions cause spurious failures
- The suite resets shared tables in `tris_db_test` (`DROP SCHEMA` / `TRUNCATE`). Two pytest sessions running at the same time deadlock each other (`DeadlockDetected`) and produce different failing tests on each run.
- Observed during independent QA of Ticket 1: overlapping runs gave 2, then 19 failures plus 11 errors. Every full run made with no other session active passed cleanly (133 and 141 passed at Tickets 2 and later, matching the expected totals).
- The captured `127 passed` baseline was a clean single-session run and is valid. It is not reliable when another session overlaps.
- **Mitigation added after this baseline** (commit `7e7aa91`): `backend/tests/conftest.py` takes a Postgres advisory lock for the whole session and exits immediately with a clear message if another session holds it. Do not run two test sessions against the same database.

### Notes on the captured evidence
- `v14_baseline_build.txt` is not byte-for-byte raw output: it carries a hand-added header line (capture time, branch, commit) and an `Exit code: 0` footer. The build output between them is unmodified.
- The first attempted build capture was incomplete and left a stray file; it was discarded and is not part of this baseline.
- The `v1.4-baseline` tag is **lightweight** (no tag message) and points at commit `72460432`, which is also the tip of `main` and `release/v1.4` at the time of capture.
- The Ticket 1 commit (`578d6f8`) is one commit ahead of the tag and adds only three files under `docs/baseline/` (this README, since moved to `docs/BASELINE_README.md`, and the two raw output files). No code changed.
- The v2.0 planning documents (`TRIS.docx`, the consolidated instruction and the ticket list) are intentionally left untracked for now.
