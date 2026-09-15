"""
Separation of Duties (SoD) Enforcement Tests (TRIS v1.4 Ticket 3).
Formally verifies that:
1. test_separation_of_duties_blocks_self_verification:
   - An Administrator who performs investigation transitions on a case is BLOCKED
     from independently verifying or closing it (HTTP 403 SEPARATION_OF_DUTIES_VIOLATION).
2. An independent Verifier is permitted to close a case investigated by an Administrator.
3. Attempting to bypass SoD via spoofed actor names while authenticated as the investigator
   is blocked.
4. Setting an investigator as verified_by is blocked.
"""

from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.dependencies import get_current_user
from app.api.db.database import get_db
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.cases.models.risk_case import CaseHistory, RiskCase
from app.main import app

# ─────────────────────────────────────────────────────────────
# 1. Mandatory Test: test_separation_of_duties_blocks_self_verification
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_separation_of_duties_blocks_self_verification(
    db_session: AsyncSession,
):
    """
    Consolidated Instruction Section 2 mandatory test:
    A user with the 'admin' role who performed investigation on a case
    cannot close that case. Server-side enforcement rejects the transition
    with HTTP 403 Forbidden (SEPARATION_OF_DUTIES_VIOLATION).
    """
    admin_user = User(
        user_id="USR-ADMIN-SOD-01",
        username="lead_admin_investigator",
        name="Lead Admin Investigator",
        email="admin.investigator@tris.internal",
        role="admin",
        department="Governance",
        is_active=True,
    )

    async def override_get_db():
        yield db_session

    async def override_admin():
        return admin_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_admin

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Seed a fresh risk case in New status
            case = RiskCase(
                case_id="CASE-SOD-001",
                case_number="CASE-SOD-2026-001",
                priority="High",
                status="New",
                trigger_signals=[],
                evaluation_snapshot={},
            )
            db_session.add(case)
            await db_session.commit()

            # 2. Admin performs investigation transitions: New -> Assigned
            r1 = await client.post(
                "/api/v1/cases/CASE-SOD-001/transition",
                json={
                    "to_status": "Assigned",
                    "actor": "Lead Admin Investigator",
                    "assigned_to": "USR-ADMIN-SOD-01",
                },
            )
            assert r1.status_code == 200
            assert r1.json()["data"]["status"] == "Assigned"

            # 3. Admin transitions: Assigned -> Under Investigation
            r2 = await client.post(
                "/api/v1/cases/CASE-SOD-001/transition",
                json={
                    "to_status": "Under Investigation",
                    "actor": "Lead Admin Investigator",
                    "note": "Admin initiating root-cause analysis",
                },
            )
            assert r2.status_code == 200
            assert r2.json()["data"]["status"] == "Under Investigation"

            # 4. Admin transitions: Under Investigation -> Corrective Action
            r3 = await client.post(
                "/api/v1/cases/CASE-SOD-001/transition",
                json={
                    "to_status": "Corrective Action",
                    "actor": "Lead Admin Investigator",
                    "root_cause": "Compromised ERP account initiated off-hours change",
                },
            )
            assert r3.status_code == 200
            assert r3.json()["data"]["status"] == "Corrective Action"

            # 5. Admin transitions: Corrective Action -> Pending Verification
            r4 = await client.post(
                "/api/v1/cases/CASE-SOD-001/transition",
                json={
                    "to_status": "Pending Verification",
                    "actor": "Lead Admin Investigator",
                    "corrective_action": "Bank account reverted and vendor MFA enforced",
                },
            )
            assert r4.status_code == 200
            assert r4.json()["data"]["status"] == "Pending Verification"

            # 6. The SAME Admin user attempts to independently verify and CLOSE the case
            closure_payload = {
                "to_status": "Closed",
                "actor": "Lead Admin Investigator",
                "root_cause": "Compromised ERP account initiated off-hours change",
                "corrective_action": "Bank account reverted and vendor MFA enforced",
                "closure_type": "Confirmed Fraud / Blocked",
                "closure_evidence": "SEC-AUDIT-2026-999",
                "verified_by": "Lead Admin Investigator",
                "closure_date": "2026-08-30",
                "follow_up_requirement": "Quarterly audit",
                "recurrence_monitoring": "Enrolled in 90-day surveillance",
            }
            close_attempt = await client.post(
                "/api/v1/cases/CASE-SOD-001/transition",
                json=closure_payload,
            )

            # MUST BE REJECTED with HTTP 403 Forbidden
            assert close_attempt.status_code == 403
            err = close_attempt.json()
            assert err["status"] == "ERROR"
            assert err["error_code"] == "SEPARATION_OF_DUTIES_VIOLATION"
            assert "investigated this case" in err["message"].lower()

            # Confirm database record status remained Pending Verification (not Closed)
            refreshed = await db_session.get(RiskCase, "CASE-SOD-001")
            assert refreshed.status == "Pending Verification"
    finally:
        app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────
