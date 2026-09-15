# TRIS v1.4 — Consolidated Implementation Instruction

**Status**: Supersedes Decisions A, B, and C in the earlier `TRIS_v1.4_Gap_Analysis_and_Roadmap.md`. All three are now resolved by the stakeholder's written response (`CLARITY.docx`). This document folds those answers into concrete build instructions, plus two engineering decisions that the stakeholder explicitly left to the implementer — both are decided below, not left open.

**Core principle governing everything in this document**: v1.3 is preserved exactly as built. Nothing in v1.4 modifies existing v1.3 fixtures, data, acceptance tests, or evidence. Every new capability is additive and isolated.

---

## 1. RBAC — Final Role Model

Four core roles for v1.4. Do not destructively delete the deprecated roles — hide them from new-user creation / persona selection UI, but preserve any existing records that reference them for backward compatibility.

| Role | Status | Scope |
|---|---|---|
| **Administrator** | Keep | Full admin access: user/role management, rule/threshold configuration, system settings, cross-case visibility. Privileged changes must be auditable (ties to SEC-07). **Cannot act as both investigator and independent verifier on the same case** — see Section 2. |
| **Risk Reviewer** | Keep | Primary case investigator. Triages/reviews cases, inspects evidence, documents investigation findings and root cause, coordinates with Process Owner, runs/reviews remediation replay. Cannot independently verify their own closure. |
| **Verifier** | Keep | Independent verification/closure. Reviews investigation, root cause, corrective action, replay results, evidence, and the 8-field closure requirements. Approves closure, rejects/requests more work, or reopens. Must not rewrite the investigation being verified. |
| **Process Owner** | **New** | Authenticated business role for the person responsible for the affected process/supplier relationship/department/control area. Can view assigned cases, provide operational context/evidence, own and submit corrective actions, propose a corrective control. **Cannot**: edit risk rules, alter historical evidence, decide the final control result, or independently verify/close their own corrective action. |
| Compliance | Deprecate as separate role | Not a required RBAC role in core v1.4. Preserve existing references for backward compatibility. May remain a department/process label, or be reintroduced later if a concrete permission need emerges — do not design new v1.4 permissions around it. |
| CFO | Deprecate as separate role | Not required for minimum v1.4 build. Preserve legacy references only. |
| Security | Deprecate as separate role | Not required as a distinct core role. May remain a department/process label. |
| Procurement | Deprecate as separate role | Not required as a distinct core role. May remain a department/process label. |

### Process Owner workflow (explicit sequence)

1. Process Owner submits the corrective action and may propose a new/revised control.
2. Risk Reviewer runs and analyzes the remediation replay.
3. Verifier independently reviews the completed evidence and determines whether closure requirements are satisfied.
4. No single user performs both investigation and independent verification on the same case — enforced, not just documented (Section 2).

### Implementation notes

- Extend the existing `permissions.py` `Role` enum with `process_owner`. Keep `compliance`, `cfo`, `security`, `procurement` in the enum (for backward-compatible existing records) but remove them from any UI role-selection dropdown, demo persona list, and new-user-creation flow.
- Update `CASE_READ_ROLES` / `CASE_TRANSITION_ROLES` in `permissions.py` to reflect the four-role core model; do not silently leave the deprecated roles with case-transition permissions they were never confirmed to need.

---

## 2. New requirement: Separation-of-duties enforcement (not just role-based)

This is a real control gap today, not a documentation gap. Current `transition_case` only checks role membership — it does not check whether the specific user closing a case is the same person who investigated it, and the stakeholder's response explicitly requires this, including for Administrators.

**Required change**: when a transition targets `Closed` (or generally, when a `Verifier`-role action is being taken), check the case's `CaseHistory` for the investigating actor(s) — at minimum, whoever performed the `Assigned`/`Under Investigation`/`Corrective Action` transitions — and reject the closure if the current actor matches, regardless of role, including `admin`.

```python
async def _enforce_separation_of_duties(case_id: str, current_user: User, session: AsyncSession) -> None:
    history = await CaseHistoryService.get_investigation_actors(case_id, session)
    if current_user.user_id in history.investigating_user_ids:
        raise SeparationOfDutiesViolationError(
            "This user investigated this case and cannot independently verify or close it."
        )
```

Call this before allowing a transition to `Closed`. Add a test: `test_separation_of_duties_blocks_self_verification` — same user investigates and attempts to close → rejected, including when that user has the `admin` role.

