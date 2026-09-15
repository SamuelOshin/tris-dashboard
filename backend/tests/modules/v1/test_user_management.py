"""
Unit and Integration Tests for User Management & Role Administration.
Tests admin access gates, user creation, role assignment, lockout prevention,
temporary credential issuance, authentication, and security audit log generation.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.security import get_password_hash
from app.api.modules.v1.auth.models.security_audit_log import SecurityAuditLog
from app.api.modules.v1.auth.models.user import User


@pytest.fixture(autouse=True)
async def seed_mgmt_identities(db_session: AsyncSession):
    """Seed distinct admin and standard reviewer for user management tests."""
    admin_user = User(
        user_id="USR-MGMT-ADM",
        username="mgmt_admin",
        email="mgmt_admin@tris.internal",
        name="Chief Admin",
        role="admin",
        department="Information Security",
        hashed_password=get_password_hash("adminsecret123"),
        is_active=True,
    )
    reviewer_user = User(
        user_id="USR-MGMT-REV",
        username="mgmt_reviewer",
        email="mgmt_reviewer@tris.internal",
        name="Standard Reviewer",
        role="reviewer",
        department="Finance",
        hashed_password=get_password_hash("reviewersecret123"),
        is_active=True,
    )
    db_session.add(admin_user)
    db_session.add(reviewer_user)
    await db_session.commit()


async def _get_token(async_client: AsyncClient, username: str, password: str) -> str:
    """Helper to authenticate and return bearer token."""
    res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    return res.json()["data"]["access_token"]


@pytest.mark.asyncio
async def test_admin_can_list_users(async_client: AsyncClient):
    """Verify administrator can retrieve the full user roster."""
    token = await _get_token(async_client, "mgmt_admin", "adminsecret123")
    res = await async_client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) >= 2
    usernames = [u["username"] for u in data]
    assert "mgmt_admin" in usernames
    assert "mgmt_reviewer" in usernames


@pytest.mark.asyncio
async def test_non_admin_cannot_access_user_management(async_client: AsyncClient):
    """Verify non-admin roles receive 403 Forbidden with PERMISSION_DENIED error."""
    token = await _get_token(async_client, "mgmt_reviewer", "reviewersecret123")
    res = await async_client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
    err = res.json()
    assert err["error_code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_admin_creates_user_and_new_user_can_login(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify admin creates a user, receives temp password, and user can authenticate."""
    token = await _get_token(async_client, "mgmt_admin", "adminsecret123")

    create_payload = {
        "name": "Sarah Connor",
        "email": "sarah.connor@tris.internal",
        "username": "sconnor",
        "role": "verifier",
        "department": "Internal Audit",
    }
    create_res = await async_client.post(
        "/api/v1/users",
        json=create_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    created_data = create_res.json()["data"]
    assert created_data["username"] == "sconnor"
    assert created_data["role"] == "verifier"
    assert created_data["department"] == "Internal Audit"
    assert created_data["is_active"] is True
    temp_pw = created_data["temporary_password"]
    assert len(temp_pw) >= 8

    # Verify newly created user can log in immediately
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "sconnor", "password": temp_pw},
    )
    assert login_res.status_code == 200
    assert login_res.json()["data"]["username"] == "sconnor"

    # Verify USER_CREATED audit log
    audit_stmt = select(SecurityAuditLog).where(SecurityAuditLog.event_type == "USER_CREATED")
    audit_res = await db_session.execute(audit_stmt)
    audit_logs = audit_res.scalars().all()
    assert any("sconnor" in str(log_entry.detail) for log_entry in audit_logs)


@pytest.mark.asyncio
async def test_duplicate_user_rejected(async_client: AsyncClient):
    """Verify creating a user with an existing email or username is rejected."""
    token = await _get_token(async_client, "mgmt_admin", "adminsecret123")

    # Duplicate email
    dup_res = await async_client.post(
        "/api/v1/users",
        json={
            "name": "Imposter",
            "email": "mgmt_reviewer@tris.internal",
            "role": "reviewer",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dup_res.status_code == 409
    assert dup_res.json()["error_code"] == "ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_invalid_role_rejected(async_client: AsyncClient):
    """Verify invalid role assignments fail validation."""
    token = await _get_token(async_client, "mgmt_admin", "adminsecret123")

    res = await async_client.post(
        "/api/v1/users",
        json={
            "name": "Hacker",
            "email": "hacker@tris.internal",
            "role": "super_root_overlord",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422
    assert res.json()["error_code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_admin_updates_user_role_and_department(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Verify administrator updates another user's role and department."""
    token = await _get_token(async_client, "mgmt_admin", "adminsecret123")

    update_res = await async_client.patch(
        "/api/v1/users/USR-MGMT-REV",
        json={"role": "process_owner", "department": "Supply Chain Operations"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()["data"]
    assert updated_data["role"] == "process_owner"
    assert updated_data["department"] == "Supply Chain Operations"

    # Verify audit log
    audit_stmt = select(SecurityAuditLog).where(
        SecurityAuditLog.event_type == "ROLE_PERMISSION_CHANGE"
    )
    audit_res = await db_session.execute(audit_stmt)
    logs = audit_res.scalars().all()
    assert any("USR-MGMT-REV" in str(log_entry.resource_id) for log_entry in logs)


@pytest.mark.asyncio
async def test_admin_self_lockout_prevention(async_client: AsyncClient):
    """Verify administrator is prevented from deactivating self or revoking own admin role."""
    token = await _get_token(async_client, "mgmt_admin", "adminsecret123")

    # Attempt self deactivation
    deactivate_res = await async_client.patch(
        "/api/v1/users/USR-MGMT-ADM",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert deactivate_res.status_code == 422
    assert "cannot deactivate their own active account" in deactivate_res.json()["message"]

    # Attempt self demotion
    demote_res = await async_client.patch(
        "/api/v1/users/USR-MGMT-ADM",
        json={"role": "reviewer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert demote_res.status_code == 422
    assert "cannot revoke their own administrator role" in demote_res.json()["message"]


@pytest.mark.asyncio
async def test_admin_password_reset(async_client: AsyncClient):
    """Verify administrator can issue a temporary password reset for an account."""
    admin_token = await _get_token(async_client, "mgmt_admin", "adminsecret123")

    reset_res = await async_client.post(
        "/api/v1/users/USR-MGMT-REV/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reset_res.status_code == 200
    new_temp_pw = reset_res.json()["data"]["temporary_password"]
    assert len(new_temp_pw) >= 8

    # Old password should fail
    old_login = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "mgmt_reviewer", "password": "reviewersecret123"},
    )
    assert old_login.status_code == 401

    # New temp password should succeed
    new_login = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "mgmt_reviewer", "password": new_temp_pw},
    )
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_self_service_change_password(async_client: AsyncClient):
    """Verify an authenticated user can change their own password."""
    rev_token = await _get_token(async_client, "mgmt_reviewer", "reviewersecret123")

    change_res = await async_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "reviewersecret123", "new_password": "newSecurePassword2026!"},
        headers={"Authorization": f"Bearer {rev_token}"},
    )
    assert change_res.status_code == 200
    assert change_res.json()["message"] == "Password changed successfully"

    # Verify login with new password
    login_check = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "mgmt_reviewer", "password": "newSecurePassword2026!"},
    )
    assert login_check.status_code == 200
