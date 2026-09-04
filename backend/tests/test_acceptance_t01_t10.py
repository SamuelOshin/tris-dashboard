"""
Developer Acceptance Test Matrix (T01 through T10).
Formally verifies all 10 acceptance criteria defined in TRIS v1.3 Specification.
"""

from datetime import date
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.access_events.models.access_event import AccessEvent
from app.api.modules.v1.approvals.models.approval import Approval
from app.api.modules.v1.cases.models.risk_case import CaseHistory, RiskCase
from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService
from app.api.modules.v1.rules.service.rule_engine_service import RuleEngineService
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.api.modules.v1.suppliers.service.baseline_service import BaselineService
from app.api.modules.v1.transactions.models.transaction import Transaction

DATA_FILE = Path("../test data.xlsx").resolve()


@pytest.fixture(autouse=True)
async def seed_acceptance_data(db_session: AsyncSession):
    """Seed synthetic test dataset before each acceptance test."""
    await IngestionService.ingest_excel_workbook(DATA_FILE, db_session)


@pytest.mark.asyncio
async def test_t01_ingestion_schema_and_fk_validation(db_session: AsyncSession):
    """
    T01 Acceptance Test: Ingestion Schema & Foreign Key Integrity.
    Verifies that all 8 sheets are parsed into relational tables with clean FK links.
    """
    suppliers = (await db_session.execute(select(Supplier))).scalars().all()
    transactions = (await db_session.execute(select(Transaction))).scalars().all()
    approvals = (await db_session.execute(select(Approval))).scalars().all()
    access_events = (await db_session.execute(select(AccessEvent))).scalars().all()

    assert len(suppliers) == 8
    assert len(transactions) == 19
    assert len(approvals) == 10
    assert len(access_events) == 8

    # Foreign key integrity check: every transaction points to an existing supplier
    sup_ids = {s.supplier_id for s in suppliers}
    for tx in transactions:
        assert tx.supplier_id in sup_ids


@pytest.mark.asyncio
async def test_t02_baseline_calculation_strict_exclusion(db_session: AsyncSession):
    """
    T02 Acceptance Test: Baseline Descriptive Stats with Strict Target Exclusion.
    Verifies SUP-001 baseline across TX-1001..TX-1007 is exactly $30,471.43 excluding TX-1999.
    """
    baseline = await BaselineService.calculate_baseline(
        supplier_id="SUP-001",
        session=db_session,
        exclude_transaction_id="TX-1999",
    )

    assert baseline["supplier_id"] == "SUP-001"
    assert baseline["invoice_count"] == 7
    assert baseline["mean_amount"] == 30471.43
    assert baseline["median_amount"] == 30400.00
    assert baseline["min_amount"] == 28500.00
    assert baseline["max_amount"] == 32100.00
    assert baseline["std_dev"] == 1306.03
    assert "TX-1999" not in baseline["baseline_transaction_ids"]


@pytest.mark.asyncio
async def test_t03_rule_r001_amount_deviation_trigger(db_session: AsyncSession):
    """
    T03 Acceptance Test: Rule R-001 Amount Deviation Trigger.
    Verifies TX-1999 ($104,000) is detected as 3.41x baseline (multiplier > 2.0).
    """
    result = await RuleEngineService.evaluate_transaction("TX-1999", db_session)
    r001 = next((s for s in result.triggered_signals if s.rule_code == "R-001"), None)

    assert r001 is not None
    assert r001.triggered is True
    assert r001.weight == 35
    assert r001.score == 35
    assert r001.diagnostics["calculated_ratio"] == 3.41


@pytest.mark.asyncio
async def test_t04_rule_r002_recent_bank_change_trigger(db_session: AsyncSession):
    """
    T04 Acceptance Test: Rule R-002 Recent Bank Change Surveillance.
    Verifies bank change 2 days prior to invoice triggers with weight 25.
    """
    result = await RuleEngineService.evaluate_transaction("TX-1999", db_session)
    r002 = next((s for s in result.triggered_signals if s.rule_code == "R-002"), None)

    assert r002 is not None
    assert r002.triggered is True
    assert r002.weight == 25
    assert r002.score == 25
    assert r002.diagnostics["days_difference"] == 2


