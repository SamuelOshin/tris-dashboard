"""
RBAC Core Model & Process Owner Permission Boundary Tests.
Formally verifies:
1. Core four-role model: admin, reviewer, verifier, process_owner.
2. test_process_owner_cannot_edit_rules_or_verify_closure:
   - Process Owner CANNOT edit detection rules (403 Forbidden).
   - Process Owner CANNOT independently verify/close cases (403 Forbidden).
3. Process Owner CAN view cases and submit corrective actions.
4. Deprecated roles (procurement, cfo, security) cannot transition cases.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.dependencies import get_current_user
from app.api.core.permissions import (
    CASE_TRANSITION_ROLES,
    CASE_VERIFICATION_ROLES,
    CORE_ROLES,
    DEPRECATED_ROLES,
    Role,
)
from app.api.db.database import get_db
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.cases.models.risk_case import RiskCase
from app.api.modules.v1.rules.models.rule_config import RuleConfig
from app.main import app


@pytest.fixture
async def process_owner_client(db_session: AsyncSession):
    """Client authenticated as a Process Owner."""

    async def override_get_db():
        yield db_session

    async def override_po_user():
        return User(
            user_id="USR-PO-TEST-1",
            username="process_owner_user",
            name="Plant Process Owner",
            email="po@tris.internal",
            role="process_owner",
            department="Operations",
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_po_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
async def verifier_client(db_session: AsyncSession):
    """Client authenticated as an independent Verifier."""

    async def override_get_db():
        yield db_session

    async def override_verifier_user():
        return User(
            user_id="USR-VER-TEST-1",
            username="independent_verifier",
            name="Independent Verifier",
            email="verifier@tris.internal",
            role="verifier",
            department="Compliance",
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_verifier_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
async def deprecated_role_client(db_session: AsyncSession):
    """Client authenticated with a deprecated role (cfo)."""

    async def override_get_db():
        yield db_session

    async def override_cfo_user():
        return User(
            user_id="USR-CFO-TEST-1",
            username="legacy_cfo",
            name="Legacy Executive",
            email="cfo@company.com",
            role="cfo",
            department="Finance",
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_cfo_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────
# 1. Structural RBAC Model Definitions
# ─────────────────────────────────────────────────────────────


def test_rbac_four_role_model_structure():
    """Verify Role enum contains process_owner and preserves backward-compatible roles."""
    assert Role.PROCESS_OWNER == "process_owner"
    assert Role.ADMIN == "admin"
    assert Role.REVIEWER == "reviewer"
    assert Role.VERIFIER == "verifier"

    # Deprecated roles preserved for backward-compatibility
    assert Role.COMPLIANCE == "compliance"
    assert Role.CFO == "cfo"
    assert Role.SECURITY == "security"
    assert Role.PROCUREMENT == "procurement"

    # Four core roles group
    assert set(CORE_ROLES) == {
        Role.ADMIN,
        Role.REVIEWER,
        Role.VERIFIER,
        Role.PROCESS_OWNER,
    }

    # Deprecated roles group
    assert set(DEPRECATED_ROLES) == {
        Role.COMPLIANCE,
        Role.CFO,
        Role.SECURITY,
        Role.PROCUREMENT,
    }

    # Case transitions only allow core roles (reviewer, verifier, process_owner, admin)
    assert Role.PROCESS_OWNER in CASE_TRANSITION_ROLES
    assert Role.ADMIN in CASE_TRANSITION_ROLES
    assert Role.REVIEWER in CASE_TRANSITION_ROLES
    assert Role.VERIFIER in CASE_TRANSITION_ROLES
    assert Role.PROCUREMENT not in CASE_TRANSITION_ROLES
    assert Role.CFO not in CASE_TRANSITION_ROLES
    assert Role.SECURITY not in CASE_TRANSITION_ROLES

    # Verification and closure restricted to Verifier and Admin
    assert Role.VERIFIER in CASE_VERIFICATION_ROLES
    assert Role.ADMIN in CASE_VERIFICATION_ROLES
    assert Role.PROCESS_OWNER not in CASE_VERIFICATION_ROLES
    assert Role.REVIEWER not in CASE_VERIFICATION_ROLES


# ─────────────────────────────────────────────────────────────
# 2. Mandatory Test: test_process_owner_cannot_edit_rules_or_verify_closure
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_process_owner_cannot_edit_rules_or_verify_closure(
    process_owner_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Consolidated Instruction Section 10 mandatory test:
    Process Owner cannot edit risk rules or verify/close cases.
    Attempts must return HTTP 403 Forbidden (PERMISSION_DENIED).
    """
    # Seed a rule to target
    rule = RuleConfig(
        rule_code="R-RBAC-001",
        name="RBAC Rule Boundary Test",
        description="Testing PO cannot edit rules",
        weight=20,
        threshold_params={"limit": 5},
        rule_version=1,
        is_active=True,
    )
    db_session.add(rule)

    # Seed a case in Pending Verification state
    case = RiskCase(
        case_id="CASE-RBAC-PO-01",
        case_number="CASE-PO-2026-001",
        priority="High",
        status="Pending Verification",
        root_cause="Operational oversight",
        corrective_action="Dual-control authorization instituted",
        trigger_signals=[],
        evaluation_snapshot={},
    )
    db_session.add(case)
    await db_session.commit()

    # Part A: Process Owner attempts to edit detection rule -> MUST return 403
    rule_patch_res = await process_owner_client.patch(
        "/api/v1/rules/R-RBAC-001",
        json={"weight": 50},
    )
    assert rule_patch_res.status_code == 403
    assert rule_patch_res.json()["error_code"] == "PERMISSION_DENIED"

    # Part B: Process Owner attempts to verify and close case -> MUST return 403
    closure_payload = {
        "to_status": "Closed",
        "actor": "Plant Process Owner",
        "root_cause": "Operational oversight",
        "corrective_action": "Dual-control authorization instituted",
        "closure_type": "Confirmed Fraud / Blocked",
        "closure_evidence": "PO-EVID-2026-01",
        "verified_by": "Plant Process Owner",
        "closure_date": "2026-08-30",
        "follow_up_requirement": "Quarterly review",
        "recurrence_monitoring": "Enrolled in 90-day surveillance",
    }
    close_res = await process_owner_client.post(
        "/api/v1/cases/CASE-RBAC-PO-01/transition",
        json=closure_payload,
    )
    assert close_res.status_code == 403
    assert close_res.json()["error_code"] == "PERMISSION_DENIED"


