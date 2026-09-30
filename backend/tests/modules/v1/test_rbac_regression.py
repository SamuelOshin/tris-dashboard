"""
RBAC Reconciliation and Regression Test Suite (Ticket 2 / D7).

Formally verifies:
1. test_read_only_reviewer_cannot_write_anywhere:
   Attempt every mutating endpoint with the new 'read_only_reviewer' role,
   asserting 403 Forbidden (PERMISSION_DENIED) across the board.
2. test_read_only_reviewer_can_read_permitted_resources:
   Verify read-only reviewer can view cases, rules, transactions, suppliers (masked),
   access events, remediation controls/replays, and user profile.
3. test_read_only_reviewer_cannot_access_admin_user_directory:
   Verify admin-only endpoints (/api/v1/users) return 403.
4. test_d7_permissions_registry_and_scaffolding:
   Verify Role.READ_ONLY_REVIEWER, ROLE_LABELS, CORE_ROLES preservation,
   and manufacturing/analytics permission scaffolding constants.
5. test_existing_roles_permissions_preserved:
   Verify admin, reviewer, verifier, and process_owner retain their full capabilities.
6. test_auth_lifecycle_regression:
   Verify login, logout, cookie issuance/clearing, profile retrieval, and session protection.
"""

from datetime import UTC, date, datetime
from io import BytesIO

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.dependencies import get_current_user
from app.api.core.permissions import (
    ALL_ROLES,
    ANALYTICS_EXECUTION_ROLES,
    ANALYTICS_EXPORT_ROLES,
    CASE_READ_ROLES,
    CASE_TRANSITION_ROLES,
    CASE_VERIFICATION_ROLES,
    CORE_ROLES,
    DEPRECATED_ROLES,
    MANUFACTURING_CONFIG_ROLES,
    MANUFACTURING_INGESTION_ROLES,
    PRIVILEGED_ROLES,
    READ_ONLY_ROLES,
    ROLE_LABELS,
    VALIDATION_RUN_ROLES,
    WRITE_ROLES,
    Role,
)
from app.api.core.security import get_password_hash
from app.api.db.database import get_db
from app.api.modules.v1.access_events.models.access_event import AccessEvent
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.cases.models.risk_case import RiskCase
from app.api.modules.v1.rules.models.rule_config import RuleConfig
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.api.modules.v1.transactions.models.transaction import Transaction
from app.main import app
from tests.conftest import make_principal

# ─────────────────────────────────────────────────────────────────────────────
# 1. Structural Registry & D7 Scaffolding Tests
# ─────────────────────────────────────────────────────────────────────────────


def test_d7_permissions_registry_and_scaffolding():
    """
    Verify the centralized RBAC permissions registry matches D7 reconciliation rules:
    - READ_ONLY_REVIEWER exists in Role and ROLE_LABELS.
    - CORE_ROLES is unchanged (admin, reviewer, verifier, process_owner).
    - DEPRECATED_ROLES is preserved for legacy backward compatibility.
    - READ_ONLY_REVIEWER has zero write or transition capabilities.
    - Manufacturing/analytics capability scaffolding constants exist and extend Risk Reviewer.
    """
    # 1. Role enum check
    assert Role.READ_ONLY_REVIEWER == "read_only_reviewer"
    assert Role.READ_ONLY_REVIEWER in ROLE_LABELS
    assert ROLE_LABELS[Role.READ_ONLY_REVIEWER] == "Read-Only Reviewer"

    # 2. Four-role model preservation (D7 contract: core model unchanged)
    assert set(CORE_ROLES) == {
        Role.ADMIN,
        Role.REVIEWER,
        Role.VERIFIER,
        Role.PROCESS_OWNER,
    }

    # 3. Deprecated legacy roles preserved
    assert set(DEPRECATED_ROLES) == {
        Role.COMPLIANCE,
        Role.CFO,
        Role.SECURITY,
        Role.PROCUREMENT,
    }

    # 4. Zero-write isolation: READ_ONLY_REVIEWER must NOT be in any mutating/transition groups
    assert Role.READ_ONLY_REVIEWER not in WRITE_ROLES
    assert Role.READ_ONLY_REVIEWER not in PRIVILEGED_ROLES
    assert Role.READ_ONLY_REVIEWER not in CASE_TRANSITION_ROLES
    assert Role.READ_ONLY_REVIEWER not in CASE_VERIFICATION_ROLES
    assert Role.READ_ONLY_REVIEWER not in MANUFACTURING_INGESTION_ROLES
    assert Role.READ_ONLY_REVIEWER not in ANALYTICS_EXECUTION_ROLES
    assert Role.READ_ONLY_REVIEWER not in VALIDATION_RUN_ROLES
    assert Role.READ_ONLY_REVIEWER not in MANUFACTURING_CONFIG_ROLES
    assert Role.READ_ONLY_REVIEWER not in ANALYTICS_EXPORT_ROLES

    # 5. Read-only group
    assert Role.READ_ONLY_REVIEWER in READ_ONLY_ROLES
    assert Role.READ_ONLY_REVIEWER in ALL_ROLES
    assert Role.READ_ONLY_REVIEWER in CASE_READ_ROLES

    # 6. Risk Reviewer capability extensions (D7 contract)
    assert Role.REVIEWER in MANUFACTURING_INGESTION_ROLES
    assert Role.REVIEWER in ANALYTICS_EXECUTION_ROLES
    assert Role.REVIEWER in VALIDATION_RUN_ROLES
    assert Role.REVIEWER in ANALYTICS_EXPORT_ROLES
    assert Role.ADMIN in MANUFACTURING_CONFIG_ROLES


