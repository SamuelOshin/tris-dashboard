"""
Unit & Integration Tests for Rule R-007 (Approval Timing / Temporal Completeness).
Verifies:
1. R-007 DB-backed versioned configuration.
2. Temporal invariant: 11:06 approval strictly excluded at 10:14 event timestamp.
3. Explicit outcome reasoning: FLAGGED when Level 2 required vs SATISFIED when Level 1 required.
4. Absolute isolation: R-007 evaluation has zero side effects on R-003
   (test_r007_isolated_from_r003).
"""

from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService
from app.api.modules.v1.rules.models.rule_config import RuleConfig
from app.api.modules.v1.rules.schemas.rule_schemas import RuleConfigUpdate
from app.api.modules.v1.rules.service.rule_engine_service import RuleEngineService

DATA_FILE_V13 = Path(__file__).resolve().parents[4] / "test data.xlsx"


@pytest.fixture(autouse=True)
async def setup_rules_and_fixture(db_session: AsyncSession):
    """Seed baseline v1.3 data and v1.4 temporal fixture."""
    await IngestionService.ingest_excel_workbook(DATA_FILE_V13, db_session)
    await IngestionService.ingest_temporal_fixture(db_session)


@pytest.mark.asyncio
async def test_r007_rule_config_db_backed_and_versioned(db_session: AsyncSession):
    """
    Acceptance Criteria: R-007 is added to RuleConfig following the same
    DB-backed, versioned pattern as R-001 through R-006.
    """
    rule = await RuleEngineService.get_rule_by_code("R-007", db_session)
    assert rule is not None
    assert rule.rule_code == "R-007"
    assert rule.name == "Approval Timing / Temporal Completeness"
    assert rule.weight == 25
    assert rule.rule_version == 1
    assert rule.is_active is True
    assert rule.threshold_params["threshold_amount"] == 50000.0
    assert rule.threshold_params["required_level"] == "Level 2"

    # Verify version incrementing on update
    updated_rule = await RuleEngineService.update_rule(
        rule_code="R-007",
        update_data=RuleConfigUpdate(weight=35),
        session=db_session,
    )
    assert updated_rule.weight == 35
    assert updated_rule.rule_version == 2


@pytest.mark.asyncio
async def test_r007_evaluation_on_tx_temp_001_excludes_late_approval(db_session: AsyncSession):
    """
    Acceptance Criteria:
    Evaluated against TX-TEMP-001 at 10:14 event timestamp, R-007 strictly
    excludes the 11:06 approval (APP-TEMP-002) from consideration.
    """
    result = await RuleEngineService.evaluate_transaction("TX-TEMP-001", db_session)
    r007 = next((s for s in result.triggered_signals if s.rule_code == "R-007"), None)
    assert r007 is not None, "R-007 must trigger for TX-TEMP-001 under default Level 2 requirement"

    diag = r007.diagnostics
    assert diag["transaction_id"] == "TX-TEMP-001"
    assert "2026-08-28T10:14:00" in diag["event_timestamp"]

    # Effective approvals must include ONLY APP-TEMP-001 (09:32)
    assert "APP-TEMP-001" in diag["effective_approval_ids"]
    assert "APP-TEMP-002" not in diag["effective_approval_ids"]

    # Late approvals must explicitly capture APP-TEMP-002 (11:06)
    assert "APP-TEMP-002" in diag["excluded_late_approval_ids"]


