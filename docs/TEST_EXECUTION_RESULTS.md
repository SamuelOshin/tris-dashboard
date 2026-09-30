# TRIS v1.4 — Test Execution & Acceptance Report

**Execution Timestamp**: `2026-09-29T21:20Z` (suite completed)
**Test Runner**: `pytest 9.1.1` · `Python 3.12.10` · `FastAPI 0.141.1` · `SQLModel 0.0.22`
**Database**: PostgreSQL 16 (required — no SQLite fallback; the suite provisions `tris_db_test` and resets its schema)
**Overall Status**: 🟢 **127 / 127 Tests Passed (100% Pass Rate)**
**Duration**: `423.93s` (7m 03s) · 5 warnings · 0 failures

> **Prerequisite:** start PostgreSQL before running the suite.
>
> ```bash
> docker compose up -d postgres
> cd backend && uv run pytest tests/ -q
> ```
>
> If the database is unreachable the suite aborts immediately with a single
> actionable message instead of emitting one connection timeout per test.

---

## 1. Acceptance Test Matrix (T01 through T10)

| Test ID | Category | Specification / Criteria | Observed Result | Status |
| :---: | :--- | :--- | :--- | :---: |
| **T01** | **Ingestion & Schema Integrity** | Parse all 8 sheets in `test data.xlsx` into relational tables; verify foreign keys. | 19 transactions, 8 suppliers, 8 access events, 10 approvals, 6 rules parsed. All FKs valid. | 🟢 **PASSED** |
| **T02** | **Baseline Calculation** | Compute descriptive stats for `SUP-001` strictly excluding target anomaly `TX-1999`. | Baseline mean = **$30,471.43**, median = **$30,400.00**, min = $28,500, max = $32,100, std dev = $1,306.03 across 7 invoices. | 🟢 **PASSED** |
| **T03** | **Rule R-001 (Amount Deviation)** | Flag `TX-1999` ($104,000) exceeding `2.0x` baseline. | Amount ratio = **3.41x** (> 2.0x threshold). Score: **+35**. | 🟢 **PASSED** |
| **T04** | **Rule R-002 (Bank Change)** | Flag bank change within 7 days prior to invoice. | Bank changed 2 days prior (2026-08-26 vs 2026-08-28). Score: **+25**. | 🟢 **PASSED** |
| **T05** | **Rule R-003 (Missing Approval)** | Flag missing Level 3 authorization for invoice >= $50,000. | `R-003` triggered on `TX-1999` ($104,000), which lacks Level 3 authorization. Score: **+25**. | 🟢 **PASSED** |
| **T06** | **Rule R-004 (Off-Hours Access)** | Flag access event telemetry outside 06:00–20:00 UTC operational window. | Event `AE-003` logged at 22:47:00 (off-hours). Score: **+15**. | 🟢 **PASSED** |
| **T07** | **Case Consolidation & Scoring** | Additive scoring for R-001..R-004 consolidates into `TEST-CASE-001`. | Score: 35 + 25 + 25 + 15 = **100** (High Priority). Case generated with 4 signals. | 🟢 **PASSED** |
| **T08** | **State Machine Boundary** | Prevent illegal status transitions (e.g., `New` -> `Closed`). | API returned `409 Conflict` (`INVALID_STATE_TRANSITION`). | 🟢 **PASSED** |
| **T09** | **Verified Closure Gatekeeper** | Block case closure without all 8 mandatory compliance fields. | Incomplete submission rejected with `422 Unprocessable Content`; complete submission closed with `200 OK`. Investigator and verifier are **distinct principals**, so Separation of Duties is enforced rather than bypassed. | 🟢 **PASSED** |
| **T10** | **Audit Trail Immutability** | Chronological append-only history logged on every transition. | History row count grows monotonically across transitions and existing rows are unchanged. The `CASE_HISTORY_IMMUTABILITY_SQL` trigger is confirmed present on the correct table by inspecting its SQL source. **Caveat:** the runtime `BEFORE UPDATE/DELETE` trigger (`trg_case_history_immutable`) is *not* exercised by this test — a direct mutation attempt is not attempted. | 🟢 **PASSED** |

---

## 2. Module Test Suite Breakdown (127 Tests Total)

### `tests/modules/v1/test_ingestion.py` (21 Tests)

Workbook parsing, transactional chunking, savepoint isolation, and RBAC on upload endpoints.
Includes `test_case_immutability_under_update_strategy`, `test_chunk_savepoint_isolation_single_bad_row`,
`test_cumulative_post_insert_circuit_breaker_hard_abort`, and `test_job_telemetry_staleness_guard_marks_timed_out`.
🟢 All PASSED