# ─────────────────────────────────────────────────────────────────────────────
# 2. Mandatory Test: test_read_only_reviewer_cannot_write_anywhere
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_read_only_reviewer_cannot_write_anywhere(
    client_as,
    db_session: AsyncSession,
):
    """
    Ticket 2 Mandatory Verification:
    Attempt EVERY mutating endpoint with the 'read_only_reviewer' role,
    asserting HTTP 403 Forbidden (PERMISSION_DENIED) across the board.
    """
    # Seed baseline fixtures for the mutating endpoints to reference
    rule = RuleConfig(
        rule_code="R-REG-001",
        name="Regression Test Rule",
        description="Testing read-only role write restriction",
        weight=20,
        threshold_params={"multiplier": 2.0},
        rule_version=1,
        is_active=True,
    )
    db_session.add(rule)

    case = RiskCase(
        case_id="CASE-REG-001",
        case_number="CASE-REG-2026-001",
        priority="Medium",
        status="Under Investigation",
        root_cause=None,
        corrective_action=None,
        trigger_signals=[],
        evaluation_snapshot={},
    )
    db_session.add(case)

    supplier = Supplier(
        supplier_id="SUP-REG-001",
        name="Regression Test Supplier",
        category="Hardware",
        risk_tier="Low",
        bank_account="987654321098",
        routing_number="123456789",
        status="Active",
    )
    db_session.add(supplier)

    tx = Transaction(
        transaction_id="TX-REG-001",
        supplier_id="SUP-REG-001",
        invoice_number="INV-REG-001",
        amount=12000.0,
        currency="USD",
        invoice_date=date(2026, 8, 20),
        payment_status="Pending",
    )
    db_session.add(tx)
    await db_session.commit()

    read_only_user = make_principal(
        user_id="USR-RO-001",
        username="ro_reviewer_alice",
        name="Alice ReadOnly",
        role="read_only_reviewer",
        department="Audit",
    )

    async with client_as(read_only_user) as client:
        # Endpoint 1: Case Transition (POST /cases/{id}/transition)
        res_transition = await client.post(
            "/api/v1/cases/CASE-REG-001/transition",
            json={"to_status": "Corrective Action", "actor": "Alice ReadOnly"},
        )
        assert res_transition.status_code == 403, (
            "Case transition must return 403 for read_only_reviewer"
        )
        assert res_transition.json()["error_code"] == "PERMISSION_DENIED"

        # Endpoint 2: Case Field Update (PATCH /cases/{id})
        res_patch_case = await client.patch(
            "/api/v1/cases/CASE-REG-001",
            json={"root_cause": "Attempted unauthorized edit"},
        )
        assert res_patch_case.status_code == 403, (
            "Case patch must return 403 for read_only_reviewer"
        )
        assert res_patch_case.json()["error_code"] == "PERMISSION_DENIED"

        # Endpoint 3: Rule Config Update (PATCH /rules/{code})
        res_patch_rule = await client.patch(
            "/api/v1/rules/R-REG-001",
            json={"weight": 50},
        )
        assert res_patch_rule.status_code == 403, (
            "Rule patch must return 403 for read_only_reviewer"
        )
        assert res_patch_rule.json()["error_code"] == "PERMISSION_DENIED"

        # Endpoint 4: Rule Engine Execution / Case Creation (POST /rules/evaluate/{id})
        res_eval = await client.post("/api/v1/rules/evaluate/TX-REG-001")
        assert res_eval.status_code == 403, "Rule evaluation must return 403 for read_only_reviewer"
        assert res_eval.json()["error_code"] == "PERMISSION_DENIED"

        # Endpoint 5: Data Ingestion (POST /ingest/upload)
        fake_file = (
            "test_data.xlsx",
            BytesIO(b"fake workbook content"),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        res_ingest = await client.post(
            "/api/v1/ingest/upload",
            files={"file": fake_file},
        )
        assert res_ingest.status_code == 403, (
            "Ingestion upload must return 403 for read_only_reviewer"
        )
        assert res_ingest.json()["error_code"] == "PERMISSION_DENIED"

        # Endpoint 6: Remediation Control Creation (POST /remediation/controls)
        res_ctrl = await client.post(
            "/api/v1/remediation/controls",
            json={
                "name": "Unauthorized Control",
                "description": "Should fail",
                "condition_type": "AMOUNT_EXCEEDS",
                "threshold_params": {"amount": 50000},
                "action": "BLOCK/PREVENT",
            },
        )
        assert res_ctrl.status_code == 403, (
            "Proposed control creation must return 403 for read_only_reviewer"
        )
        assert res_ctrl.json()["error_code"] == "PERMISSION_DENIED"

        # Endpoint 7: Remediation Replay Execution (POST /remediation/replay)
        res_replay = await client.post(
            "/api/v1/remediation/replay",
            json={
                "transaction_id": "TX-REG-001",
                "event_timestamp": "2026-08-28T10:14:00Z",
                "control_id": "CTRL-001",
                "persist": False,
            },
        )
        assert res_replay.status_code == 403, (
            "Replay execution must return 403 for read_only_reviewer"
        )
        assert res_replay.json()["error_code"] == "PERMISSION_DENIED"

        # Endpoint 8: User Creation (POST /users)
        res_create_user = await client.post(
            "/api/v1/users",
            json={
                "username": "unauthorized_user",
                "name": "New User",
                "email": "new@tris.internal",
                "role": "reviewer",
                "department": "Finance",
            },
        )
        assert res_create_user.status_code == 403, (
            "User creation must return 403 for read_only_reviewer"
        )
        assert res_create_user.json()["error_code"] == "PERMISSION_DENIED"

        # Endpoint 9: User Profile Update (PATCH /users/{id})
        res_patch_user = await client.patch(
            "/api/v1/users/USR-TEST-001",
            json={"name": "Tampered Name"},
        )
        assert res_patch_user.status_code == 403, (
            "User patch must return 403 for read_only_reviewer"
        )
        assert res_patch_user.json()["error_code"] == "PERMISSION_DENIED"

        # Endpoint 10: Admin Password Reset (POST /users/{id}/reset-password)
        res_reset_pw = await client.post("/api/v1/users/USR-TEST-001/reset-password")
        assert res_reset_pw.status_code == 403, (
            "Password reset must return 403 for read_only_reviewer"
        )
        assert res_reset_pw.json()["error_code"] == "PERMISSION_DENIED"

        # Endpoint 11: Notification Emission (POST /notifications)
        res_notif = await client.post(
            "/api/v1/notifications",
            json={
                "title": "Unauthorized Alert",
                "message": "Should not be emitted",
                "category": "system",
                "severity": "low",
            },
        )
        assert res_notif.status_code == 403, (
            "Notification emit must return 403 for read_only_reviewer"
        )
        assert res_notif.json()["error_code"] == "PERMISSION_DENIED"

        # Endpoint 12: Historical Reconstruction Mutation (POST /reconstruction/reconstruct)
        res_reconstruct = await client.post(
            "/api/v1/reconstruction/reconstruct",
            json={
                "transaction_id": "TX-REG-001",
                "event_timestamp": "2026-08-28T10:14:00Z",
            },
        )
        assert res_reconstruct.status_code == 403, (
            "Historical reconstruction execution must return 403 for read_only_reviewer"
        )
        assert res_reconstruct.json()["error_code"] == "PERMISSION_DENIED"


# ─────────────────────────────────────────────────────────────────────────────
# 3. Read Access Verification for read_only_reviewer
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_read_only_reviewer_can_read_permitted_resources(
    client_as,
    db_session: AsyncSession,
):
    """
    Verify read_only_reviewer has read-only access to all domain telemetry,
    dashboards, cases, rules, transactions, access events, and replay listings.
    """
    # Seed sample entities
    rule = RuleConfig(
        rule_code="R-RO-001",
        name="RO Test Rule",
        description="Visible to read only",
        weight=25,
        threshold_params={},
        rule_version=1,
        is_active=True,
    )
    db_session.add(rule)

    case = RiskCase(
        case_id="CASE-RO-001",
        case_number="CASE-RO-2026-001",
        priority="Low",
        status="Under Investigation",
        root_cause="None",
        corrective_action="None",
        trigger_signals=[],
        evaluation_snapshot={},
    )
    db_session.add(case)

    supplier = Supplier(
        supplier_id="SUP-RO-001",
        name="Precision Metals Corp",
        category="Fasteners",
        risk_tier="Medium",
        bank_account="123456789012",
        routing_number="987654321",
        status="Active",
    )
    db_session.add(supplier)

    tx = Transaction(
        transaction_id="TX-RO-001",
        supplier_id="SUP-RO-001",
        invoice_number="INV-RO-001",
        amount=5500.0,
        currency="USD",
        invoice_date=date(2026, 8, 20),
        payment_status="Approved",
    )
    db_session.add(tx)

    event = AccessEvent(
        event_id="EVT-RO-001",
        user_id="USR-RO-001",
        event_time=datetime(2026, 8, 28, 14, 0, 0, tzinfo=UTC),
        system="ERP-AP",
        action="VIEW",
        resource="SUPPLIER_PROFILE",
        supplier_id="SUP-RO-001",
        result="Success",
    )
    db_session.add(event)
    await db_session.commit()

    read_only_user = make_principal(
        user_id="USR-RO-002",
        username="ro_reviewer_bob",
        name="Bob Auditor",
        role="read_only_reviewer",
        department="Compliance",
    )

    async with client_as(read_only_user) as client:
        # Cases list & detail
        res_cases = await client.get("/api/v1/cases")
        assert res_cases.status_code == 200
        assert any(c["case_id"] == "CASE-RO-001" for c in res_cases.json()["data"])

        res_case_detail = await client.get("/api/v1/cases/CASE-RO-001")
        assert res_case_detail.status_code == 200
        assert res_case_detail.json()["data"]["case_id"] == "CASE-RO-001"

        # Rules list & detail
        res_rules = await client.get("/api/v1/rules")
        assert res_rules.status_code == 200
        assert any(r["rule_code"] == "R-RO-001" for r in res_rules.json()["data"])

        res_rule_detail = await client.get("/api/v1/rules/R-RO-001")
        assert res_rule_detail.status_code == 200
        assert res_rule_detail.json()["data"]["rule_code"] == "R-RO-001"

        # Suppliers list & detail (with sensitive field masking)
        res_suppliers = await client.get("/api/v1/suppliers")
        assert res_suppliers.status_code == 200
        sup_data = next(s for s in res_suppliers.json()["data"] if s["supplier_id"] == "SUP-RO-001")
        assert sup_data["bank_account"] == "••••9012"

        res_sup_detail = await client.get("/api/v1/suppliers/SUP-RO-001")
        assert res_sup_detail.status_code == 200
        assert res_sup_detail.json()["data"]["bank_account"] == "••••9012"

        # Supplier baseline
        res_baseline = await client.get("/api/v1/suppliers/SUP-RO-001/baseline")
        assert res_baseline.status_code == 200

        # Transactions list & detail
        res_txs = await client.get("/api/v1/transactions")
        assert res_txs.status_code == 200
        assert any(t["transaction_id"] == "TX-RO-001" for t in res_txs.json()["data"])

        res_tx_detail = await client.get("/api/v1/transactions/TX-RO-001")
        assert res_tx_detail.status_code == 200
        assert res_tx_detail.json()["data"]["transaction_id"] == "TX-RO-001"

        # Access events & stats
        res_events = await client.get("/api/v1/access-events")
        assert res_events.status_code == 200

        res_event_stats = await client.get("/api/v1/access-events/stats")
        assert res_event_stats.status_code == 200

        # Remediation controls & replays read
        res_controls = await client.get("/api/v1/remediation/controls")
        assert res_controls.status_code == 200

        res_replays = await client.get("/api/v1/remediation/replays")
        assert res_replays.status_code == 200

        # User profile /me
        res_me = await client.get("/api/v1/auth/me")
        assert res_me.status_code == 200
        assert res_me.json()["data"]["role"] == "read_only_reviewer"

        # Reconstruction convenience read (GET performs read-only reconstruction with persist=False)
        res_recon = await client.get("/api/v1/reconstruction/reconstruct/TX-RO-001")
        assert res_recon.status_code == 200
        assert res_recon.json()["data"]["transaction_id"] == "TX-RO-001"
        assert res_recon.json()["data"]["snapshot_id"] is None


# ─────────────────────────────────────────────────────────────────────────────
# 4. Admin Boundary Check for read_only_reviewer
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_read_only_reviewer_cannot_access_admin_user_directory(client_as):
    """Verify read_only_reviewer is forbidden from querying administrative user directories."""
    read_only_user = make_principal(
        user_id="USR-RO-003",
        username="ro_reviewer_charlie",
        name="Charlie RO",
        role="read_only_reviewer",
        department="Audit",
    )

    async with client_as(read_only_user) as client:
        res_list = await client.get("/api/v1/users")
        assert res_list.status_code == 403
        assert res_list.json()["error_code"] == "PERMISSION_DENIED"

        res_detail = await client.get("/api/v1/users/USR-TEST-001")
        assert res_detail.status_code == 403
        assert res_detail.json()["error_code"] == "PERMISSION_DENIED"


# ─────────────────────────────────────────────────────────────────────────────
# 5. Preservation of Existing Roles Capabilities
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_existing_roles_permissions_preserved(
    client_as,
    db_session: AsyncSession,
):
    """
    Ticket 2 Acceptance Criterion 4:
    Verify no existing role's capabilities have been reduced or altered:
    - Administrator can manage users, edit rules, and verify closure.
    - Risk Reviewer can transition cases and execute rule evaluations.
    - Process Owner can transition cases from Under Investigation to Corrective Action.
    - Verifier can verify and close cases.
    """
    rule = RuleConfig(
        rule_code="R-PRESERVE-001",
        name="Preservation Check",
        description="Verify role capabilities are retained",
        weight=20,
        threshold_params={},
        rule_version=1,
        is_active=True,
    )
    db_session.add(rule)

    case = RiskCase(
        case_id="CASE-PRESERVE-001",
        case_number="CASE-P-2026-001",
        priority="High",
        status="Under Investigation",
        root_cause=None,
        corrective_action=None,
        trigger_signals=[],
        evaluation_snapshot={},
    )
    db_session.add(case)
    await db_session.commit()

    admin_user = make_principal("USR-ADM-P1", "p_admin", "Admin Preserved", "admin")
    reviewer_user = make_principal("USR-REV-P1", "p_reviewer", "Reviewer Preserved", "reviewer")
    po_user = make_principal("USR-PO-P1", "p_owner", "PO Preserved", "process_owner")

    # 1. Admin can edit rule configs
    async with client_as(admin_user) as client:
        res_patch = await client.patch(
            "/api/v1/rules/R-PRESERVE-001",
            json={"weight": 40},
        )
        assert res_patch.status_code == 200
        assert res_patch.json()["data"]["weight"] == 40

    # 2. Risk Reviewer can update case fields
    async with client_as(reviewer_user) as client:
        res_update = await client.patch(
            "/api/v1/cases/CASE-PRESERVE-001",
            json={"root_cause": "Identified by Reviewer"},
        )
        assert res_update.status_code == 200
        assert res_update.json()["data"]["root_cause"] == "Identified by Reviewer"

    # 3. Process Owner can transition Under Investigation -> Corrective Action
    async with client_as(po_user) as client:
        res_transition = await client.post(
            "/api/v1/cases/CASE-PRESERVE-001/transition",
            json={
                "to_status": "Corrective Action",
                "root_cause": "Supplier discrepancy",
                "corrective_action": "PO initiated remediation review",
            },
        )
        assert res_transition.status_code == 200
        assert res_transition.json()["data"]["status"] == "Corrective Action"

    # 4. Verifier can independently verify and close cases
    verifier_user = make_principal("USR-VER-P1", "p_verifier", "Verifier Preserved", "verifier")

    async with client_as(reviewer_user) as client:
        res_pv = await client.post(
            "/api/v1/cases/CASE-PRESERVE-001/transition",
            json={
                "to_status": "Pending Verification",
                "corrective_action": "Bank validation controls implemented",
            },
        )
        assert res_pv.status_code == 200
        assert res_pv.json()["data"]["status"] == "Pending Verification"

    async with client_as(verifier_user) as client:
        res_close = await client.post(
            "/api/v1/cases/CASE-PRESERVE-001/transition",
            json={
                "to_status": "Closed",
                "actor": "Verifier Preserved",
                "root_cause": "Supplier discrepancy",
                "corrective_action": "Bank validation controls implemented",
                "closure_type": "Confirmed Fraud / Blocked",
                "closure_evidence": "AUDIT-VER-2026-001",
                "verified_by": "Verifier Preserved",
                "closure_date": "2026-08-30",
                "follow_up_requirement": "Quarterly audit",
                "recurrence_monitoring": "90-day surveillance",
            },
        )
        assert res_close.status_code == 200
        assert res_close.json()["data"]["status"] == "Closed"


# ─────────────────────────────────────────────────────────────────────────────
# 6. Auth Lifecycle & Session Regression
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_auth_lifecycle_regression(
    db_session: AsyncSession,
):
    """
    Acceptance Criterion 1:
    Confirm login, logout, profile fetch, and unauthenticated protection
    continue to work exactly as before.
    """
    # Seed test user with Argon2id hash
    pw_hash = get_password_hash("SecretPassword123$")
    user = User(
        user_id="USR-AUTH-REG-1",
        username="auth_regression_user",
        name="Auth Tester",
        email="auth_test@tris.internal",
        hashed_password=pw_hash,
        role="reviewer",
        department="Risk",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides.pop(get_current_user, None)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request to /me is rejected (401)
        res_anon = await client.get("/api/v1/auth/me")
        assert res_anon.status_code == 401
        assert res_anon.json()["error_code"] == "AUTHENTICATION_FAILED"

        # 2. Failed login with invalid password (401)
        res_fail = await client.post(
            "/api/v1/auth/login",
            json={"username": "auth_regression_user", "password": "WrongPassword!"},
        )
        assert res_fail.status_code == 401
        assert res_fail.json()["error_code"] == "AUTHENTICATION_FAILED"

        # 3. Successful login returns token and sets HttpOnly cookie (200)
        res_login = await client.post(
            "/api/v1/auth/login",
            json={"username": "auth_regression_user", "password": "SecretPassword123$"},
        )
        assert res_login.status_code == 200
        assert "access_token" in res_login.json()["data"]
        assert "access_token" in res_login.cookies

        token = res_login.json()["data"]["access_token"]

        # 4. Authenticated request using cookie succeeds
        res_me_cookie = await client.get("/api/v1/auth/me")
        assert res_me_cookie.status_code == 200
        assert res_me_cookie.json()["data"]["username"] == "auth_regression_user"

        # 5. Authenticated request using Bearer header succeeds
        client.cookies.clear()
        res_me_bearer = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_me_bearer.status_code == 200
        assert res_me_bearer.json()["data"]["username"] == "auth_regression_user"

        # 6. Logout clears cookie
        res_logout = await client.post("/api/v1/auth/logout")
        assert res_logout.status_code == 200

        # 7. Request after logout without Bearer header is rejected (401)
        res_after_logout = await client.get("/api/v1/auth/me")
        assert res_after_logout.status_code == 401

        # 8. Session Expiry: expired tokens rejected with 401 and explicit expiration message
        from datetime import timedelta

        from app.api.core.security import create_access_token

        expired_token = create_access_token(
            {"sub": user.user_id, "role": user.role},
            expires_delta=timedelta(seconds=-10),
        )
        # 8a. Expired Bearer header session
        res_expired_bearer = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert res_expired_bearer.status_code == 401
        assert res_expired_bearer.json()["error_code"] == "AUTHENTICATION_FAILED"
        assert "expired" in res_expired_bearer.json()["message"].lower()

        # 8b. Expired Cookie session
        client.cookies.set("access_token", expired_token)
        res_expired_cookie = await client.get("/api/v1/auth/me")
        assert res_expired_cookie.status_code == 401
        assert res_expired_cookie.json()["error_code"] == "AUTHENTICATION_FAILED"
        assert "expired" in res_expired_cookie.json()["message"].lower()

    app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────────────────────
# 7. Preservation: pre-v2.0 open endpoints stay open to every existing role
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role", ["process_owner", "verifier", "reviewer", "admin", "cfo", "security", "procurement"]
)
async def test_existing_roles_retain_v14_access_to_reconstruction_remediation_rules(
    client_as,
    db_session: AsyncSession,
    role: str,
):
    """
    Regression guard for D7: every pre-v2.0 role keeps the v1.4 access it had to
    reconstruction, remediation (control creation + replay) and rule evaluation.
    Only read_only_reviewer is newly denied. Guards against gating these routes on
    WRITE_ROLES, which would lock out process_owner and verifier.
    """
    db_session.add(
        Supplier(
            supplier_id="SUP-KEEP-001",
            name="Retention Supplier",
            category="Hardware",
            risk_tier="Low",
            bank_account="111122223333",
            routing_number="123456789",
            status="Active",
        )
    )
    db_session.add(
        Transaction(
            transaction_id="TX-KEEP-001",
            supplier_id="SUP-KEEP-001",
            invoice_number="INV-KEEP-001",
            amount=9000.0,
            currency="USD",
            invoice_date=date(2026, 8, 20),
            payment_status="Pending",
        )
    )
    await db_session.commit()

    principal = make_principal(f"USR-KEEP-{role}", f"keep_{role}", f"Keep {role}", role)
    ts = "2026-08-28T10:14:00Z"

    async with client_as(principal) as client:
        res_recon = await client.post(
            "/api/v1/reconstruction/reconstruct",
            json={"transaction_id": "TX-KEEP-001", "event_timestamp": ts},
        )
        assert res_recon.status_code == 200, f"{role} lost reconstruct access"

        res_ctrl = await client.post(
            "/api/v1/remediation/controls",
            json={
                "name": f"Keep control {role}",
                "description": "retention check",
                "condition_type": "AMOUNT_EXCEEDS",
                "threshold_params": {"amount": 5000},
                "action": "BLOCK/PREVENT",
            },
        )
        assert res_ctrl.status_code == 201, f"{role} lost control-creation access"
        control_id = res_ctrl.json()["data"]["control_id"]

        res_replay = await client.post(
            "/api/v1/remediation/replay",
            json={
                "transaction_id": "TX-KEEP-001",
                "event_timestamp": ts,
                "control_id": control_id,
                "persist": False,
            },
        )
        assert res_replay.status_code == 200, f"{role} lost replay access"

        res_eval = await client.post("/api/v1/rules/evaluate/TX-KEEP-001")
        assert res_eval.status_code == 200, f"{role} lost rule-evaluation access"


# ─────────────────────────────────────────────────────────────────────────────
# 8. read_only_reviewer: documented self-service exceptions
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_read_only_reviewer_self_service_routes_are_intentionally_allowed(client_as):
    """
    Self-service routes that act only on the caller's own data are intentionally NOT
    blocked for read_only_reviewer: marking own notifications read and changing own
    password. They mutate no shared business data. Documented so the
    "cannot write anywhere" guarantee is precise, not implied.
    """
    principal = make_principal("USR-RO-SS", "ro_selfservice", "RO Self", "read_only_reviewer")
    async with client_as(principal) as client:
        res_mark = await client.post("/api/v1/notifications/mark-all-read")
        assert res_mark.status_code == 200

        res_pw = await client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "x", "new_password": "y"},
        )
        assert res_pw.status_code != 403
