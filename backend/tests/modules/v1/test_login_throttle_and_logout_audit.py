"""
Repeated failed sign-ins pause sign-in for that account; sign-out is recorded.

The pause is the same whether or not the account exists, counts only the window, and ends by
itself. A throttled attempt is not counted again, so the pause is not extended by retrying.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.config import settings
from app.api.core.security import get_password_hash
from app.api.modules.v1.auth.models.user import User

LOGIN = "/api/v1/auth/login"


@pytest.fixture(autouse=True)
async def seed_user(db_session: AsyncSession):
    db_session.add(
        User(
            user_id="USR-THR-001",
            username="thr_user",
            email="thr_user@tris.internal",
            name="Throttle User",
            role="Reviewer",
            department="Finance",
            hashed_password=get_password_hash("right-password"),
            is_active=True,
        )
    )
    await db_session.commit()


async def fail(client: AsyncClient, who: str, times: int):
    for _ in range(times):
        res = await client.post(LOGIN, json={"username": who, "password": "wrong"})
        assert res.status_code == 401


async def count(session: AsyncSession, event: str) -> int:
    row = await session.execute(
        text("SELECT count(*) FROM security_audit_log WHERE event_type = :e"), {"e": event}
    )
    return row.scalar_one()


@pytest.mark.asyncio
async def test_the_limit_is_five_failures_in_fifteen_minutes_by_default():
    assert (settings.LOGIN_MAX_FAILURES, settings.LOGIN_LOCKOUT_MINUTES) == (5, 15)


@pytest.mark.asyncio
async def test_repeated_failures_pause_sign_in_even_with_the_right_password(
    async_client: AsyncClient, db_session: AsyncSession
):
    await fail(async_client, "thr_user", settings.LOGIN_MAX_FAILURES)
    res = await async_client.post(
        LOGIN, json={"username": "thr_user", "password": "right-password"}
    )
    assert res.status_code == 429
    assert res.json()["error_code"] == "TOO_MANY_ATTEMPTS"
    # Retrying while paused is not counted: still exactly the failures that caused the pause.
    await async_client.post(LOGIN, json={"username": "thr_user", "password": "wrong"})
    assert await count(db_session, "LOGIN_FAILURE") == settings.LOGIN_MAX_FAILURES


@pytest.mark.asyncio
async def test_one_identifier_being_paused_does_not_pause_another(
    async_client: AsyncClient,
):
    await fail(async_client, "thr_user", settings.LOGIN_MAX_FAILURES)
    other = await async_client.post(LOGIN, json={"username": "someone_else", "password": "wrong"})
    assert other.status_code == 401  # a different identifier is unaffected


@pytest.mark.asyncio
async def test_an_unknown_account_is_paused_the_same_way_so_nothing_is_revealed(
    async_client: AsyncClient,
):
    await fail(async_client, "no_such_user", settings.LOGIN_MAX_FAILURES)
    res = await async_client.post(LOGIN, json={"username": "no_such_user", "password": "x"})
    assert res.status_code == 429
    assert res.json()["message"] == "Too many attempts. Try again later."


@pytest.mark.asyncio
async def test_sign_in_works_again_once_the_failures_fall_outside_the_window(
    async_client: AsyncClient, monkeypatch
):
    await fail(async_client, "thr_user", settings.LOGIN_MAX_FAILURES)
    # The audit log cannot be edited, so shrink the window instead of ageing the rows.
    monkeypatch.setattr(settings, "LOGIN_LOCKOUT_MINUTES", 0)
    res = await async_client.post(
        LOGIN, json={"username": "thr_user", "password": "right-password"}
    )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_signing_out_is_recorded_with_who_signed_out(
    async_client: AsyncClient, db_session: AsyncSession
):
    login = await async_client.post(
        LOGIN, json={"username": "thr_user", "password": "right-password"}
    )
    token = login.json()["data"]["access_token"]
    out = await async_client.post(
        "/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"}
    )
    assert out.status_code == 200
    row = (
        await db_session.execute(
            text(
                "SELECT actor_id, actor_username FROM security_audit_log "
                "WHERE event_type = 'LOGOUT'"
            )
        )
    ).one()
    assert tuple(row) == ("USR-THR-001", "thr_user")


@pytest.mark.asyncio
async def test_signing_out_without_a_valid_session_still_works_and_records_nothing(
    async_client: AsyncClient, db_session: AsyncSession
):
    out = await async_client.post("/api/v1/auth/logout")
    assert out.status_code == 200
    assert await count(db_session, "LOGOUT") == 0