---

## 3. v1.3 fixtures — explicit "do not touch" list

Confirmed unchanged, no exceptions:
- `TX-1999` remains the original scenario: approval required, `approval_status: Missing`. Do not add a second approval record to this transaction under any circumstance.
- All existing SUP-001 transaction history remains dated in August 2026, unmodified.
- The existing v1.3 acceptance test asserting `TX-1999` triggers R-003 via missing approval continues to run unmodified and must continue to pass.
- No v1.3 `Expected_Cases`, `Demo_Rules`, or acceptance-test data is altered.

---

## 4. New, isolated v1.4 temporal fixture

Use new, previously-unused synthetic IDs — do not recycle `TX-1999`/`SUP-001`:

- **Transaction**: `TX-TEMP-001`
- **Supplier**: `SUP-TEMP-001`

Confirmed timeline (all August 2026, isolated from existing SUP-001 data):

| Timestamp | Event |
|---|---|
| 2026-08-26 14:15 | Supplier bank-account change becomes effective |
| 2026-08-27 08:00 | Temporary/elevated access becomes active |
| 2026-08-28 09:32 | First required approval recorded |
| 2026-08-28 10:14 | Material transaction/payment event occurs (`TX-TEMP-001`) |
| 2026-08-28 11:06 | Second required approval recorded — **after** the transaction event |
| 2026-08-30 17:00 | Temporary/elevated access removed |

**Required reconstruction result at event time (2026-08-28 10:14)**: the 11:06 approval must be excluded — it did not exist at the event timestamp. Reconstruction uses only data effective/recorded by 10:14. This is the core "no hindsight leakage" test case for the whole v1.4 feature — treat it as the primary acceptance scenario for reconstruction correctness, the same role `TX-1999` played for v1.3.

Build this fixture as a fully separate addition to the synthetic workbook (new rows only, new sheet or clearly isolated section) — never as a modification of existing `SUP-001`/`TX-1999` rows.

---

## 5. Decision: new rule vs. extending R-003 (resolved)

The stakeholder left this as an engineering judgment call: extend R-003, or implement as a separate rule, with the explicit condition "if extending R-003 would make regression fragile."

**Decision: implement as a new, separate rule — `R-007: Approval Timing / Temporal Completeness`.**

Rationale: R-003 currently tests approval *presence* (`Missing` vs `Approved`) and has existing regression coverage (`test_t05_rule_r003_missing_required_approval_trigger`) tied specifically to that semantics. The new check tests approval *timing relative to an event*, which is a different question entirely — was a valid approval in effect at the moment of the transaction, regardless of whether one exists now. Conflating the two into one rule risks exactly the regression fragility the stakeholder flagged. A separate rule:
- Keeps R-003 semantically unchanged and its existing test untouched.
- Is naturally additive/isolated, consistent with the whole "extend, don't modify" principle governing this release.
- Only evaluates against the new `TX-TEMP-001` scenario, so it cannot accidentally affect `TX-1999` or any v1.3 case.

Add `R-007` to `RuleConfig` following the same DB-backed, versioned pattern as R-001–R-006. Document condition: "No approval effective/recorded at or before the transaction's event timestamp satisfies the required approval level."

---

## 6. Historical reconstruction — engineering requirements

Directly from the stakeholder's confirmed rules (Section 4 of their response) — implement literally:

- **Input**: case/transaction ID + the event timestamp to reconstruct.
- **Reconstruct**: supplier/master-data state, transaction state, approval state, access/authority state, and the applicable rule/control version — all as of that timestamp, not current state.
- **Provenance**: every reconstructed fact must carry its source record ID/version and effective/recorded timestamp. This is not optional metadata — it's required for the "why did this return PASS/FAIL/UNKNOWN" explanation the UI needs to show.
- **No hindsight leakage**: never use information created after the event timestamp to determine historical state. This is the single most important invariant in this entire feature — the `TX-TEMP-001` 11:06 approval exclusion is the canonical test of it.
- **Output**: `PASS`, `FAIL`, or `UNKNOWN` for the event-time control determination.
- **UNKNOWN is not optional or a fallback-to-PASS**: if required historical evidence was never captured or cannot be reliably reconstructed, return `UNKNOWN` explicitly. Never infer `PASS` merely because current state looks valid. Add a dedicated test for this: reconstruct a case with a deliberately missing/unrecorded historical field → assert `UNKNOWN`, not `PASS`.

---

