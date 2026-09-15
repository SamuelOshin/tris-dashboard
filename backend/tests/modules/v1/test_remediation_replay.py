"""Tests for Ticket 8 — Remediation Replay Service.

Verifies:
1. test_remediation_replay_blocks_tx_temp_001:
   - Evaluates proposed corrective control: "Any payment > $50,000 within 7 days of a supplier
     bank-account change requires independent verification."
   - Evaluated against TX-TEMP-001 at 2026-08-28 10:14:00 UTC
     (using HistoricalReconstructionService.reconstruct).
   - Amount: $125,000.00 (> $50,000)
   - Bank change: 2 days prior (within 7 days)
   - Pre-event effective approval: only Level 1 (APP-TEMP-001 at 09:32)
   - Excluded late approval: Level 2 (APP-TEMP-002 at 11:06)
   - Level 2 independent verification missing at event time -> returns BLOCK/PREVENT.
   - Strict return of one of ALLOW | ESCALATE/HOLD | BLOCK/PREVENT | NOT DETERMINABLE.

2. test_replay_does_not_mutate_original_case:
   - Captures a full snapshot of RiskCase, CaseHistory, RuleConfig, Transaction,
     Approval, Supplier, and AccessEvent records before replay.
   - Executes remediation replay.
   - Captures post-state snapshot of all tables.
   - Asserts diff is completely empty (zero mutation to historical tables).

3. Additional edge-case verifications:
   - Independent verification present -> ALLOW.
   - Amount below $50,000 threshold -> ALLOW.
   - Bank change outside 7-day window -> ALLOW.
   - Missing evidence -> NOT DETERMINABLE.
   - Proposed controls stored separately from RuleConfig.
   - HTTP API endpoint integration for replay simulation.
"""

import json
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import (
    DatabaseIntegrityError,
    NotFoundError,
)
from app.api.modules.v1.access_events.models.access_event import AccessEvent
from app.api.modules.v1.approvals.models.approval import Approval
from app.api.modules.v1.cases.models.risk_case import CaseHistory, RiskCase
from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService
from app.api.modules.v1.reconstruction.schemas.reconstruction_schemas import (
    EvidenceCompleteness,
    ReconstructionResult,
    SupplierStateAtEvent,
    TransactionStateAtEvent,
)
from app.api.modules.v1.remediation.models.proposed_control import ProposedControl
from app.api.modules.v1.remediation.models.remediation_replay_result import (
    RemediationReplayResult,
)
from app.api.modules.v1.remediation.schemas.remediation_schemas import (
    ProposedControlCreate,
)
from app.api.modules.v1.remediation.service.remediation_service import (
    DEFAULT_PROPOSED_CONTROL_ID,
    VALID_DETERMINATIONS,
    RemediationService,
)
from app.api.modules.v1.rules.models.rule_config import RuleConfig
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.api.modules.v1.transactions.models.transaction import Transaction

DATA_FILE_V13 = Path(__file__).resolve().parents[4] / "test data.xlsx"