# 2. Permitted Case: Independent Verifier Closes Case
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_separation_of_duties_allows_independent_verifier(
    db_session: AsyncSession,
):
    """
    When an Administrator investigated a case, a DIFFERENT user with the
    'verifier' role is permitted to independently verify and close it.
    """
    verifier_user = User(
        user_id="USR-VERIFIER-SOD-02",
        username="independent_verifier_2",
        name="Independent Controls Auditor",
        email="verifier2@tris.internal",
        role="verifier",
        department="Compliance",
        is_active=True,
    )

    # Pre-seed case already progressed to Pending Verification by Admin
    case = RiskCase(
        case_id="CASE-SOD-002",
        case_number="CASE-SOD-2026-002",
        priority="High",
        status="Pending Verification",
        assigned_to="USR-ADMIN-SOD-02",
        root_cause="Vendor email compromised",
        corrective_action="Credentials revoked",
        trigger_signals=[],
        evaluation_snapshot={},
    )
    db_session.add(case)
    await db_session.flush()

    # Record Admin investigation history
    history = CaseHistory(
        case_id="CASE-SOD-002",
        actor="Admin Investigator Two",
        action="Status Transition: Under Investigation -> Corrective Action",
        previous_status="Under Investigation",
        new_status="Corrective Action",
        note="Admin investigated",
        timestamp=datetime.now(UTC),
    )
    db_session.add(history)
    await db_session.commit()

    # Now Verifier authenticates and attempts closure
    async def override_get_db():
        yield db_session

    async def override_verifier():
        return verifier_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_verifier

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            closure_payload = {
                "to_status": "Closed",
                "actor": "Independent Controls Auditor",
                "root_cause": "Vendor email compromised",
                "corrective_action": "Credentials revoked",
                "closure_type": "Confirmed Fraud / Blocked",
                "closure_evidence": "SEC-AUDIT-2026-888",
                "verified_by": "Independent Controls Auditor",
                "closure_date": "2026-08-30",
                "follow_up_requirement": "Annual audit",
                "recurrence_monitoring": "Automated surveillance active",
            }
            res = await client.post(
                "/api/v1/cases/CASE-SOD-002/transition",
                json=closure_payload,
            )
            assert res.status_code == 200
            data = res.json()["data"]
            assert data["status"] == "Closed"
            assert data["verified_by"] == "Independent Controls Auditor"
    finally:
        app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────