### `tests/modules/v1/test_security_remediation.py` (16 Tests)

Authentication and authorization boundaries: unauthenticated rejection across
rules / cases / suppliers / transactions / ingestion endpoints, low-privilege role
rejection, and rule-update privilege-escalation attempts. 🟢 All PASSED

### `tests/test_acceptance_t01_t10.py` (15 Tests)

T01–T10 plus workbook gates: plain-language explainability, ownership/department/history
assignment, recurrence detection (R-006), duplicate invoice detection (R-005), and a
clean-control supplier baseline check. 🟢 All PASSED

### `tests/modules/v1/test_remediation_replay.py` (12 Tests)

- `test_remediation_replay_blocks_tx_temp_001`: 🟢 PASSED
- `test_replay_does_not_mutate_original_case`: 🟢 PASSED
- `test_proposed_control_stored_separately_from_rule_configs`: 🟢 PASSED
- `test_remediation_replay_allows_when_independent_verification_present`: 🟢 PASSED
- `test_remediation_replay_allows_when_amount_below_threshold`: 🟢 PASSED
- `test_remediation_replay_allows_when_bank_change_outside_window`: 🟢 PASSED
- `test_remediation_replay_returns_not_determinable_on_missing_evidence`: 🟢 PASSED
- `test_remediation_replay_escalate_hold_action_policy`: 🟢 PASSED
- `test_remediation_replay_api_endpoints`: 🟢 PASSED
- `test_replay_data_access_layer_blocks_mutation`: 🟢 PASSED
- `test_replay_raises_not_found_on_invalid_transaction`: 🟢 PASSED
- `test_replay_handles_none_approval_state`: 🟢 PASSED

### `tests/modules/v1/test_user_management.py` (9 Tests)

Admin-only user administration: listing, creation, duplicate and invalid-role rejection,
role/department updates, **self-lockout prevention**, password reset, and self-service
password change. 🟢 All PASSED

### `tests/modules/v1/test_auth.py` (6 Tests)

- `test_successful_login`: 🟢 PASSED
- `test_failed_login_bad_password`: 🟢 PASSED
- `test_get_me_with_bearer_token`: 🟢 PASSED
- `test_get_me_with_cookie_session_only`: 🟢 PASSED
- `test_cookie_security_attributes_in_dev_and_production`: 🟢 PASSED
- `test_update_me_profile`: 🟢 PASSED

### `tests/modules/v1/test_process_owner_permissions.py` (5 Tests)

Four-role model structure, process owner read/submit vs. edit/verify denial, independent
verifier closure, and rejection of deprecated roles. 🟢 All PASSED

### `tests/modules/v1/test_cases.py` (5 Tests)

- `test_get_all_cases`: 🟢 PASSED
- `test_get_case_with_chronological_history`: 🟢 PASSED
- `test_invalid_state_transition_rejected`: 🟢 PASSED
- `test_verified_closure_8_field_validation`: 🟢 PASSED (investigator and verifier are distinct principals)
- `test_patch_case_updates_investigation_and_corrective_fields`: 🟢 PASSED

### `tests/modules/v1/test_notifications.py` (5 Tests)

Unauthenticated rejection, user/role-scoped RBAC filtering, unread counting, single and
bulk mark-as-read, and domain event emission on case transitions. 🟢 All PASSED

### `tests/modules/v1/test_suppliers.py` (5 Tests)

Listing, single fetch, 404 handling, strict-exclusion baseline proof, and the baseline endpoint.
🟢 All PASSED

### `tests/modules/v1/test_access_events.py` (4 Tests)

Listing with filters, stats endpoint, and single-event fetch. 🟢 All PASSED

### `tests/modules/v1/test_historical_reconstruction.py` (4 Tests) — **v1.4**

- `test_tx_temp_001_reconstruction_excludes_late_approval`: 🟢 PASSED (no hindsight leakage)
- `test_reconstruction_returns_unknown_on_missing_evidence`: 🟢 PASSED (UNKNOWN, never defaults to PASS)
- `test_reconstruction_persists_append_only_snapshot`: 🟢 PASSED
- `test_reconstruction_tx1999_does_not_affect_original_case`: 🟢 PASSED

### `tests/modules/v1/test_separation_of_duties.py` (4 Tests) — **v1.4**