# ─────────────────────────────────────────────────────────────
# 3. Process Owner Permitted Operations
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_process_owner_can_view_cases_and_submit_corrective_action(
    process_owner_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Process Owner role permissions:
    - Can view cases (GET /cases, GET /cases/{id}).
    - Can submit corrective actions and transition from Under Investigation to Corrective Action.
    """
    case = RiskCase(
        case_id="CASE-PO-PERMITTED-01",
        case_number="CASE-PO-2026-002",
        priority="Medium",
        status="Under Investigation",
        root_cause="Vendor email compromised",
        trigger_signals=[],
        evaluation_snapshot={},
    )
    db_session.add(case)
    await db_session.commit()

    # 1. View cases list
    list_res = await process_owner_client.get("/api/v1/cases")
    assert list_res.status_code == 200
    assert any(c["case_id"] == "CASE-PO-PERMITTED-01" for c in list_res.json()["data"])

    # 2. View specific case detail
    detail_res = await process_owner_client.get("/api/v1/cases/CASE-PO-PERMITTED-01")
    assert detail_res.status_code == 200
    assert detail_res.json()["data"]["case_id"] == "CASE-PO-PERMITTED-01"

    # 3. Submit corrective action transition
    trans_res = await process_owner_client.post(
        "/api/v1/cases/CASE-PO-PERMITTED-01/transition",
        json={
            "to_status": "Corrective Action",
            "actor": "Plant Process Owner",
            "root_cause": "Vendor email compromised",
            "note": "Process Owner submitting corrective action plan.",
        },
    )
    assert trans_res.status_code == 200
    assert trans_res.json()["data"]["status"] == "Corrective Action"


# ─────────────────────────────────────────────────────────────
# 4. Verifier Permitted Closure vs Deprecated Roles
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_independent_verifier_can_close_case(
    verifier_client: AsyncClient,
    db_session: AsyncSession,
):
    """Independent Verifier is authorized to close a case with all 8 mandatory fields."""
    case = RiskCase(
        case_id="CASE-VERIFIER-OK-01",
        case_number="CASE-VER-2026-003",
        priority="High",
        status="Pending Verification",
        root_cause="Compromised vendor portal",
        corrective_action="Bank details reverted; payment hold placed",
        trigger_signals=[],
        evaluation_snapshot={},
    )
    db_session.add(case)
    await db_session.commit()

    closure_payload = {
        "to_status": "Closed",
        "actor": "Independent Verifier",
        "root_cause": "Compromised vendor portal",
        "corrective_action": "Bank details reverted; payment hold placed",
        "closure_type": "Confirmed Fraud / Blocked",
        "closure_evidence": "Audit ticket SEC-2026-881",
        "verified_by": "Independent Controls Auditor",
        "closure_date": "2026-08-30",
        "follow_up_requirement": "Mandatory MFA rollout",
        "recurrence_monitoring": "Enrolled in 90-day surveillance",
    }
    res = await verifier_client.post(
        "/api/v1/cases/CASE-VERIFIER-OK-01/transition",
        json=closure_payload,
    )
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "Closed"


@pytest.mark.asyncio
async def test_deprecated_role_cannot_transition_case(
    deprecated_role_client: AsyncClient,
    db_session: AsyncSession,
):
    """Deprecated roles (e.g. CFO) cannot execute case state transitions."""
    case = RiskCase(
        case_id="CASE-LEGACY-CFO-01",
        case_number="CASE-CFO-2026-004",
        priority="Medium",
        status="New",
        trigger_signals=[],
        evaluation_snapshot={},
    )
    db_session.add(case)
    await db_session.commit()

    res = await deprecated_role_client.post(
        "/api/v1/cases/CASE-LEGACY-CFO-01/transition",
        json={"to_status": "Assigned", "actor": "Legacy Executive"},
    )
    assert res.status_code == 403
    assert res.json()["error_code"] == "PERMISSION_DENIED"
