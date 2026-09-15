# TRIS v1.4 — Implementation Tickets & Verification Loop Protocol

This is the working backlog for v1.4. Every ticket follows the same mandatory loop below — no ticket is complete until it produces raw evidence, not a summary claim of completion.

**Why this exists**: earlier in this project, a self-graded implementation report claimed 98.3% compliance while an actual authentication bypass, unauthenticated data exposure, and an untested "immutable" audit trail were sitting in the code. All three were only caught because the happy path was distrusted and the adversarial/failure paths were checked directly. This loop exists to make that checking the default, not a follow-up.

---

## Master Protocol — Apply to Every Ticket, No Exceptions

### Step 1 — PLAN
Before writing any code, restate the ticket's acceptance criteria in your own words and list every file you intend to create or modify. If anything in the ticket is ambiguous, stop and ask — do not silently pick an interpretation for anything marked as a hard requirement below.

### Step 2 — IMPLEMENT
Build against the plan. Follow the "extend, don't rewrite" and "additive, isolated" principles that govern this entire release — do not touch any file or fixture not listed in the ticket's scope without flagging it first.

### Step 3 — SELF-VERIFY
Run every command listed in the ticket's **Verification Commands** section. Not a subset. Not "the ones that seem most relevant."

### Step 4 — LOOP ON FAILURE
If any verification step fails or produces an unexpected result:
- Do **not** proceed to handoff.
- Do **not** mark the ticket complete, partially complete, or "complete with known issues" — those are not valid states for handoff.
- Diagnose the root cause, return to Step 2, fix it, and re-run **all** verification commands from Step 3 again (not just the one that failed — a fix can break something that was previously passing).
- Repeat until every verification command passes cleanly.

### Step 5 — EVIDENCE CAPTURE
Copy the raw output of every verification command into the handoff report. A paraphrase ("all tests passed") is not evidence. If a test framework produces a summary line (e.g., `45 passed`), include that line **and** confirm the specific named tests relevant to this ticket appear in the passing list — do not accept an aggregate pass count as proof that a specific required test exists and ran.

### Step 6 — HANDOFF
Use the **Completion Report** format specified at the bottom of this document. A completion report missing raw output for any acceptance criterion is invalid and must be redone — this is not a formatting preference, it's a gate.

### Step 7 — DO NOT START THE NEXT TICKET UNTIL THIS ONE'S HANDOFF IS ACCEPTED
Tickets are ordered by dependency below. Do not parallelize ahead of a ticket whose output you depend on.

---

## Ticket 0 — Baseline Snapshot (run first, before any other ticket)

**Why first**: you cannot prove "v1.3 is unchanged" at the end unless you capture what "unchanged" means right now.

**Scope**: No code changes. Capture and store the current state as the regression baseline.

**Acceptance Criteria**:
- Full current backend test suite output captured and saved (`pytest -v` full output, not just the summary line).
- Full current frontend build output captured (`pnpm run build`).
- A snapshot of `TX-1999`'s current `Approval` record and its R-003 evaluation result saved verbatim (DB query output).
- A snapshot of the current RBAC role list and `permissions.py` contents saved.

**Verification Commands**:
```
pytest tests/ -v > baseline_test_output.txt
pnpm run build > baseline_frontend_build.txt
# DB query: SELECT * FROM approvals WHERE transaction_id = 'TX-1999';
```

**Completion requires**: all four artifacts saved and attached to the handoff report, verbatim.

---

## Ticket 1 — Security Hardening Closeout (SEC-01–SEC-07)

**Depends on**: Ticket 0.

**Scope**: Close every open item from the security scorecard.