## 7. Remediation replay

- After historical reconstruction, allow a **proposed** corrective control to be evaluated against that reconstructed historical event, without altering the original record.
- **First proposed control to implement**: *"Any payment above $50,000 made within seven days of a supplier bank-account change requires independent verification before release."* Use this as the concrete test case for the replay feature, evaluated against `TX-TEMP-001`.
- Store the proposed control/version **separately** from the historical/original control state — never overwrite or version-merge into the original `RuleConfig` history.
- Replay result must be one of: `ALLOW`, `ESCALATE/HOLD`, `BLOCK/PREVENT`, `NOT DETERMINABLE`.
- Show original outcome vs. proposed-control outcome side by side, with an explanation of which specific historical facts drove the replay result (ties directly to the provenance requirement in Section 6).
- Enforce read-only-against-history at the data-access layer, not just by convention: the replay service should not have write access to any table holding original case facts, timestamps, or v1.3 evidence. Consider a dedicated read-only DB session/role for this service, or write proposed-control results exclusively into a new table (`remediation_replay_results`) with no FK path back into mutable case fields — per the isolation requirement in the original ingestion/architecture work earlier in this review.

---

## 8. Regression & backward-compatibility — final checklist

- All existing v1.3 acceptance tests (both T01–T10 numbering schemes, per the earlier discrepancy found in this review) continue to pass, unmodified, unless a test is independently proven defective — and any such change is separately documented, not silently altered as a side effect of v1.4 work.
- `TX-1999` remains the original missing-approval scenario, permanently.
- Existing August 2026 `SUP-001` data is untouched.
- All v1.4 temporal fixtures are additive and isolated (Section 4).
- Existing case workflow (investigation, root cause, corrective action, closure, history, recurrence) continues to function exactly as before.
- No prior evidence is rewritten; no previously-validated scenario's meaning is retroactively changed.

---

## 9. Definition of Done

1. v1.3 baseline and all acceptance tests remain intact and passing.
2. Core RBAC implemented: Administrator, Risk Reviewer, Process Owner, Verifier — with enforced (not just documented) separation of investigation and verification duties (Section 2).
3. New isolated temporal synthetic case (`TX-TEMP-001`/`SUP-TEMP-001`) exists per Section 4.
4. TRIS reconstructs required cross-system state at an arbitrary event timestamp without using later facts.
5. The applicable historical control/rule version is correctly identified as of that timestamp.
6. Event-time determination returns `PASS`/`FAIL`/`UNKNOWN` with supporting evidence/provenance, with `UNKNOWN` genuinely reachable and tested (Section 6).
7. Historical Control State view is available in the existing case workflow UI (extends `app/cases/[id]/page.tsx`, not a new disconnected page).
8. A proposed corrective control can be saved separately and replayed against the historical event (Section 7).
9. Original vs. proposed outcome is shown clearly, with explanation.
10. Security hardening from the v1.4 brief (SEC-01–SEC-07) is implemented without claiming any external certification not actually held.
11. All existing v1.3 investigation/closure functionality still works after the v1.4 additions — verified by full regression run, not by inspection.

---

## 10. Required new/updated tests

In addition to the existing T01–T10 suites (both numbering schemes) remaining green:

- `test_separation_of_duties_blocks_self_verification` — same user investigates and attempts to close, including as `admin` → rejected (Section 2)
- `test_tx1999_unchanged_after_v14` — regression guard: `TX-1999` approval record and R-003 trigger behavior are byte-for-byte the same before/after v1.4 work
- `test_tx_temp_001_reconstruction_excludes_late_approval` — reconstruct at 2026-08-28 10:14, assert the 11:06 approval is not visible to the reconstruction and R-007 correctly evaluates against only the pre-existing state
- `test_r007_isolated_from_r003` — confirm R-007 triggering/not-triggering has zero effect on R-003's evaluation of any transaction, and vice versa
- `test_reconstruction_returns_unknown_on_missing_evidence` — deliberately incomplete historical data → `UNKNOWN`, not `PASS` (Section 6)
- `test_replay_does_not_mutate_original_case` — run remediation replay against `TX-TEMP-001`, assert original case/rule/history records are byte-for-byte unchanged afterward
- `test_process_owner_cannot_edit_rules_or_verify_closure` — RBAC boundary test for the new role's explicit restrictions

Show the diff and flag anywhere the separation-of-duties check or the R-007/reconstruction logic required a design choice not explicitly covered above.
