"""
Unit and Integration Tests for Authentication and Identity Service.
Verifies Argon2id password verification, JWT issuance, and cookie sessions.
"""

from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.security import get_password_hash
from app.api.modules.v1.auth.models.user import User

DATA_FILE = Path("../test data.xlsx").resolve()


@pytest.fixture(autouse=True)
async def seed_users(db_session: AsyncSession):
    """Seed test users into database."""
    reviewer = User(
        user_id="USR-101",
        username="reviewer",
        email="reviewer@tris.internal",
        name="Risk Reviewer",
        role="Reviewer",
        department="Finance",
        hashed_password=get_password_hash("reviewer123"),
        is_active=True,
    )
    db_session.add(reviewer)
    await db_session.commit()


@pytest.mark.asyncio
async def test_successful_login(async_client: AsyncClient):
    """Verify login issues valid JWT token and sets HttpOnly cookie."""
    res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "reviewer", "password": "reviewer123"},
    )
    assert res.status_code == 200
    res_json = res.json()
    assert res_json["status"] == "SUCCESS"
    assert res_json["data"]["access_token"] is not None
    assert res_json["data"]["username"] == "reviewer"
    assert res_json["data"]["role"] == "Reviewer"
    assert "access_token" in res.cookies


@pytest.mark.asyncio
async def test_failed_login_bad_password(async_client: AsyncClient):
    """Verify 401 response on invalid credentials."""
    res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "reviewer", "password": "wrongpassword"},
    )
    assert res.status_code == 401
    error = res.json()
    assert error["status"] == "ERROR"
    assert error["error_code"] == "AUTHENTICATION_FAILED"


@pytest.mark.asyncio
async def test_get_me_with_bearer_token(async_client: AsyncClient):
    """Verify GET /api/v1/auth/me resolves current user via Bearer token."""
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "reviewer", "password": "reviewer123"},
    )
    token = login_res.json()["data"]["access_token"]

    me_res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    user_data = me_res.json()["data"]
    assert user_data["username"] == "reviewer"
    assert user_data["user_id"] == "USR-101"


@pytest.mark.asyncio
async def test_get_me_with_cookie_session_only(async_client: AsyncClient):
    """
    Verify GET /api/v1/auth/me resolves current user strictly via HttpOnly cookie.
    Ensures zero reliance on localStorage or Authorization headers.
    """
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "reviewer", "password": "reviewer123"},
    )
    assert login_res.status_code == 200
    token = login_res.cookies.get("access_token")
    assert token is not None

    # Call /auth/me with cookie alone, NO Authorization header
    me_res = await async_client.get(
        "/api/v1/auth/me",
        cookies={"access_token": token},
    )
    assert me_res.status_code == 200
    user_data = me_res.json()["data"]
    assert user_data["username"] == "reviewer"
    assert user_data["user_id"] == "USR-101"


@pytest.mark.asyncio
async def test_cookie_security_attributes_in_dev_and_production(async_client: AsyncClient):
    """
    Verify cookie security attributes:
    1. HttpOnly and SameSite=lax are always set.
    2. Secure flag is dynamically enabled when ENVIRONMENT is production.
    """
    from app.api.core.config import settings

    # In dev/test: secure=False so local dev over http works
    dev_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "reviewer", "password": "reviewer123"},
    )
    set_cookie_header = dev_res.headers.get("set-cookie", "").lower()
    assert "httponly" in set_cookie_header
    assert "samesite=lax" in set_cookie_header
    assert "secure" not in set_cookie_header

    # Flip ENVIRONMENT to production and verify secure flag is dynamically emitted
    original_env = settings.ENVIRONMENT
    try:
        settings.ENVIRONMENT = "production"
        prod_res = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "reviewer", "password": "reviewer123"},
        )
        prod_cookie_header = prod_res.headers.get("set-cookie", "").lower()
        assert "httponly" in prod_cookie_header
        assert "samesite=lax" in prod_cookie_header
        assert "secure" in prod_cookie_header
    finally:
        settings.ENVIRONMENT = original_env
