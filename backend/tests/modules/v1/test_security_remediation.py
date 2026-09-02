"""
Security Control Verification Tests.
Formally validates that unauthenticated access and unauthorized operations
are rejected with appropriate 401/403/422 status codes across endpoints.
"""

from io import BytesIO

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.dependencies import get_current_user
from app.api.db.database import get_db
from app.api.modules.v1.auth.models.user import User
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