- `test_separation_of_duties_blocks_self_verification`: 🟢 PASSED
- `test_separation_of_duties_allows_independent_verifier`: 🟢 PASSED
- `test_separation_of_duties_blocks_spoofed_actor_by_investigator`: 🟢 PASSED
- `test_separation_of_duties_blocks_investigator_as_verified_by`: 🟢 PASSED

> These four run against production governance code with **no test-identity escape
> hatch**. An earlier `USR-TEST-001` bypass was removed; tests now use genuinely
> distinct principals via the `client_as(user)` factory fixture in `tests/conftest.py`.

### `tests/modules/v1/test_r007_approval_timing.py` (4 Tests) — **v1.4**

- `test_r007_rule_config_db_backed_and_versioned`: 🟢 PASSED
- `test_r007_evaluation_on_tx_temp_001_excludes_late_approval`: 🟢 PASSED
- `test_r007_outcome_reasoning_level_satisfaction`: 🟢 PASSED
- `test_r007_isolated_from_r003`: 🟢 PASSED

### `tests/modules/v1/test_temporal_fixture_isolation.py` (4 Tests) — **v1.4**

- `test_temporal_fixture_loading_and_roundtrip`: 🟢 PASSED
- `test_six_event_timeline_exactness`: 🟢 PASSED
- `test_tx1999_unchanged_after_v14`: 🟢 PASSED
- `test_reingest_v13_does_not_overwrite_v14_and_vice_versa`: 🟢 PASSED

### `tests/modules/v1/test_rules.py` (4 Tests)

Rule listing, version increment on update, the full `TX-1999` benchmark, and the evaluate
endpoint. 🟢 All PASSED

### `tests/modules/v1/test_transactions.py` (3 Tests)

Listing, supplier filtering, and single fetch. 🟢 All PASSED

### `tests/test_config.py` (1 Test)

Database URL normalization. 🟢 PASSED

---

## 3. Frontend Verification

The overview dashboard was decomposed from a single **1,242-line** `overview-dashboard.tsx`
into a feature folder driven by a **116-line** conductor. Largest file in the feature is
202 lines — within the 250–300 line ceiling set in `AGENTS.md`.

| File | Lines |
| :--- | ---: |
| `components/overview-dashboard.tsx` (conductor) | 116 |
| `components/overview/tabs/spline-ledger-chart.tsx` | 202 |
| `components/overview/tabs/risk-volume-breakdown.tsx` | 193 |
| `components/overview/tabs/invoice-ledger-table.tsx` | 180 |
| `components/overview/hooks/use-benchmark-narrative.ts` | 191 |
| `components/overview/hooks/use-overview-data.ts` | 180 |
| `components/overview/hooks/use-ledger-telemetry.ts` | 164 |
| `components/overview/tabs/hero-summary-panel.tsx` | 170 |
| `components/overview/hooks/use-overview-metrics.ts` | 118 |
| `components/overview/lib/format.ts` | 71 |
| `components/overview/types.ts` | 64 |
| `components/overview/tabs/hero-telemetry-card.tsx` | 40 |

Ledger filter state moved into `InvoiceLedgerTable`, so switching a filter no longer
re-renders the whole dashboard tree.

```
$ npx tsc --noEmit
  ✓ No type errors
```

> `pnpm run build` requires network access to `fonts.googleapis.com` for `next/font` in
> `app/layout.tsx` and fails in offline environments. That is an environmental
> limitation, not a compile failure — `tsc --noEmit` is the offline-safe gate.
>
> `pnpm run lint` is also currently broken: `eslint` is not installed despite being
> declared as a script.

---

## 4. Known Limitations

| Item | Status |
| :--- | :--- |
| `TX-TEMP-001` event time pinned to `2026-08-28 10:14 UTC` in `strategies.py` and `remediation_service.py` | **Open.** The instant sits between the two seeded approvals (09:32 pre-event, 11:06 late) and is what makes hindsight-exclusion testable. The proper fix is an explicit `event_timestamp` column on `Transaction` via a new Alembic revision; migrations are never hand-edited. |
| Coverage reporting | **Not wired up.** `pytest-cov` is not a dev dependency, so `--cov=app` fails. Add it with `uv add --dev pytest-cov`. |
| Replay read-only guarantee | **Partial.** Guarded at the service layer; a database-level guarantee requires revoking write grants from the application role. |
| `approvals` module has no registered router | **Open.** Models and schemas exist, but no HTTP endpoints are mounted. |
| Browser E2E tests | **Excluded by default** via `pyproject.toml` `addopts`; `tests/test_e2e_browser.py` requires Playwright and a live dev server. |