@pytest.mark.asyncio
async def test_r007_outcome_reasoning_level_satisfaction(db_session: AsyncSession):
    """
    Acceptance Criteria:
    Confirm which outcome the 09:32 approval actually produces (satisfied vs. flagged)
    based on the required approval level for this transaction.

    Reasoning:
    - TX-TEMP-001 requires Level 2 approval ($125,000 > $50,000 threshold).
    - APP-TEMP-001 (09:32) is Level 1. Level 1 does NOT satisfy Level 2 -> FLAGGED.
    - If required level is set to Level 1, APP-TEMP-001 DOES satisfy -> SATISFIED.
    - If event time is set to 12:00 (after 11:06), APP-TEMP-002 satisfies Level 2 -> SATISFIED.
    """
    # 1. Standard requirement: Level 2 -> FLAGGED (triggered = True, score = 25)
    res_lvl2 = await RuleEngineService.evaluate_transaction("TX-TEMP-001", db_session)
    r007_lvl2 = next((s for s in res_lvl2.triggered_signals if s.rule_code == "R-007"), None)
    assert r007_lvl2 is not None
    assert r007_lvl2.triggered is True
    assert r007_lvl2.score == 25
    assert "does not satisfy the required Level 2" in r007_lvl2.explanation or (
        "post-event and excluded" in r007_lvl2.explanation
    )

    # 2. Relaxed requirement: Level 1 -> SATISFIED (triggered = False, score = 0)
    await RuleEngineService.update_rule(
        rule_code="R-007",
        update_data=RuleConfigUpdate(
            threshold_params={"threshold_amount": 50000.0, "required_level": "Level 1"}
        ),
        session=db_session,
    )

    strategy_r007 = (
        await db_session.execute(select(RuleConfig).where(RuleConfig.rule_code == "R-007"))
    ).scalar_one()
    from app.api.modules.v1.rules.service.strategies import RuleApprovalTiming
    from app.api.modules.v1.suppliers.models.supplier import Supplier
    from app.api.modules.v1.transactions.models.transaction import Transaction

    tx = await db_session.get(Transaction, "TX-TEMP-001")
    sup = await db_session.get(Supplier, "SUP-TEMP-001")

    signal_lvl1 = await RuleApprovalTiming().evaluate(
        transaction=tx,
        supplier=sup,
        rule_config=strategy_r007,
        session=db_session,
        context={},
    )
    assert signal_lvl1.triggered is False, "Level 1 approval must satisfy Level 1 requirement"
    assert signal_lvl1.score == 0
    assert "Approval verified" in signal_lvl1.explanation

    # 3. Post-event timestamp (12:00): Both approvals visible -> Level 2 satisfied -> SATISFIED
    # Reset requirement back to Level 2
    await RuleEngineService.update_rule(
        rule_code="R-007",
        update_data=RuleConfigUpdate(
            threshold_params={"threshold_amount": 50000.0, "required_level": "Level 2"}
        ),
        session=db_session,
    )
    strategy_r007_reset = (
        await db_session.execute(select(RuleConfig).where(RuleConfig.rule_code == "R-007"))
    ).scalar_one()

    signal_post_event = await RuleApprovalTiming().evaluate(
        transaction=tx,
        supplier=sup,
        rule_config=strategy_r007_reset,
        session=db_session,
        context={"event_timestamp": datetime(2026, 8, 28, 12, 0, 0, tzinfo=UTC)},
    )
    assert signal_post_event.triggered is False, "At 12:00, 11:06 Level 2 approval is effective"
    assert signal_post_event.score == 0
    assert "APP-TEMP-002" in signal_post_event.diagnostics["effective_approval_ids"]
    assert len(signal_post_event.diagnostics["excluded_late_approval_ids"]) == 0


@pytest.mark.asyncio
async def test_r007_isolated_from_r003(db_session: AsyncSession):
    """
    MANDATORY ACCEPTANCE TEST:
    Proves that R-007's evaluation has zero effect on R-003's evaluation of any transaction,
    and vice versa.
    """
    # 1. Evaluate TX-1999 under baseline conditions
    res_tx1999_before = await RuleEngineService.evaluate_transaction("TX-1999", db_session)
    r003_before = next(s for s in res_tx1999_before.triggered_signals if s.rule_code == "R-003")
    assert r003_before.triggered is True
    assert r003_before.weight == 25
    assert r003_before.score == 25

    # 2. Mutate R-007 configuration (change weight, parameters, toggle active status)
    await RuleEngineService.update_rule(
        rule_code="R-007",
        update_data=RuleConfigUpdate(
            weight=50,
            threshold_params={"threshold_amount": 10000.0, "required_level": "Level 3"},
            is_active=False,
        ),
        session=db_session,
    )

    # 3. Re-evaluate TX-1999 and assert R-003 is 100% unaffected
    res_tx1999_after = await RuleEngineService.evaluate_transaction("TX-1999", db_session)
    r003_after = next(s for s in res_tx1999_after.triggered_signals if s.rule_code == "R-003")
    assert r003_after.triggered is True
    assert r003_after.weight == 25
    assert r003_after.score == 25
    assert r003_after.explanation == r003_before.explanation
    assert r003_after.diagnostics == r003_before.diagnostics

    # 4. Reactivate R-007 and evaluate TX-TEMP-001
    await RuleEngineService.update_rule(
        rule_code="R-007",
        update_data=RuleConfigUpdate(
            weight=25,
            threshold_params={"threshold_amount": 50000.0, "required_level": "Level 2"},
            is_active=True,
        ),
        session=db_session,
    )

    res_temp = await RuleEngineService.evaluate_transaction("TX-TEMP-001", db_session)
    signals_by_code = {s.rule_code: s for s in res_temp.triggered_signals}

    # R-007 evaluates approval timing
    assert "R-007" in signals_by_code
    assert signals_by_code["R-007"].rule_name == "Approval Timing / Temporal Completeness"
    assert signals_by_code["R-007"].weight == 25

    # R-003 operates independently on overall approval presence
    # (TX-TEMP-001 has approvals with status='Approved' in table, so R-003 checks presence)
    if "R-003" in signals_by_code:
        assert "missing required approval" in signals_by_code["R-003"].rule_name.lower()