# 3. Spoofing Prevention: Authenticated Identity Trumps Payload Actor
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_separation_of_duties_blocks_spoofed_actor_by_investigator(
    db_session: AsyncSession,
):
    """
    An investigator cannot bypass SoD by passing a spoofed actor name
    in the JSON body while still authenticated as the investigating principal.
    """
    admin_user = User(
        user_id="USR-ADMIN-SOD-03",
        username="sneaky_admin",
        name="Sneaky Admin",
        email="sneaky@tris.internal",
        role="admin",
        department="Governance",
        is_active=True,
    )

    case = RiskCase(
        case_id="CASE-SOD-003",
        case_number="CASE-SOD-2026-003",
        priority="High",
        status="Pending Verification",
        assigned_to="USR-ADMIN-SOD-03",
        root_cause="Phishing attack",
        corrective_action="Passkeys instituted",
        trigger_signals=[],
        evaluation_snapshot={},
    )
    db_session.add(case)
    await db_session.flush()

    # Record sneaky_admin in history
    history = CaseHistory(
        case_id="CASE-SOD-003",
        actor="Sneaky Admin",
        action="Status Transition: Assigned -> Under Investigation",
        previous_status="Assigned",
        new_status="Under Investigation",
        note="Investigating",
        timestamp=datetime.now(UTC),
    )
    db_session.add(history)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    async def override_sneaky():
        return admin_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_sneaky

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Sneaky admin tries to claim actor is "External Auditor"
            closure_payload = {
                "to_status": "Closed",
                "actor": "External Auditor",
                "root_cause": "Phishing attack",
                "corrective_action": "Passkeys instituted",
                "closure_type": "Process Error / Remedied",
                "closure_evidence": "AUDIT-DOC-123",
                "verified_by": "External Auditor",
                "closure_date": "2026-08-30",
                "follow_up_requirement": "None",
                "recurrence_monitoring": "Monthly check",
            }
            res = await client.post(
                "/api/v1/cases/CASE-SOD-003/transition",
                json=closure_payload,
            )
            # Must still be caught via current_user identity
            assert res.status_code == 403
            assert res.json()["error_code"] == "SEPARATION_OF_DUTIES_VIOLATION"
    finally:
        app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────
# 4. Verified_By Integrity Check
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_separation_of_duties_blocks_investigator_as_verified_by(
    db_session: AsyncSession,
):
    """
    Even if the closure transition actor is an independent verifier,
    listing the investigator as 'verified_by' violates separation of duties.
    """
    verifier_user = User(
        user_id="USR-VERIFIER-SOD-04",
        username="independent_verifier_4",
        name="Independent Verifier Four",
        email="verifier4@tris.internal",
        role="verifier",
        department="Compliance",
        is_active=True,
    )

    case = RiskCase(
        case_id="CASE-SOD-004",
        case_number="CASE-SOD-2026-004",
        priority="Medium",
        status="Pending Verification",
        root_cause="Duplicate submission",
        corrective_action="Invoice cancelled",
        trigger_signals=[],
        evaluation_snapshot={},
    )
    db_session.add(case)
    await db_session.flush()

    # Lead Reviewer investigated
    history = CaseHistory(
        case_id="CASE-SOD-004",
        actor="Alice Investigator",
        action="Status Transition: Under Investigation -> Corrective Action",
        previous_status="Under Investigation",
        new_status="Corrective Action",
        timestamp=datetime.now(UTC),
    )
    db_session.add(history)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    async def override_verifier():
        return verifier_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_verifier

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            closure_payload = {
                "to_status": "Closed",
                "actor": "Independent Verifier Four",
                "root_cause": "Duplicate submission",
                "corrective_action": "Invoice cancelled",
                "closure_type": "Process Error / Remedied",
                "closure_evidence": "CANCEL-RECEIPT-99",
                "verified_by": "Alice Investigator",  # The investigator!
                "closure_date": "2026-08-30",
                "follow_up_requirement": "None",
                "recurrence_monitoring": "None",
            }
            res = await client.post(
                "/api/v1/cases/CASE-SOD-004/transition",
                json=closure_payload,
            )
            assert res.status_code == 403
            assert res.json()["error_code"] == "SEPARATION_OF_DUTIES_VIOLATION"
    finally:
        app.dependency_overrides.clear()
