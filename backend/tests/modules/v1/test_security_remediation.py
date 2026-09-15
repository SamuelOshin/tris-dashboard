"""
Security Control Verification Tests.
Formally validates that unauthenticated access and unauthorized operations
are rejected with appropriate 401/403/422 status codes across endpoints.
"""

from io import BytesIO

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.dependencies import get_current_user
from app.api.core.security import get_password_hash
from app.api.db.database import get_db
from app.api.modules.v1.auth.models.security_audit_log import SecurityAuditLog
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.cases.models.risk_case import CaseHistory
from app.api.modules.v1.rules.models.rule_config import RuleConfig
from app.api.modules.v1.suppliers.models.supplier import Supplier
from app.main import app


@pytest.fixture
async def unauthenticated_client(db_session: AsyncSession):
    """Client with clean DB override but NO authentication overrides."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # Ensure get_current_user is NOT overridden so real auth runs
    app.dependency_overrides.pop(get_current_user, None)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
async def unauthorized_client(db_session: AsyncSession):
    """Client authenticated with a low-privilege role (procurement)."""

    async def override_get_db():
        yield db_session

    async def override_low_priv_user():
        return User(
            user_id="USR-LOW-001",
            username="junior_procurement",
            name="Junior Buyer",
            email="buyer@tris.internal",
            role="procurement",
            department="Procurement",
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_low_priv_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────
# VULN-001: Rule update requires auth + correct role
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_vuln001_unauthenticated_rule_update_rejected(
    unauthenticated_client: AsyncClient,
):
    """VULN-001: PATCH /api/v1/rules/{code} MUST return 401 without valid session."""
    res = await unauthenticated_client.patch(
        "/api/v1/rules/R-001",
        json={"weight": 99},
    )
    assert res.status_code == 401
    assert res.json()["error_code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_vuln001_unauthorized_role_rule_update_rejected(
    unauthorized_client: AsyncClient,
):
    """VULN-001: Non-admin/compliance user MUST return 403 Forbidden."""
    res = await unauthorized_client.patch(
        "/api/v1/rules/R-001",
        json={"weight": 99},
    )
    assert res.status_code == 403
    assert res.json()["error_code"] == "PERMISSION_DENIED"


# ─────────────────────────────────────────────────────────────
# VULN-002: Case transition requires auth
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_vuln002_unauthenticated_case_transition_rejected(
    unauthenticated_client: AsyncClient,
):
    """VULN-002: POST /api/v1/cases/{id}/transition MUST return 401 without valid session."""
    res = await unauthenticated_client.post(
        "/api/v1/cases/TEST-CASE-001/transition",
        json={"to_status": "Assigned", "actor": "Spoofed CRO"},
    )
    assert res.status_code == 401
    assert res.json()["error_code"] == "AUTHENTICATION_FAILED"


# ─────────────────────────────────────────────────────────────
# VULN-003: Ingestion requires auth
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_vuln003_unauthenticated_ingestion_rejected(
    unauthenticated_client: AsyncClient,
):
    """VULN-003: POST /api/v1/ingest/upload MUST return 401 without valid session."""
    fake_file = (
        "test.xlsx",
        BytesIO(b"fake data"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    res = await unauthenticated_client.post(
        "/api/v1/ingest/upload",
        files={"file": fake_file},
    )
    assert res.status_code == 401
    assert res.json()["error_code"] == "AUTHENTICATION_FAILED"


# ─────────────────────────────────────────────────────────────
# VULN-004: Read endpoints require authentication (OWASP API1/API2)
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_vuln004_unauthenticated_case_list_rejected(
    unauthenticated_client: AsyncClient,
):
    """VULN-004: GET /api/v1/cases MUST return 401 without authentication."""
    res = await unauthenticated_client.get("/api/v1/cases")
    assert res.status_code == 401
    assert res.json()["error_code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_vuln004_unauthenticated_case_detail_rejected(
    unauthenticated_client: AsyncClient,
):
    """VULN-004: GET /api/v1/cases/{id} MUST return 401 without authentication."""
    res = await unauthenticated_client.get("/api/v1/cases/TEST-CASE-001")
    assert res.status_code == 401
    assert res.json()["error_code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_vuln004_unauthenticated_supplier_list_rejected(
    unauthenticated_client: AsyncClient,
):
    """VULN-004: GET /api/v1/suppliers MUST return 401 without authentication."""
    res = await unauthenticated_client.get("/api/v1/suppliers")
    assert res.status_code == 401
    assert res.json()["error_code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_vuln004_unauthenticated_supplier_baseline_rejected(
    unauthenticated_client: AsyncClient,
):
    """VULN-004: GET /api/v1/suppliers/{id}/baseline MUST return 401 without authentication."""
    res = await unauthenticated_client.get("/api/v1/suppliers/SUP-001/baseline")
    assert res.status_code == 401
    assert res.json()["error_code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_vuln004_unauthenticated_transaction_list_rejected(
    unauthenticated_client: AsyncClient,
):
    """VULN-004: GET /api/v1/transactions MUST return 401 without authentication."""
    res = await unauthenticated_client.get("/api/v1/transactions")
    assert res.status_code == 401
    assert res.json()["error_code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_vuln004_unauthenticated_rules_list_rejected(
    unauthenticated_client: AsyncClient,
):
    """VULN-004: GET /api/v1/rules MUST return 401 without authentication."""
    res = await unauthenticated_client.get("/api/v1/rules")
    assert res.status_code == 401
    assert res.json()["error_code"] == "AUTHENTICATION_FAILED"


# ─────────────────────────────────────────────────────────────
# VULN-005: Case transition enforces role-based access control
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_vuln005_low_privilege_case_transition_rejected(
    unauthorized_client: AsyncClient,
):
    """
    VULN-005: A 'procurement' role user MUST be denied case transitions.
    Only reviewer, verifier, admin, compliance roles may change case status.
    """
    res = await unauthorized_client.post(
        "/api/v1/cases/TEST-CASE-001/transition",
        json={"to_status": "Assigned", "actor": "Junior Buyer"},
    )
    assert res.status_code == 403
    assert res.json()["error_code"] == "PERMISSION_DENIED"


# ─────────────────────────────────────────────────────────────
# SEC-06: Sensitive supplier field masking by role
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sec06_supplier_field_masking_for_standard_role(
    unauthorized_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    SEC-06: Sensitive supplier fields (bank_account, routing_number) must be masked
    (last 4 digits only) for non-privileged roles (e.g. procurement).
    """
    supplier = Supplier(
        supplier_id="SUP-SEC-MASKED-1",
        name="Apex Security Vendor",
        category="Hardware",
        risk_tier="High",
        bank_account="987654321098",
        routing_number="123456789",
        status="Active",
    )
    db_session.add(supplier)
    await db_session.commit()

    # Detail endpoint masking check
    res_detail = await unauthorized_client.get("/api/v1/suppliers/SUP-SEC-MASKED-1")
    assert res_detail.status_code == 200
    data_masked = res_detail.json()["data"]
    assert data_masked["bank_account"] == "••••1098"
    assert data_masked["routing_number"] == "••••6789"

    # List endpoint masking check
    res_list = await unauthorized_client.get("/api/v1/suppliers")
    assert res_list.status_code == 200
    sup_masked = next(s for s in res_list.json()["data"] if s["supplier_id"] == "SUP-SEC-MASKED-1")
    assert sup_masked["bank_account"] == "••••1098"
    assert sup_masked["routing_number"] == "••••6789"


