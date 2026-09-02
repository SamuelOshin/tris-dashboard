"""
Developer Acceptance Test Matrix (T01 through T10).
Formally verifies all 10 acceptance criteria defined in TRIS v1.3 Specification.
"""

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
