"""
Unit and Integration Tests for TRIS Rule Engine and Consolidation Pipeline.
Verifies rules R-001 to R-006, additive scoring, and TX-1999 benchmark evaluation (T03-T07).
"""

from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.modules.v1.cases.models.risk_case import RiskCase
from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService
from app.api.modules.v1.rules.service.rule_engine_service import RuleEngineService

DATA_FILE = Path("../test data.xlsx").resolve()


@pytest.fixture(autouse=True)
async def seed_data(db_session: AsyncSession):
    """Seed synthetic test data before running rule engine tests."""
    await IngestionService.ingest_excel_workbook(DATA_FILE, db_session)


@pytest.mark.asyncio
async def test_get_all_rules(async_client: AsyncClient):
    """Verify retrieving all 6 detection rule configurations."""
    res = await async_client.get("/api/v1/rules")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 6
    rule_codes = [r["rule_code"] for r in data]
    assert rule_codes == ["R-001", "R-002", "R-003", "R-004", "R-005", "R-006"]


@pytest.mark.asyncio
async def test_update_rule_increments_version(async_client: AsyncClient):
    """Verify updating rule weight/parameters increments rule_version for audit traceability."""
    res_before = await async_client.get("/api/v1/rules/R-001")
    assert res_before.status_code == 200
    v_initial = res_before.json()["data"]["rule_version"]

    res_patch = await async_client.patch(
        "/api/v1/rules/R-001",
        json={"weight": 40, "threshold_params": {"multiplier": 2.5, "exclude_target": True}},
    )
    assert res_patch.status_code == 200
    data = res_patch.json()["data"]
    assert data["weight"] == 40
    assert data["threshold_params"]["multiplier"] == 2.5
    assert data["rule_version"] == v_initial + 1


@pytest.mark.asyncio
async def test_evaluate_tx_1999_full_benchmark(db_session: AsyncSession):
    """
    Comprehensive Verification of Benchmark Anomaly TX-1999 (Acceptance T03, T04, T05, T06, T07).
    Expected Signals:
      - R-001 (Amount Deviation): Triggered (Weight: 35) -> 3.41x baseline
      - R-002 (Bank Change): Triggered (Weight: 25) -> changed 2 days prior
      - R-003 (Missing Approval): Triggered (Weight: 25) -> $104k requires L3 approval
      - R-004 (Off-Hours Access): Triggered (Weight: 15) -> AE-003 at 22:47
    Total Score: 35 + 25 + 25 + 15 = 100 -> Priority: High
    Consolidates into single risk case: TEST-CASE-001.
    """
    result = await RuleEngineService.evaluate_transaction(
        transaction_id="TX-1999",
        session=db_session,
        auto_create_case=True,
    )

    # 1. Verify Triggered Rules
    triggered_codes = [s.rule_code for s in result.triggered_signals]
    assert "R-001" in triggered_codes  # T03
    assert "R-002" in triggered_codes  # T04
    assert "R-003" in triggered_codes  # T05
    assert "R-004" in triggered_codes  # T06
    assert "R-005" not in triggered_codes
    assert "R-006" not in triggered_codes

    # 2. Verify Composite Score and Priority
    assert result.total_score == 100  # 35 + 25 + 25 + 15
    assert result.priority == "High"
    assert result.case_required is True

    # 3. Verify Consolidated Case Creation (T07)
    statement = select(RiskCase).where(RiskCase.transaction_id == "TX-1999")
    case = (await db_session.execute(statement)).scalar_one_or_none()
    assert case is not None
    assert case.case_id == "TEST-CASE-001"
    assert case.priority == "High"
    assert case.status == "New"
    assert len(case.trigger_signals) == 4
    assert case.evaluation_snapshot["composite_score"] == 100


@pytest.mark.asyncio
async def test_evaluate_tx_endpoint(async_client: AsyncClient):
    """Verify POST /api/v1/rules/evaluate/{tx_id} route."""
    res = await async_client.post("/api/v1/rules/evaluate/TX-1999")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["transaction_id"] == "TX-1999"
    assert data["total_score"] == 100
    assert data["priority"] == "High"
    assert len(data["triggered_signals"]) == 4