@pytest.mark.asyncio
async def test_t05_rule_r003_missing_required_approval_trigger(db_session: AsyncSession):
    """
    T05 Acceptance Test: Rule R-003 Missing Control Approval.
    Verifies TX-1999 lacks Level 3 authorization and triggers with weight 25.
    """
    result = await RuleEngineService.evaluate_transaction("TX-1999", db_session)
    r003 = next((s for s in result.triggered_signals if s.rule_code == "R-003"), None)

    assert r003 is not None
    assert r003.triggered is True
    assert r003.weight == 25
    assert r003.score == 25


@pytest.mark.asyncio
async def test_t06_rule_r004_off_hours_access_trigger(db_session: AsyncSession):
    """
    T06 Acceptance Test: Rule R-004 Off-Hours Access Telemetry.
    Verifies AE-003 at 22:47:00 triggers with weight 15.
    """
    result = await RuleEngineService.evaluate_transaction("TX-1999", db_session)
    r004 = next((s for s in result.triggered_signals if s.rule_code == "R-004"), None)

    assert r004 is not None
    assert r004.triggered is True
    assert r004.weight == 15
    assert r004.score == 15
    assert r004.diagnostics["off_hours_count"] >= 1


@pytest.mark.asyncio
async def test_t07_multi_signal_case_consolidation_and_score(db_session: AsyncSession):
    """
    T07 Acceptance Test: Additive Scoring and Consolidated Case Generation.
    Verifies total score = 35 + 25 + 25 + 15 = 100, Priority = High, Case = TEST-CASE-001.
    """
    result = await RuleEngineService.evaluate_transaction(
        "TX-1999", db_session, auto_create_case=True
    )

    assert result.total_score == 100
    assert result.priority == "High"
    assert len(result.triggered_signals) == 4

    case = await db_session.get(RiskCase, "TEST-CASE-001")
    assert case is not None
    assert case.priority == "High"
    assert case.status == "New"
    assert len(case.trigger_signals) == 4


@pytest.mark.asyncio
async def test_t08_case_state_machine_boundary_enforcement(async_client: AsyncClient):
    """
    T08 Acceptance Test: Case State Machine Matrix Enforcement.
    Attempting illegal status transition (New -> Closed) MUST return 409 Conflict.
    """
    res = await async_client.post(
        "/api/v1/cases/TEST-CASE-001/transition",
        json={"to_status": "Closed", "actor": "unauthorized_user"},
    )
    assert res.status_code == 409
    assert res.json()["error_code"] == "INVALID_STATE_TRANSITION"


@pytest.mark.asyncio
async def test_t09_verified_closure_gatekeeper_validation(async_client: AsyncClient):
    """
    T09 Acceptance Test: 8-Field Verified Closure Compliance Gatekeeper.
    Rejects incomplete closure with 422; allows closure only with all 8 fields.
    """
    case_id = "TEST-CASE-001"

    # Progress case to Pending Verification
    await async_client.post(
        f"/api/v1/cases/{case_id}/transition", json={"to_status": "Assigned", "actor": "auditor"}
    )
    await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Under Investigation", "actor": "auditor"},
    )
    await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Corrective Action", "actor": "auditor"},
    )
    await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Pending Verification", "actor": "auditor"},
    )

    # Incomplete closure attempt (only 2 fields) -> MUST return 422
    fail_res = await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={
            "to_status": "Closed",
            "actor": "verifier",
            "root_cause": "Test error",
            "closure_type": "Confirmed Fraud / Blocked",
        },
    )
    assert fail_res.status_code == 422
    assert fail_res.json()["error_code"] == "VERIFIED_CLOSURE_VALIDATION_ERROR"

    # Complete closure attempt (All 8 mandatory fields) -> MUST return 200
    success_res = await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={
            "to_status": "Closed",
            "actor": "verifier",
            "root_cause": "Compromised vendor portal account",
            "corrective_action": "Bank details reverted; payment hold placed",
            "closure_type": "Confirmed Fraud / Blocked",
            "closure_evidence": "Audit ticket SEC-2026-881",
            "verified_by": "Independent Controls Auditor",
            "closure_date": "2026-08-30",
            "follow_up_requirement": "Mandatory MFA rollout",
            "recurrence_monitoring": "Enrolled in 90-day surveillance",
        },
    )
    assert success_res.status_code == 200
    assert success_res.json()["data"]["status"] == "Closed"


