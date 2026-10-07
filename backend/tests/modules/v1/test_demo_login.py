"""
One-click demo sign-in: off by default, offers only the listed demo roles, never returns a
password, and records every use in the audit log.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.config import settings
from app.api.core.security import get_password_hash
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.auth.service.demo_accounts import DEMO_ACCOUNTS
from app.scripts.seed import DEMO_PERSONAS

ACCOUNTS = "/api/v1/auth/demo-accounts"
LOGIN = "/api/v1/auth/demo-login"


@pytest.fixture
async def demo_users(db_session: AsyncSession):
    """The seeded demo users that the panel signs in as."""
    by_name = {p["username"]: p for p in DEMO_PERSONAS}
    for account in DEMO_ACCOUNTS:
        p = by_name[account.username]
        db_session.add(
            User(
                user_id=p["user_id"],
                username=p["username"],
                email=p["email"],
                name=p["name"],
                role=p["role"],
                department=p["department"],
                hashed_password=get_password_hash(p["password"]),
                is_active=True,
            )
        )
    await db_session.commit()


@pytest.fixture
def demo_on(monkeypatch):
    monkeypatch.setattr(settings, "DEMO_LOGIN_ENABLED", True)


def test_demo_sign_in_is_off_by_default():
    assert settings.model_fields["DEMO_LOGIN_ENABLED"].default is False


def test_every_demo_role_names_a_seeded_user():
    seeded = {p["username"]: p["role"] for p in DEMO_PERSONAS}
    assert {a.username for a in DEMO_ACCOUNTS} <= set(seeded)
    assert len({a.key for a in DEMO_ACCOUNTS}) == len(DEMO_ACCOUNTS)


@pytest.mark.asyncio
async def test_when_off_the_list_is_empty_and_signing_in_is_not_found(
    async_client: AsyncClient, demo_users, monkeypatch
):
    # Whatever a local .env says, this test is about the switch being off.
    monkeypatch.setattr(settings, "DEMO_LOGIN_ENABLED", False)
    listed = (await async_client.get(ACCOUNTS)).json()["data"]
    assert listed == {"enabled": False, "accounts": []}
    res = await async_client.post(LOGIN, json={"role": "admin"})
    assert res.status_code == 404
    assert "access_token" not in res.cookies


@pytest.mark.asyncio
async def test_when_on_the_list_has_every_role_and_no_passwords(
    async_client: AsyncClient, demo_on, demo_users
):
    res = await async_client.get(ACCOUNTS)
    listed = res.json()["data"]
    assert listed["enabled"] is True
    assert [a["key"] for a in listed["accounts"]] == [a.key for a in DEMO_ACCOUNTS]
    body = res.text.lower()
    assert "password" not in body and "hash" not in body
    for persona in DEMO_PERSONAS:
        assert persona["password"] not in res.text


@pytest.mark.asyncio
async def test_each_role_signs_in_as_its_user_with_a_session_and_is_audited(
    async_client: AsyncClient, db_session: AsyncSession, demo_on, demo_users
):
    for account in DEMO_ACCOUNTS:
        res = await async_client.post(LOGIN, json={"role": account.key})
        assert res.status_code == 200, (account.key, res.text)
        data = res.json()["data"]
        assert data["username"] == account.username and data["access_token"]
        assert "access_token" in res.cookies
        me = await async_client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"}
        )
        assert me.status_code == 200
    rows = (
        (
            await db_session.execute(
                text(
                    "SELECT actor_username FROM security_audit_log WHERE event_type = 'DEMO_LOGIN'"
                )
            )
        )
        .scalars()
        .all()
    )
    assert sorted(rows) == sorted(a.username for a in DEMO_ACCOUNTS)


@pytest.mark.asyncio
async def test_only_the_listed_roles_work_and_other_users_cannot_be_reached(
    async_client: AsyncClient, demo_on, demo_users
):
    for role in ("sarah", "james", "Admin ", "", "x" * 60, "usr-admin-03"):
        res = await async_client.post(LOGIN, json={"role": role})
        assert res.status_code in (404, 422), (role, res.status_code)
        assert "access_token" not in res.cookies


@pytest.mark.asyncio
async def test_a_disabled_demo_user_cannot_be_signed_in_as(
    async_client: AsyncClient, db_session: AsyncSession, demo_on, demo_users
):
    await db_session.execute(text("UPDATE users SET is_active = false WHERE username = 'reviewer'"))
    await db_session.commit()
    res = await async_client.post(LOGIN, json={"role": "reviewer"})
    assert res.status_code == 404