@pytest.mark.asyncio
async def test_sec06_supplier_field_unmasked_for_privileged_role(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    SEC-06: Sensitive supplier fields (bank_account, routing_number) must remain
    fully unmasked for privileged roles (admin, compliance).
    """
    supplier = Supplier(
        supplier_id="SUP-SEC-FULL-1",
        name="Apex Security Vendor",
        category="Hardware",
        risk_tier="High",
        bank_account="987654321098",
        routing_number="123456789",
        status="Active",
    )
    db_session.add(supplier)
    await db_session.commit()

    # Detail endpoint full values check
    res_detail = await async_client.get("/api/v1/suppliers/SUP-SEC-FULL-1")
    assert res_detail.status_code == 200
    data_full = res_detail.json()["data"]
    assert data_full["bank_account"] == "987654321098"
    assert data_full["routing_number"] == "123456789"

    # List endpoint full values check
    res_list = await async_client.get("/api/v1/suppliers")
    assert res_list.status_code == 200
    sup_full = next(s for s in res_list.json()["data"] if s["supplier_id"] == "SUP-SEC-FULL-1")
    assert sup_full["bank_account"] == "987654321098"
    assert sup_full["routing_number"] == "123456789"


# ─────────────────────────────────────────────────────────────
# SEC-07: Dedicated security/auth audit log
# ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sec07_security_audit_log_records_login_success_and_failure(
    unauthenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    SEC-07: Successful and failed login attempts must generate immutable audit records
    in security_audit_log table, recording timestamp, actor username, event type, and outcome.
    """
    # Seed user with real Argon2id password
    pw_hash = get_password_hash("ValidPass123$")
    test_user = User(
        user_id="USR-SEC-LOGIN-1",
        username="sec_audit_user",
        name="Security Auditor",
        email="sec_audit@tris.internal",
        hashed_password=pw_hash,
        role="admin",
        department="Security",
        is_active=True,
    )
    db_session.add(test_user)
    await db_session.commit()

    # 1. Successful login
    res_success = await unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username": "sec_audit_user", "password": "ValidPass123$"},
    )
    assert res_success.status_code == 200

    # Verify LOGIN_SUCCESS audit entry was committed
    stmt_success = select(SecurityAuditLog).where(
        SecurityAuditLog.actor_username == "sec_audit_user",
        SecurityAuditLog.event_type == "LOGIN_SUCCESS",
    )
    success_logs = (await db_session.execute(stmt_success)).scalars().all()
    assert len(success_logs) >= 1
    log_entry = success_logs[-1]
    assert log_entry.actor_id == "USR-SEC-LOGIN-1"
    assert log_entry.actor_role == "admin"
    assert "authenticated successfully" in log_entry.detail
    assert log_entry.occurred_at is not None

    # 2. Failed login (bad password)
    res_fail = await unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username": "sec_audit_user", "password": "WrongPassword!"},
    )
    assert res_fail.status_code == 401

    stmt_fail = select(SecurityAuditLog).where(
        SecurityAuditLog.actor_username == "sec_audit_user",
        SecurityAuditLog.event_type == "LOGIN_FAILURE",
    )
    fail_logs = (await db_session.execute(stmt_fail)).scalars().all()
    assert len(fail_logs) >= 1
    fail_entry = fail_logs[-1]
    assert "Failed login attempt" in fail_entry.detail
    assert fail_entry.occurred_at is not None