**Acceptance Criteria**:
- SEC-01: No hardcoded demo password/credential anywhere in frontend source, including the login form. Remove `PRIMARY_DEMO_USER`/`DEMO_USERS` plaintext password entirely, or replace with a mechanism that doesn't expose credentials in source (e.g., a backend-seeded demo account whose credentials are never rendered in the bundle).
- SEC-06: Sensitive supplier fields (`bank_account`, `routing_number`) are masked per role — define which roles see full values vs. masked (e.g., last-4 only) and implement it.
- SEC-07: A dedicated security/auth audit log exists, distinct from `CaseHistory` — captures login attempts (success/failure), role/permission changes, and rule-config edits with actor and timestamp.
- No unsupported compliance claims anywhere in the UI (confirmed already resolved for the login screen in v1.3.1 — verify this is still true, don't re-introduce it).

**Verification Commands**:
```
grep -rn "password.*:.*['\"]" fe/components fe/app --include="*.tsx" | grep -v node_modules
# must return nothing resembling a literal credential
pytest tests/modules/v1/test_security_remediation.py -v
grep -rn "SOC 2\|ISO 27001\|FIPS" fe/app fe/components --include="*.tsx"
# must return nothing
```

**Completion requires**: grep for hardcoded credentials returns empty, masking is demonstrated with an actual API response diff (privileged vs. non-privileged role), and a new audit-log entry is shown being created for a real login attempt and a real rule edit.

---

## Ticket 2 — RBAC Core Model

**Depends on**: Ticket 1.

**Scope**: Implement the four-role model. Full spec in `TRIS_v1.4_Consolidated_Implementation_Instruction.md`, Section 1.

**Acceptance Criteria**:
- `Role` enum includes `process_owner`.
- `compliance`, `cfo`, `security`, `procurement` remain valid in the enum (backward compatibility) but are removed from: new-user-creation UI, demo persona list, and any role-selection dropdown.
- `CASE_READ_ROLES` / `CASE_TRANSITION_ROLES` updated to reflect the four-role core model's actual permissions per the table in Section 1 of the consolidated instruction.
- Process Owner role: can view assigned cases, submit corrective actions, propose a control. Cannot edit rules, alter historical evidence, decide final control result, or verify/close their own corrective action.

**Verification Commands**:
```
pytest tests/modules/v1/test_process_owner_permissions.py -v   # new test, write this
grep -n "process_owner" app/api/core/permissions.py
# confirm deprecated roles removed from frontend selection UI:
grep -rn "cfo\|security\|procurement" fe/components/login-form.tsx
```

**Completion requires**: `test_process_owner_cannot_edit_rules_or_verify_closure` (from the consolidated instruction's test list) passing, with raw output shown.

---

## Ticket 3 — Separation-of-Duties Enforcement

**Depends on**: Ticket 2.

**Scope**: Implement real enforcement, not a role check. Full spec in the consolidated instruction, Section 2.

**Acceptance Criteria**:
- A case cannot be closed by the same user who performed any investigation-stage transition on it (`Assigned`, `Under Investigation`, `Corrective Action`), regardless of role — including `admin`.
- This is enforced server-side at the transition endpoint, not only in frontend UI logic.

**Verification Commands**:
```
pytest tests/modules/v1/test_separation_of_duties.py -v
```
Required test inside that file: `test_separation_of_duties_blocks_self_verification` — must explicitly attempt closure by the same user in the `admin` role and assert rejection, not just a non-privileged role.

**Completion requires**: raw pytest output showing this specific test passing, plus a direct manual/API demonstration (curl or equivalent) of an admin who investigated a case being rejected when attempting to close it.

---

## Ticket 4 — v1.3 Preservation Guard

**Depends on**: Ticket 0 (baseline), runs continuously through every subsequent ticket, not a one-time task.

**Scope**: No new feature work. This ticket is a standing regression check re-run at the end of every other ticket in this backlog.

**Acceptance Criteria**:
- `TX-1999`'s `Approval` record is byte-for-byte identical to the Ticket 0 snapshot.
- The existing R-003 acceptance test for `TX-1999` still passes unmodified.
- Full v1.3 test suite (both T01–T10 numbering schemes, per the earlier discrepancy found in this project — check `tests/test_acceptance_t01_t10.py` by content, not by assuming the numbers align with the workbook's `Developer_Tests` sheet) passes with zero new failures relative to the Ticket 0 baseline.

**Verification Commands**:
```
pytest tests/test_acceptance_t01_t10.py -v
# diff the current TX-1999 approval row against baseline_snapshot.txt from Ticket 0
```

**Completion requires**: this check re-run and re-attached to **every** subsequent ticket's handoff report, not just its own. Any ticket that causes this check to fail is blocked from handoff until fixed, even if that ticket's own acceptance criteria pass.

---

## Ticket 5 — v1.4 Temporal Fixture (`TX-TEMP-001` / `SUP-TEMP-001`)

**Depends on**: Ticket 4.

**Scope**: New, fully isolated synthetic data. Full timeline in the consolidated instruction, Section 4.

**Acceptance Criteria**:
- New supplier `SUP-TEMP-001` and transaction `TX-TEMP-001` added as new rows only — zero modification to any existing `SUP-001`/`TX-1999` row.
- Exact six-event timeline implemented (bank change, access grant, first approval, transaction, second approval, access removal) with the exact timestamps specified.
- This fixture is loadable independently of the v1.3 dataset (e.g., a separate ingestion pass or clearly separated sheet) so it can never accidentally overwrite v1.3 fixture data on re-ingest.

**Verification Commands**:
```
pytest tests/modules/v1/test_temporal_fixture_isolation.py -v
# Confirm re-ingesting v1.3 test_data.xlsx does not alter SUP-TEMP-001/TX-TEMP-001, and vice versa
```

**Completion requires**: `test_tx1999_unchanged_after_v14` passing (proves this ticket didn't leak into v1.3 data) plus confirmation the new fixture data round-trips through ingestion correctly.

---

## Ticket 6 — R-007 Rule (Approval Timing)

**Depends on**: Ticket 5.

**Scope**: New rule, per the resolved decision in the consolidated instruction, Section 5. Do not modify R-003.

**Acceptance Criteria**:
- `R-007: Approval Timing / Temporal Completeness` added to `RuleConfig` following the same DB-backed, versioned pattern as R-001–R-006.
- Evaluated against `TX-TEMP-001`: correctly determines whether an approval was effective at the 10:14 event timestamp. Note the fixture has an approval at 09:32 — before the event — and a second at 11:06 — after. R-007's job is specifically to exclude the 11:06 approval from consideration, not to treat the transaction as unapproved outright if the 09:32 approval already satisfies the required level. Confirm which outcome the 09:32 approval actually produces (satisfied vs. flagged) based on the required approval level for this transaction, and state that reasoning explicitly in the handoff — do not assume the answer.
- R-003's behavior and existing test are completely unaffected by R-007's existence.

**Verification Commands**:
```
pytest tests/modules/v1/test_r007_approval_timing.py -v
pytest tests/test_acceptance_t01_t10.py::test_t05_rule_r003_missing_required_approval_trigger -v
```

**Completion requires**: `test_r007_isolated_from_r003` passing, plus explicit confirmation of what R-007 actually determines for `TX-TEMP-001`, with reasoning, in the handoff.

---

## Ticket 7 — Historical Reconstruction Service

**Depends on**: Ticket 6.

**Scope**: Full spec in the consolidated instruction, Section 6. This is the core of v1.4 — treat it with the most scrutiny of any ticket in this backlog.

**Acceptance Criteria**:
- Given `(case_id or transaction_id, event_timestamp)`, reconstructs supplier state, transaction state, approval state, access/authority state, and applicable rule version — all as of that timestamp.
- Every reconstructed fact carries source record ID/version and effective/recorded timestamp (provenance).
- **No hindsight leakage**: the 11:06 approval must not be visible to a reconstruction targeting the 10:14 event.
- Returns `PASS`, `FAIL`, or `UNKNOWN` — and `UNKNOWN` is genuinely reachable, not a theoretical state that never fires. Never defaults to `PASS` when evidence is missing.

**Verification Commands**:
```
pytest tests/modules/v1/test_historical_reconstruction.py -v
```
Required tests in that file:
- `test_tx_temp_001_reconstruction_excludes_late_approval`
- `test_reconstruction_returns_unknown_on_missing_evidence` — this one specifically: construct a case with deliberately incomplete historical data and prove the service returns `UNKNOWN`, not `PASS`. If this test doesn't exist or doesn't actually exercise a missing-evidence path (as opposed to a trivially-passing path), the ticket is not done.

**Completion requires**: raw output of both required tests, plus the actual JSON/object returned by the reconstruction service for the `TX-TEMP-001` case at 10:14, pasted into the handoff — not just "test passed," show what it actually reconstructed.

---

## Ticket 8 — Remediation Replay

**Depends on**: Ticket 7.

**Scope**: Full spec in the consolidated instruction, Section 7.

**Acceptance Criteria**:
- Proposed control ("payments >$50k within 7 days of a bank-account change require independent verification") can be saved separately from the original `RuleConfig` history.
- Replay evaluates the proposed control against the `TX-TEMP-001` reconstructed historical event.
- Replay result is one of `ALLOW`, `ESCALATE/HOLD`, `BLOCK/PREVENT`, `NOT DETERMINABLE`.
- Original case/rule/history records are provably unchanged after running replay.
- Replay is read-only against history at the data-access layer — not enforced by convention alone.

**Verification Commands**:
```
pytest tests/modules/v1/test_remediation_replay.py -v
```
Required test: `test_replay_does_not_mutate_original_case` — capture a full snapshot of the case/rule/history rows before replay, run replay, capture again, diff must be empty.

**Completion requires**: the actual before/after diff (or explicit confirmation of zero diff) pasted into the handoff, not a claim that it's unchanged.

---

## Ticket 9 — Frontend: Historical Control State & Replay UI

**Depends on**: Ticket 8.

**Scope**: Extend the existing case detail page (`app/cases/[id]/page.tsx`) — do not create a new, disconnected page.

**Acceptance Criteria**:
- New section on the existing case detail view showing the historical control state (PASS/FAIL/UNKNOWN) with provenance/explanation.
- Original vs. proposed-control outcome shown side by side for cases with a saved replay result.
- No hardcoded/mock data in this UI — same discipline as the dashboard fix earlier in this project. If no reconstruction/replay exists for a case, show a genuine empty state, not placeholder figures.

**Verification Commands**:
```
pnpm run build
grep -n "TX-TEMP-001" fe/app/cases/\[id\]/page.tsx
# must return nothing resembling literal fixture data baked into the component
```

**Completion requires**: build passes with zero TypeScript errors, and a screenshot or DOM snapshot of the new section actually rendering real reconstruction data for `TX-TEMP-001`.

---

## Ticket 10 — Final Regression & Sign-off

**Depends on**: All prior tickets.

**Scope**: No new code. Full-system proof that everything above holds together.

**Acceptance Criteria**: every item in the Definition of Done (consolidated instruction, Section 9), all 11 points, individually checked off with evidence — not asserted as a block.

**Verification Commands**:
```
pytest tests/ -v
pnpm run build
```

**Completion requires**: full test suite output attached, diffed against the Ticket 0 baseline to confirm zero regressions and the expected new tests present, plus a point-by-point response to all 11 Definition of Done items from Section 9 of the consolidated instruction, each with its own evidence reference (which test, which output line, which screenshot) — a bare "done" against any of the 11 is not acceptable.

---

## Completion Report Format (required for every ticket)

```
## Ticket [N] — [Title] — COMPLETE

### Acceptance criteria checked:
- [criterion 1]: PASS — [raw evidence / output excerpt]
- [criterion 2]: PASS — [raw evidence / output excerpt]
...

### Verification commands run (raw output):
[paste actual terminal output, not a summary]

### Ticket 4 preservation check (required on every ticket from Ticket 5 onward):
[raw output confirming TX-1999/v1.3 baseline unaffected]

### Anything I had to interpret or decide that wasn't explicitly specified:
[state it plainly — do not silently resolve ambiguity and omit mentioning it]
```

A report that skips the last section, or that summarizes results instead of pasting them, is incomplete and must be redone before the next ticket starts.
