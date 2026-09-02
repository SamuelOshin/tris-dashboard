"""
Unit and Integration Tests for Case Lifecycle, State Machine, and Verified Closure.
Verifies state machine governance, 8-field closure gatekeeper, and audit integrity (T08, T09, T10).
"""

from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.ingestion.service.ingestion_service import IngestionService

DATA_FILE = Path("../test data.xlsx").resolve()


@pytest.fixture(autouse=True)
async def seed_data(db_session: AsyncSession):
    """Seed synthetic test data before running case lifecycle tests."""
    await IngestionService.ingest_excel_workbook(DATA_FILE, db_session)


@pytest.mark.asyncio
async def test_get_all_cases(async_client: AsyncClient):
    """Verify listing cases and filtering."""
    res = await async_client.get("/api/v1/cases")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) >= 2
    case_ids = [c["case_id"] for c in data]
    assert "TEST-CASE-001" in case_ids


@pytest.mark.asyncio
async def test_get_case_with_chronological_history(async_client: AsyncClient):
    """Verify case detail returns complete chronological audit history."""
    res = await async_client.get("/api/v1/cases/TEST-CASE-001")
    assert res.status_code == 200
    case = res.json()["data"]
    assert case["case_id"] == "TEST-CASE-001"
    assert "history" in case
    assert len(case["history"]) >= 1
    assert case["history"][0]["new_status"] == "New"


@pytest.mark.asyncio
async def test_invalid_state_transition_rejected(async_client: AsyncClient):
    """
    State Machine Boundary Test (Acceptance T08).
    Attempting to jump from 'New' directly to 'Closed' MUST fail with 409 Conflict.
    """
    res = await async_client.post(
        "/api/v1/cases/TEST-CASE-001/transition",
        json={"to_status": "Closed", "actor": "rogue_user", "note": "Trying to bypass governance"},
    )
    assert res.status_code == 409
    error = res.json()
    assert error["status"] == "ERROR"
    assert error["error_code"] == "INVALID_STATE_TRANSITION"


@pytest.mark.asyncio
async def test_verified_closure_8_field_validation(async_client: AsyncClient):
    """
    Verified Closure Gatekeeper Test (Acceptance T09).
    Case sequence:
    New -> Assigned -> Under Investigation -> Corrective Action -> Pending Verification.
    Closing WITHOUT all 8 mandatory fields MUST fail with 422 Unprocessable Content.
    Providing all 8 fields MUST succeed with 200 OK.
    """
    case_id = "TEST-CASE-001"

    # Step 1: New -> Assigned
    r1 = await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Assigned", "actor": "lead_triage", "assigned_to": "investigator_alice"},
    )
    assert r1.status_code == 200
    assert r1.json()["data"]["status"] == "Assigned"

    # Step 2: Assigned -> Under Investigation
    r2 = await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Under Investigation", "actor": "investigator_alice"},
    )
    assert r2.status_code == 200
    assert r2.json()["data"]["status"] == "Under Investigation"

    # Step 3: Under Investigation -> Corrective Action
    r3 = await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Corrective Action", "actor": "investigator_alice"},
    )
    assert r3.status_code == 200
    assert r3.json()["data"]["status"] == "Corrective Action"

    # Step 4: Corrective Action -> Pending Verification
    r4 = await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "Pending Verification", "actor": "investigator_alice"},
    )
    assert r4.status_code == 200
    assert r4.json()["data"]["status"] == "Pending Verification"

    # Step 5: Attempt closure with INCOMPLETE fields (only 3 of 8 fields provided)
    r5_fail = await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={
            "to_status": "Closed",
            "actor": "verifier_bob",
            "root_cause": "Compromised ERP vendor portal credentials",
            "corrective_action": "Bank account reverted, credentials revoked",
            "closure_type": "Confirmed Fraud / Blocked",
            # Missing: closure_evidence, verified_by, closure_date, etc.
        },
    )
    assert r5_fail.status_code == 422
    err_json = r5_fail.json()
    assert err_json["error_code"] == "VERIFIED_CLOSURE_VALIDATION_ERROR"
    assert "missing mandatory fields" in err_json["message"]

    # Step 6: Submit Verified Closure with ALL 8 MANDATORY FIELDS
    closure_payload = {
        "to_status": "Closed",
        "actor": "verifier_bob",
        "root_cause": "Compromised vendor portal credentials used for off-hours bank detail change",
        "corrective_action": (
            "Vendor bank details restored to primary account; payment hold placed on NC-260828"
        ),
        "closure_type": "Confirmed Fraud / Blocked",
        "closure_evidence": (
            "Audit ticket SEC-2026-881; verified phone confirmation with Northstar CFO"
        ),
        "verified_by": "verifier_bob (Independent Controls Auditor)",
        "closure_date": "2026-08-30",
        "follow_up_requirement": (
            "Mandatory multifactor authentication rollout for all vendor portal admins"
        ),
        "recurrence_monitoring": "Enrolled in 90-day automated bank modification monitoring",
    }
    r5_success = await async_client.post(
        f"/api/v1/cases/{case_id}/transition",
        json=closure_payload,
    )
    assert r5_success.status_code == 200
    closed_case = r5_success.json()["data"]
    assert closed_case["status"] == "Closed"
    assert closed_case["root_cause"] is not None
    assert closed_case["closure_type"] == "Confirmed Fraud / Blocked"
    assert closed_case["verified_by"] == "verifier_bob (Independent Controls Auditor)"

    # Step 7: Verify Audit Trail Completeness (T10)
    history = closed_case["history"]
    assert len(history) == 6  # Created + 5 transitions
    statuses = [h["new_status"] for h in history]
    assert statuses == [
        "New",
        "Assigned",
        "Under Investigation",
        "Corrective Action",
        "Pending Verification",
        "Closed",
    ]