@pytest.mark.asyncio
async def test_sec07_security_audit_log_records_rule_config_edit(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    SEC-07: Edits to detection rule configurations must be logged to security_audit_log
    recording actor identity, role, rule code, new version, and timestamp.
    """
    rule = RuleConfig(
        rule_code="R-SEC-001",
        name="Security Anomaly Check",
        description="Rule audit test",
        weight=25,
        threshold_params={"limit": 5},
        rule_version=1,
        is_active=True,
    )
    db_session.add(rule)
    await db_session.commit()

    # Privileged user (auditor, admin) updates rule weight
    res = await async_client.patch(
        "/api/v1/rules/R-SEC-001",
        json={"weight": 50},
    )
    assert res.status_code == 200

    # Query security audit log
    stmt = select(SecurityAuditLog).where(
        SecurityAuditLog.event_type == "RULE_CONFIG_EDIT",
        SecurityAuditLog.resource_id == "R-SEC-001",
    )
    logs = (await db_session.execute(stmt)).scalars().all()
    assert len(logs) >= 1
    rule_log = logs[-1]
    assert rule_log.actor_username == "auditor"
    assert rule_log.actor_role == "admin"
    assert rule_log.resource_type == "rule_config"
    assert "New version: 2" in rule_log.detail


@pytest.mark.asyncio
async def test_sec07_security_audit_log_distinct_from_case_history(
    async_client: AsyncClient,
    unauthenticated_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    SEC-07: Security audit logs must remain completely isolated from CaseHistory.
    CaseHistory only tracks operational case lifecycle transitions.
    """
    # Trigger a security audit event
    await unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"username": "unknown_actor", "password": "any"},
    )

    # SecurityAuditLog table receives entry
    sec_logs = (await db_session.execute(select(SecurityAuditLog))).scalars().all()
    assert len(sec_logs) > 0

    # CaseHistory table must NOT contain any auth or security audit records
    case_history_records = (await db_session.execute(select(CaseHistory))).scalars().all()
    for ch in case_history_records:
        assert ch.from_status is not None or ch.to_status is not None
        assert "login" not in ch.action.lower()
        assert "rule" not in ch.action.lower()