# Canonical event timestamp for TX-TEMP-001 (August 28, 2026, 10:14:00 UTC)
TEMP_EVENT_TS = datetime(2026, 8, 28, 10, 14, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
async def setup_test_data(db_session: AsyncSession):
    """Seed v1.3 baseline and isolated v1.4 temporal fixture before each test."""
    await IngestionService.ingest_excel_workbook(DATA_FILE_V13, db_session)
    await IngestionService.ingest_temporal_fixture(db_session)
    await RemediationService.get_or_create_default_proposed_control(db_session)


# ---------------------------------------------------------------------------
# Test 1 — Remediation Replay Blocks TX-TEMP-001 (Primary Acceptance Test)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remediation_replay_blocks_tx_temp_001(db_session: AsyncSession):
    """
    ACCEPTANCE CRITERION 1 & 4 (Ticket 8):
    Replay of proposed control against TX-TEMP-001 at 2026-08-28 10:14:00 UTC MUST:
      - Evaluate against reconstructed historical state
        (HistoricalReconstructionService.reconstruct).
      - Identify payment amount $125,000 (> $50,000).
      - Identify bank account change was 2 days prior (within 7 days).
      - Identify that Level 2 independent verification was missing at event time
        (only Level 1 pre-event approval was effective; Level 2 was recorded at 11:06 post-event).
      - Return determination: 'BLOCK/PREVENT'.
      - Strictly return one of: ALLOW | ESCALATE/HOLD | BLOCK/PREVENT | NOT DETERMINABLE.
      - Return side-by-side comparison (original outcome vs proposed control outcome).
    """
    result = await RemediationService.replay(
        transaction_id="TX-TEMP-001",
        session=db_session,
        event_timestamp=TEMP_EVENT_TS,
        control_id=DEFAULT_PROPOSED_CONTROL_ID,
        case_id="CASE-TEMP-001",
        executed_by="risk_reviewer",
        persist=True,
    )

    # 1. Determination must be strictly in the accepted four states
    assert result.replay_determination in VALID_DETERMINATIONS, (
        f"Determination '{result.replay_determination}' must be one of {VALID_DETERMINATIONS}"
    )

    # 2. For TX-TEMP-001, determination must be BLOCK/PREVENT
    assert result.replay_determination == "BLOCK/PREVENT", (
        f"Expected 'BLOCK/PREVENT' for TX-TEMP-001 at 10:14 UTC. "
        f"Got: '{result.replay_determination}'. Explanation: {result.explanation}"
    )

    # 3. Proposed control outcome must match determination
    assert result.proposed_control_outcome == "BLOCK/PREVENT"

    # 4. Side-by-side: original reconstruction outcome was FAIL
    assert result.original_outcome == "FAIL"

    # 5. Driving facts validation
    facts = result.driving_facts
    assert facts["amount"] == 125000.0, f"Expected amount 125000.0, got {facts['amount']}"
    assert facts["amount_threshold"] == 50000.0
    assert facts["amount_exceeded"] is True
    assert facts["bank_change_date"] == "2026-08-26"
    assert facts["bank_changed_within_window"] is True
    assert facts["requires_independent_verification"] is True
    assert facts["required_approval_level"] == "Level 2"
    assert facts["effective_highest_approval_level"] == "Level 1"
    assert facts["independent_verification_present"] is False

    # 6. Excluded late approval facts
    assert facts["excluded_late_approvals_count"] == 1
    assert "APP-TEMP-002" in facts["excluded_late_approval_ids"]

    # 7. Explanation contains plain-language justification
    assert "BLOCK/PREVENT" in result.explanation
    assert "$125,000.00" in result.explanation
    assert "Level 2" in result.explanation


# ---------------------------------------------------------------------------
# Test 2 — Replay Does Not Mutate Original Case / Tables (Snapshot Diff Proof)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_replay_does_not_mutate_original_case(db_session: AsyncSession):
    """
    ACCEPTANCE CRITERION 5 (Ticket 8):
    Capture a full snapshot of case, rule, history, transaction, approval,
    supplier, and access event records before replay, run replay, capture again.
    Diff MUST be completely empty.

    Proves that remediation replay is strictly read-only against original tables.
    """

    async def capture_database_snapshot() -> dict[str, list[dict]]:
        cases = (
            (await db_session.execute(select(RiskCase).order_by(RiskCase.case_id))).scalars().all()
        )
        history = (
            (await db_session.execute(select(CaseHistory).order_by(CaseHistory.history_id)))
            .scalars()
            .all()
        )
        rules = (
            (await db_session.execute(select(RuleConfig).order_by(RuleConfig.rule_code)))
            .scalars()
            .all()
        )
        txs = (
            (await db_session.execute(select(Transaction).order_by(Transaction.transaction_id)))
            .scalars()
            .all()
        )
        approvals = (
            (await db_session.execute(select(Approval).order_by(Approval.approval_id)))
            .scalars()
            .all()
        )
        suppliers = (
            (await db_session.execute(select(Supplier).order_by(Supplier.supplier_id)))
            .scalars()
            .all()
        )
        access = (
            (await db_session.execute(select(AccessEvent).order_by(AccessEvent.event_id)))
            .scalars()
            .all()
        )

        return {
            "cases": [c.model_dump(mode="json") for c in cases],
            "history": [h.model_dump(mode="json") for h in history],
            "rules": [r.model_dump(mode="json") for r in rules],
            "transactions": [t.model_dump(mode="json") for t in txs],
            "approvals": [a.model_dump(mode="json") for a in approvals],
            "suppliers": [s.model_dump(mode="json") for s in suppliers],
            "access_events": [e.model_dump(mode="json") for e in access],
        }

    # 1. Capture complete snapshot before running replay
    snapshot_before = await capture_database_snapshot()

    # 2. Execute remediation replay with persistence
    replay_result = await RemediationService.replay(
        transaction_id="TX-TEMP-001",
        session=db_session,
        event_timestamp=TEMP_EVENT_TS,
        control_id=DEFAULT_PROPOSED_CONTROL_ID,
        case_id="CASE-TEMP-001",
        executed_by="reviewer",
        persist=True,
    )
    assert replay_result.replay_determination == "BLOCK/PREVENT"

    # 3. Capture complete snapshot after running replay
    snapshot_after = await capture_database_snapshot()

    # 4. Calculate detailed row-by-row and field-by-field diff across every table
    diffs: dict[str, list[str]] = {}
    for table_name in snapshot_before:
        rows_before = snapshot_before[table_name]
        rows_after = snapshot_after[table_name]
        if rows_before != rows_after:
            table_diffs: list[str] = []
            if len(rows_before) != len(rows_after):
                table_diffs.append(
                    f"Row count mismatch: before={len(rows_before)}, after={len(rows_after)}"
                )
            for idx, (rb, ra) in enumerate(zip(rows_before, rows_after, strict=False)):
                if rb != ra:
                    field_changes = {
                        k: {"before": rb.get(k), "after": ra.get(k)}
                        for k in set(rb) | set(ra)
                        if rb.get(k) != ra.get(k)
                    }
                    table_diffs.append(f"Row {idx} changed: {field_changes}")
            diffs[table_name] = table_diffs

    # Diff must be completely empty
    diff_str = json.dumps(diffs, indent=2)
    proof_msg = diff_str if diffs else "ZERO DIFF (byte-for-byte identical)"
    print(f"\n[Ticket 8 Snapshot Diff Proof] Result: {proof_msg}")
    assert not diffs, (
        f"Data mutation detected! Historical tables were altered during replay:\n{diff_str}"
    )

    # 5. Verify only remediation_replay_results recorded the simulation run
    replays = (await db_session.execute(select(RemediationReplayResult))).scalars().all()
    assert len(replays) >= 1
    assert any(r.transaction_id == "TX-TEMP-001" for r in replays)


# ---------------------------------------------------------------------------
# Test 3 — Proposed Control Stored Separately from RuleConfig
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_proposed_control_stored_separately_from_rule_configs(db_session: AsyncSession):
    """
    ACCEPTANCE CRITERION 2 (Ticket 8):
    Proposed control definitions and simulation runs must be stored separately
    from active / historical rule configuration (RuleConfig history).
    Never overwrites or version-merges into RuleConfig.
    """
    # Capture rules before creating proposed control
    rules_before = (await db_session.execute(select(RuleConfig))).scalars().all()
    rule_codes_before = {r.rule_code for r in rules_before}

    # Create a new proposed control
    new_control = await RemediationService.create_proposed_control(
        control_in=ProposedControlCreate(
            control_id="PROP-CTRL-TEST-002",
            name="Test Verification Control",
            description="Payment above $25k requires Level 1 approval.",
            amount_threshold=25000.0,
            bank_change_window_days=14,
            required_approval_level="Level 1",
            action_policy="ESCALATE/HOLD",
        ),
        session=db_session,
        user_id="process_owner_01",
    )

    assert new_control.control_id == "PROP-CTRL-TEST-002"

    # Query RuleConfig — must NOT contain the new proposed control
    rules_after = (await db_session.execute(select(RuleConfig))).scalars().all()
    rule_codes_after = {r.rule_code for r in rules_after}

    assert rule_codes_before == rule_codes_after, (
        "RuleConfig was mutated by proposed control creation!"
    )
    assert "PROP-CTRL-TEST-002" not in rule_codes_after

    # Proposed controls table contains the new record
    stored_control = await db_session.get(ProposedControl, "PROP-CTRL-TEST-002")
    assert stored_control is not None
    assert stored_control.action_policy == "ESCALATE/HOLD"


# ---------------------------------------------------------------------------
# Test 4 — Edge Case: Independent Verification Present -> ALLOW
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remediation_replay_allows_when_independent_verification_present(
    db_session: AsyncSession,
):
    """
    When conditions trigger (amount > $50k and bank change within 7 days)
    AND a Level 2 approval WAS effective before the event timestamp,
    the proposed control is satisfied -> determination is ALLOW.
    """
    # Insert a synthetic pre-event Level 2 approval for a test transaction
    tx_allowed = Transaction(
        transaction_id="TX-PROP-ALLOW",
        supplier_id="SUP-TEMP-001",  # Bank changed 2026-08-26
        invoice_number="INV-ALLOW-01",
        amount=75000.0,  # > $50,000
        currency="USD",
        invoice_date=date(2026, 8, 28),
        posting_date=date(2026, 8, 28),
        approval_required=True,
        approval_status="Approved",
        created_at=datetime(2026, 8, 28, 10, 14, 0, tzinfo=UTC),
    )
    # Pre-event Level 2 approval recorded at 09:15 UTC (before 10:14)
    app_allowed = Approval(
        approval_id="APP-PROP-ALLOW-01",
        transaction_id="TX-PROP-ALLOW",
        required_level="Level 2",
        approver_name="Senior Controller",
        approver_role="Finance Director",
        approval_status="Approved",
        approval_date=datetime(2026, 8, 28, 9, 15, 0, tzinfo=UTC),
        notes="Pre-event independent verification satisfied",
        created_at=datetime(2026, 8, 28, 9, 15, 0, tzinfo=UTC),
    )
    db_session.add(tx_allowed)
    await db_session.flush()
    db_session.add(app_allowed)
    await db_session.commit()

    # Replay
    result = await RemediationService.replay(
        transaction_id="TX-PROP-ALLOW",
        session=db_session,
        event_timestamp=TEMP_EVENT_TS,
        control_id=DEFAULT_PROPOSED_CONTROL_ID,
        persist=False,
    )

    assert result.replay_determination == "ALLOW"
    assert result.proposed_control_outcome == "ALLOW"
    assert result.driving_facts["independent_verification_present"] is True
    assert "PROPOSED CONTROL SATISFIED" in result.explanation


# ---------------------------------------------------------------------------
# Test 5 — Edge Case: Amount Below Threshold -> ALLOW
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remediation_replay_allows_when_amount_below_threshold(db_session: AsyncSession):
    """
    When payment amount is <= $50,000 (even with a recent bank change),
    the proposed control does not trigger -> determination is ALLOW.
    """
    tx_small = Transaction(
        transaction_id="TX-PROP-SMALL",
        supplier_id="SUP-TEMP-001",  # Bank changed 2026-08-26
        invoice_number="INV-SMALL-01",
        amount=35000.0,  # <= $50,000
        currency="USD",
        invoice_date=date(2026, 8, 28),
        posting_date=date(2026, 8, 28),
        approval_required=True,
        approval_status="Approved",
        created_at=datetime(2026, 8, 28, 10, 14, 0, tzinfo=UTC),
    )
    db_session.add(tx_small)
    await db_session.commit()

    result = await RemediationService.replay(
        transaction_id="TX-PROP-SMALL",
        session=db_session,
        event_timestamp=TEMP_EVENT_TS,
        control_id=DEFAULT_PROPOSED_CONTROL_ID,
        persist=False,
    )

    assert result.replay_determination == "ALLOW"
    assert result.driving_facts["amount_exceeded"] is False
    assert result.driving_facts["requires_independent_verification"] is False
    assert "PROPOSED CONTROL NOT TRIGGERED" in result.explanation


# ---------------------------------------------------------------------------
# Test 6 — Edge Case: Missing Evidence -> NOT DETERMINABLE
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remediation_replay_returns_not_determinable_on_missing_evidence(
    db_session: AsyncSession,
):
    """
    When critical evidence (such as approval records) was never captured,
    reconstruction yields UNKNOWN and replay MUST return NOT DETERMINABLE.
    Never infers ALLOW when evidence is missing.
    """
    # Create transaction with NO approval records whatsoever
    tx_no_evidence = Transaction(
        transaction_id="TX-NO-EVIDENCE",
        supplier_id="SUP-TEMP-001",
        invoice_number="INV-NO-EV-01",
        amount=100000.0,
        currency="USD",
        invoice_date=date(2026, 8, 28),
        posting_date=date(2026, 8, 28),
        approval_required=True,
        approval_status="Missing",
        created_at=datetime(2026, 8, 28, 10, 14, 0, tzinfo=UTC),
    )
    db_session.add(tx_no_evidence)
    await db_session.commit()

    result = await RemediationService.replay(
        transaction_id="TX-NO-EVIDENCE",
        session=db_session,
        event_timestamp=TEMP_EVENT_TS,
        control_id=DEFAULT_PROPOSED_CONTROL_ID,
        persist=False,
    )

    assert result.replay_determination == "NOT DETERMINABLE"
    assert result.proposed_control_outcome == "NOT DETERMINABLE"
    assert "NOT DETERMINABLE" in result.explanation


# ---------------------------------------------------------------------------
# Test 7 — Replay API Endpoints Integration Test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remediation_replay_api_endpoints(async_client: AsyncClient):
    """
    Tests REST API endpoints:
    - GET /api/v1/remediation/controls
    - POST /api/v1/remediation/replay
    - GET /api/v1/remediation/replays
    """
    # 1. List proposed controls
    res = await async_client.get("/api/v1/remediation/controls")
    assert res.status_code == 200
    controls_data = res.json()["data"]
    assert len(controls_data) >= 1
    assert any(c["control_id"] == "PROP-CTRL-001" for c in controls_data)

    # 2. Execute replay via POST /api/v1/remediation/replay
    payload = {
        "transaction_id": "TX-TEMP-001",
        "event_timestamp": TEMP_EVENT_TS.isoformat(),
        "control_id": "PROP-CTRL-001",
        "case_id": "CASE-TEMP-001",
        "persist": True,
    }
    res_replay = await async_client.post("/api/v1/remediation/replay", json=payload)
    assert res_replay.status_code == 200
    replay_json = res_replay.json()["data"]
    assert replay_json["replay_determination"] == "BLOCK/PREVENT"
    assert replay_json["original_outcome"] == "FAIL"
    assert replay_json["proposed_control_outcome"] == "BLOCK/PREVENT"
    assert replay_json["replay_id"] is not None

    # 3. Retrieve past replays
    res_list = await async_client.get("/api/v1/remediation/replays?transaction_id=TX-TEMP-001")
    assert res_list.status_code == 200
    replays_list = res_list.json()["data"]
    assert len(replays_list) >= 1
    assert replays_list[0]["replay_determination"] == "BLOCK/PREVENT"

    # 4. Retrieve single replay
    replay_id = replay_json["replay_id"]
    res_single = await async_client.get(f"/api/v1/remediation/replays/{replay_id}")
    assert res_single.status_code == 200
    assert res_single.json()["data"]["replay_id"] == replay_id


# ---------------------------------------------------------------------------
# Test 8 — Edge Case: Bank Change Outside Window -> ALLOW
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remediation_replay_allows_when_bank_change_outside_window(
    db_session: AsyncSession,
):
    """
    When bank account change occurred outside the 7-day window (e.g. 18 days prior),
    the proposed control does not trigger -> determination is ALLOW.
    """
    # Supplier with bank change on August 10, 2026 (18 days before August 28)
    sup_old = Supplier(
        supplier_id="SUP-OLD-BANK",
        name="Old Bank Supplier Ltd",
        category="Hardware",
        risk_tier="Low",
        bank_change_date=date(2026, 8, 10),
        status="Active",
    )
    tx_old_bank = Transaction(
        transaction_id="TX-OLD-BANK-01",
        supplier_id="SUP-OLD-BANK",
        invoice_number="INV-OLD-01",
        amount=85000.0,  # > $50,000
        currency="USD",
        invoice_date=date(2026, 8, 28),
        posting_date=date(2026, 8, 28),
        approval_required=True,
        approval_status="Approved",
        created_at=datetime(2026, 8, 28, 10, 14, 0, tzinfo=UTC),
    )
    db_session.add(sup_old)
    db_session.add(tx_old_bank)
    await db_session.commit()

    result = await RemediationService.replay(
        transaction_id="TX-OLD-BANK-01",
        session=db_session,
        event_timestamp=TEMP_EVENT_TS,
        control_id=DEFAULT_PROPOSED_CONTROL_ID,
        persist=False,
    )

    assert result.replay_determination == "ALLOW"
    assert result.proposed_control_outcome == "ALLOW"
    assert result.driving_facts["amount_exceeded"] is True
    assert result.driving_facts["bank_changed_within_window"] is False
    assert result.driving_facts["requires_independent_verification"] is False
    assert "No supplier bank-account change occurred within" in result.explanation


# ---------------------------------------------------------------------------
# Test 9 — Configurable Action Policy: ESCALATE/HOLD Determination
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remediation_replay_escalate_hold_action_policy(db_session: AsyncSession):
    """
    Verifies that a proposed control configured with action_policy='ESCALATE/HOLD'
    returns determination 'ESCALATE/HOLD' when control condition triggers.
    """
    control_escalate = await RemediationService.create_proposed_control(
        control_in=ProposedControlCreate(
            control_id="PROP-CTRL-HOLD-01",
            name="Escalate/Hold Verification Control",
            description="Hold payments > $50k post bank change",
            amount_threshold=50000.0,
            bank_change_window_days=7,
            required_approval_level="Level 2",
            action_policy="ESCALATE/HOLD",
        ),
        session=db_session,
        user_id="risk_reviewer",
    )
    assert control_escalate.action_policy == "ESCALATE/HOLD"

    result = await RemediationService.replay(
        transaction_id="TX-TEMP-001",
        session=db_session,
        event_timestamp=TEMP_EVENT_TS,
        control_id="PROP-CTRL-HOLD-01",
        persist=False,
    )

    assert result.replay_determination == "ESCALATE/HOLD"
    assert result.proposed_control_outcome == "ESCALATE/HOLD"
    assert "Action: ESCALATE/HOLD" in result.explanation


# ---------------------------------------------------------------------------
# Test 10 — Data-Access Layer Read-Only Enforcement Against Dirty Entities
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_replay_data_access_layer_blocks_mutation(db_session: AsyncSession):
    """
    Enforces that if any entity is modified in the active session,
    the data-access layer guard raises DatabaseIntegrityError.
    Proves that read-only enforcement is active at the data-access layer.
    """
    # Load an existing case and dirty it
    case_res = await db_session.execute(select(RiskCase).limit(1))
    case = case_res.scalar_one_or_none()
    assert case is not None

    # Mutate the case in session
    case.priority = "Low"
    assert case in db_session.dirty

    # Attempting replay with dirty session MUST fail with DatabaseIntegrityError
    with pytest.raises(DatabaseIntegrityError) as exc_info:
        await RemediationService.replay(
            transaction_id="TX-TEMP-001",
            session=db_session,
            event_timestamp=TEMP_EVENT_TS,
            persist=False,
        )

    assert "Data-access layer violation" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Test 11 — NotFoundError on Invalid / Non-Existent Transaction
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_replay_raises_not_found_on_invalid_transaction(
    db_session: AsyncSession,
    async_client: AsyncClient,
):
    """
    Replay against a non-existent transaction must raise NotFoundError
    and return HTTP 404 via the API.
    """
    # Service call raises NotFoundError
    with pytest.raises(NotFoundError):
        await RemediationService.replay(
            transaction_id="TX-DOES-NOT-EXIST-999",
            session=db_session,
            event_timestamp=TEMP_EVENT_TS,
            persist=False,
        )

    # API call returns 404
    payload = {
        "transaction_id": "TX-DOES-NOT-EXIST-999",
        "event_timestamp": TEMP_EVENT_TS.isoformat(),
        "control_id": "PROP-CTRL-001",
        "persist": False,
    }
    res = await async_client.post("/api/v1/remediation/replay", json=payload)
    assert res.status_code == 404
    assert res.json()["error_code"] == "NOT_FOUND"


# ---------------------------------------------------------------------------
# Test 12 — Evaluation Resilience: None approval_state Handling
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_replay_handles_none_approval_state(db_session: AsyncSession):
    """
    Directly tests _evaluate_control when reconstruction.approval_state is None.
    Must evaluate without AttributeError:
    - If amount <= threshold: returns ALLOW.
    - If amount > threshold & bank changed: returns NOT DETERMINABLE.
    """
    control = await RemediationService.get_or_create_default_proposed_control(db_session)

    # Case A: Below threshold + None approval_state -> ALLOW
    rec_below = ReconstructionResult(
        transaction_id="TX-TEST-NONE-APP",
        case_id=None,
        event_timestamp=TEMP_EVENT_TS,
        outcome="UNKNOWN",
        explanation="Test",
        transaction_state=TransactionStateAtEvent(
            transaction_id="TX-TEST-NONE-APP",
            amount=25000.0,  # <= $50,000
            currency="USD",
            invoice_date="2026-08-28",
            approval_required=False,
            approval_status_at_event="Approved",
            provenance=[],
        ),
        supplier_state=SupplierStateAtEvent(
            supplier_id="SUP-TEMP-001",
            name="Test Supplier",
            category="IT",
            risk_tier="Low",
            bank_change_date="2026-08-26",
            bank_changed_within_7_days=True,
            provenance=[],
        ),
        approval_state=None,  # Deliberately None
        evidence_completeness=EvidenceCompleteness(
            supplier_state="COMPLETE",
            approval_state="MISSING",
            access_state="COMPLETE",
            transaction_state="COMPLETE",
            rule_version="COMPLETE",
            overall="PARTIAL",
        ),
    )

    det, out, expl, facts = RemediationService._evaluate_control(
        control=control,
        reconstruction=rec_below,
        event_timestamp=TEMP_EVENT_TS,
    )
    assert det == "ALLOW"
    assert out == "ALLOW"
    assert facts["effective_highest_approval_level"] is None
    assert facts["effective_approvals_count"] == 0

    # Case B: Above threshold + recent bank change + None approval_state -> NOT DETERMINABLE
    rec_above = ReconstructionResult(
        transaction_id="TX-TEST-NONE-APP-2",
        case_id=None,
        event_timestamp=TEMP_EVENT_TS,
        outcome="UNKNOWN",
        explanation="Test",
        transaction_state=TransactionStateAtEvent(
            transaction_id="TX-TEST-NONE-APP-2",
            amount=90000.0,  # > $50,000
            currency="USD",
            invoice_date="2026-08-28",
            approval_required=True,
            approval_status_at_event="Missing",
            provenance=[],
        ),
        supplier_state=SupplierStateAtEvent(
            supplier_id="SUP-TEMP-001",
            name="Test Supplier",
            category="IT",
            risk_tier="Low",
            bank_change_date="2026-08-26",
            bank_changed_within_7_days=True,
            provenance=[],
        ),
        approval_state=None,  # Deliberately None
        evidence_completeness=EvidenceCompleteness(
            supplier_state="COMPLETE",
            approval_state="MISSING",
            access_state="COMPLETE",
            transaction_state="COMPLETE",
            rule_version="COMPLETE",
            overall="PARTIAL",
        ),
    )

    det2, out2, expl2, facts2 = RemediationService._evaluate_control(
        control=control,
        reconstruction=rec_above,
        event_timestamp=TEMP_EVENT_TS,
    )
    assert det2 == "NOT DETERMINABLE"
    assert out2 == "NOT DETERMINABLE"
    assert "NOT DETERMINABLE" in expl2