@pytest.mark.asyncio
async def test_t10_immutable_audit_trail_integrity(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    T10 Acceptance Test: Immutable Audit Trail — Append-Only Behavioral Verification.

    This test verifies two independent properties:
    1. Application-layer append-only behavior: history rows are never modified or deleted
       across multiple state transitions. The count only grows and existing rows are unchanged.
    2. PostgreSQL trigger presence: the CASE_HISTORY_IMMUTABILITY_SQL trigger is defined
       and targets the correct table (verified by inspecting the trigger SQL source).

    Note: The PostgreSQL-level BEFORE UPDATE/DELETE trigger (trg_case_history_immutable)
    is enforced at runtime against a live Postgres instance. Integration verification
    should run uv run pytest tests/ against a real Docker PostgreSQL container.
    """
    case_id = "TEST-CASE-001"

    # Capture baseline history (after seeding, case has 1 history entry)
    def get_history():
        return db_session.execute(
            select(CaseHistory)
            .where(CaseHistory.case_id == case_id)
            .order_by(CaseHistory.timestamp.asc())
        )

    initial_result = await get_history()
    initial_entries = list(initial_result.scalars().all())
    assert len(initial_entries) >= 1, "Seeding must create at least one history entry"

    # Snapshot content of existing rows BEFORE any additional transitions
    initial_row_ids = {e.history_id for e in initial_entries}
    initial_row_actions = {e.history_id: e.action for e in initial_entries}

    # Drive two more transitions
    await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Assigned", "actor": "auditor"},
    )
    await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Under Investigation", "actor": "auditor"},
    )

    # Fetch updated history
    updated_result = await get_history()
    updated_entries = list(updated_result.scalars().all())

    # 1. Row count grew — only INSERTs, no DELETEs
    assert len(updated_entries) == len(initial_entries) + 2, (
        f"Expected {len(initial_entries) + 2} rows, got {len(updated_entries)}. "
        "Rows were deleted rather than appended."
    )

    # 2. Original rows are unmodified — no UPDATEs mutated existing history
    for entry in updated_entries:
        if entry.history_id in initial_row_ids:
            assert entry.action == initial_row_actions[entry.history_id], (
                f"History row {entry.history_id} was mutated after insertion. "
                "Audit trail is not immutable."
            )

    # 3. All entries have required audit fields populated
    for entry in updated_entries:
        assert entry.action is not None and entry.action.strip() != ""
        assert entry.actor is not None and entry.actor.strip() != ""
        assert entry.timestamp is not None

    # 4. Verify PostgreSQL trigger SQL is correctly defined and targets case_history
    from app.api.db.triggers import CASE_HISTORY_IMMUTABILITY_SQL

    assert "case_history" in CASE_HISTORY_IMMUTABILITY_SQL
    assert "BEFORE UPDATE OR DELETE" in CASE_HISTORY_IMMUTABILITY_SQL
    assert "prevent_case_history_mutation" in CASE_HISTORY_IMMUTABILITY_SQL


# ─────────────────────────────────────────────────────────────────────────────
# WORKBOOK ACCEPTANCE CHECKLIST (Developer_Tests Sheet Specific Invariants)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_workbook_t04_plain_language_explainability_no_unsupported_probability(
    db_session: AsyncSession,
):
    """
    Workbook T04 Acceptance Test: Explainability.
    Verifies that all triggered rules provide plain-language, explainable reason text
    and explicitly do NOT contain fake ML fraud percentages or unsupported probability scores.
    """
    result = await RuleEngineService.evaluate_transaction("TX-1999", db_session)
    assert len(result.triggered_signals) == 4

    unsupported_terms = [
        "probability",
        "confidence score",
        "% fraud",
        "likely fraud",
        "percent chance",
    ]

    for signal in result.triggered_signals:
        # 1. Plain-language reason text is populated and non-trivial
        assert signal.explanation is not None
        assert len(signal.explanation.strip()) > 15

        # 2. No pseudo-scientific statistical fraud probabilities
        explanation_lower = signal.explanation.lower()
        for term in unsupported_terms:
            assert term not in explanation_lower, (
                f"Unsupported probability term '{term}' in {signal.rule_code}"
            )


@pytest.mark.asyncio
async def test_workbook_t05_ownership_assignment_department_and_history(
    async_client: AsyncClient,
):
    """
    Workbook T05 Acceptance Test: Ownership & Department Assignment Persistence.
    Assigning a case to an owner and department must persist the assignment, timestamp,
    status, and immutable history entry as a coherent unit.
    """
    case_id = "TEST-CASE-001"

    assign_res = await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={
            "to_status": "Assigned",
            "actor": "lead_triage",
            "assigned_to": "A. Reviewer",
            "department": "Finance",
            "note": "Review supplier master change, approval trail, and payment exception",
        },
    )
    assert assign_res.status_code == 200
    case_data = assign_res.json()["data"]

    # Verify structured ownership and department fields
    assert case_data["status"] == "Assigned"
    assert case_data["assigned_to"] == "A. Reviewer"
    assert case_data["department"] == "Finance"

    # Verify audit history captured the transition and assignment details
    history = case_data["history"]
    latest_event = history[-1]
    assert latest_event["new_status"] == "Assigned"
    assert latest_event["actor"] == "A. Reviewer"
    assert "Owner: A. Reviewer" in latest_event["note"]
    assert "Dept: Finance" in latest_event["note"]


@pytest.mark.asyncio
async def test_workbook_t07_recurrence_detection_and_prior_case_surfacing(
    async_client: AsyncClient, db_session: AsyncSession
):
    """
    Workbook T07 Acceptance Test: Recurrence Detection (Rule R-006).
    1. Complete verified closure on TEST-CASE-001 for SUP-001.
    2. Ingest/evaluate a subsequent transaction for SUP-001.
    3. Rule R-006 triggers (weight 20) and surfaces prior root cause and corrective action.
    """
    case_id = "TEST-CASE-001"

    # Progress and close TEST-CASE-001 with full verified closure
    await async_client.post(
        f"/api/v1/cases/{case_id}/transition", json={"to_status": "Assigned", "actor": "auditor"}
    )
    await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Under Investigation", "actor": "auditor"},
    )
    await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Corrective Action", "actor": "auditor"},
    )
    await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Pending Verification", "actor": "auditor"},
    )

    closure_payload = {
        "to_status": "Closed",
        "actor": "verifier",
        "root_cause": "Supplier bank-change verification workflow not completed",
        "corrective_action": (
            "Require independent verification of supplier banking change and second approval"
        ),
        "closure_type": "Confirmed Fraud / Blocked",
        "closure_evidence": "Synthetic verification reference DOC-TEST-001",
        "verified_by": "B. Verifier",
        "closure_date": "2026-08-30",
        "follow_up_requirement": "Mandatory callback confirmation",
        "recurrence_monitoring": "90-day surveillance",
    }
    close_res = await async_client.post(f"/api/v1/cases/{case_id}/transition", json=closure_payload)
    assert close_res.status_code == 200

    # Insert a subsequent transaction for SUP-001 within 90 days
    recur_tx = Transaction(
        transaction_id="TX-1999-RECUR",
        supplier_id="SUP-001",
        invoice_number="INV-2026-RECUR-01",
        amount=88000.00,
        currency="USD",
        invoice_date=date(2026, 9, 2),
        payment_status="Pending",
        approval_required=True,
        approval_status="Missing",
    )
    db_session.add(recur_tx)
    await db_session.commit()

    # Evaluate the recurrence transaction
    eval_result = await RuleEngineService.evaluate_transaction(
        transaction_id="TX-1999-RECUR",
        session=db_session,
        auto_create_case=True,
    )

    # Verify R-006 (Recurrence) triggered
    r006 = next((s for s in eval_result.triggered_signals if s.rule_code == "R-006"), None)
    assert r006 is not None, "Rule R-006 must trigger when prior closed case exists for supplier"
    assert r006.triggered is True
    assert r006.weight == 20
    assert r006.score == 20
    assert "TEST-CASE-001" in r006.diagnostics["prior_closed_cases"]

    # Query the newly generated case and verify prior case context is surfaced
    new_case_res = await async_client.get("/api/v1/cases/CASE-2026-1999-RECUR")
    assert new_case_res.status_code == 200
    new_case_data = new_case_res.json()["data"]

    assert len(new_case_data["prior_cases"]) >= 1
    prior_case = new_case_data["prior_cases"][0]
    assert prior_case["case_id"] == "TEST-CASE-001"
    assert prior_case["root_cause"] == "Supplier bank-change verification workflow not completed"
    assert (
        prior_case["corrective_action"]
        == "Require independent verification of supplier banking change and second approval"
    )


@pytest.mark.asyncio
async def test_workbook_t08_duplicate_invoice_r005_detection(db_session: AsyncSession):
    """
    Workbook T08 Acceptance Test: Duplicate Invoice Anomaly Detection.
    Verifies TX-4002 ($78,000) from SUP-004 triggers Rule R-005 referencing prior TX-4001
    with matching invoice number SC-260821.
    """
    result = await RuleEngineService.evaluate_transaction(
        transaction_id="TX-4002",
        session=db_session,
        auto_create_case=True,
    )

    # 1. Rule R-005 triggers with weight 30
    r005 = next((s for s in result.triggered_signals if s.rule_code == "R-005"), None)
    assert r005 is not None
    assert r005.triggered is True
    assert r005.weight == 30
    assert r005.score == 30
    assert "TX-4001" in r005.diagnostics["duplicate_ids"]

    # 2. Case consolidation required
    assert result.case_required is True

    # 3. Associated RiskCase is updated with R-005 signal
    case = await db_session.get(RiskCase, "TEST-CASE-002")
    assert case is not None
    assert case.supplier_id == "SUP-004"
    assert case.transaction_id == "TX-4002"
    assert any(sig["rule_code"] == "R-005" for sig in case.trigger_signals)


@pytest.mark.asyncio
async def test_workbook_t09_normal_case_control_sup002_clean(db_session: AsyncSession):
    """
    Workbook T09 Acceptance Test: Normal-Case Control (Negative Control).
    Processing clean, baseline-conforming transactions for SUP-002 must NOT trigger
    any detection rules or create any spurious risk cases.
    """
    for tx_id in ["TX-2001", "TX-2002"]:
        result = await RuleEngineService.evaluate_transaction(
            transaction_id=tx_id,
            session=db_session,
            auto_create_case=True,
        )

        # 1. Zero triggered signals
        assert len(result.triggered_signals) == 0, f"Spurious rule triggered on normal {tx_id}"
        assert result.total_score == 0
        assert result.priority == "Low"
        assert result.case_required is False

        # 2. No risk case created
        stmt = select(RiskCase).where(RiskCase.transaction_id == tx_id)
        case = (await db_session.execute(stmt)).scalar_one_or_none()
        assert case is None, f"Spurious RiskCase created for normal transaction {tx_id}"
