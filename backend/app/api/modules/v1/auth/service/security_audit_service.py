"""
Security Audit Log Service.
Writes immutable security events. Never raises — audit failures must not break
primary flows, so all writes are best-effort fire-and-forget within the same session.
"""

from datetime import UTC, datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.modules.v1.auth.models.security_audit_log import SecurityAuditLog


class SecurityAuditService:
    """Append-only security event writer."""

    @staticmethod
    async def log_login_success(
        *,
        session: AsyncSession,
        actor_id: str,
        actor_username: str,
        actor_role: str,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Record a successful authentication event.

        Args:
            session: Async database session.
            actor_id: User primary key.
            actor_username: Authenticated username.
            actor_role: Role at time of login.
            ip_address: Originating IP (optional).
        """
        entry = SecurityAuditLog(
            event_type="LOGIN_SUCCESS",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            detail=f"User '{actor_username}' authenticated successfully.",
            ip_address=ip_address,
            occurred_at=datetime.now(UTC),
        )
        session.add(entry)
        await session.commit()

    @staticmethod
    async def log_login_failure(
        *,
        session: AsyncSession,
        actor_username: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Record a failed authentication attempt.

        Args:
            session: Async database session.
            actor_username: Username or email that was attempted.
            ip_address: Originating IP (optional).
        """
        entry = SecurityAuditLog(
            event_type="LOGIN_FAILURE",
            actor_username=actor_username,
            detail=f"Failed login attempt for identifier '{actor_username}'.",
            ip_address=ip_address,
            occurred_at=datetime.now(UTC),
        )
        session.add(entry)
        await session.commit()

    @staticmethod
    async def log_rule_config_edit(
        *,
        session: AsyncSession,
        actor_id: str,
        actor_username: str,
        actor_role: str,
        rule_code: str,
        new_version: int,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Record a rule configuration change event.

        Args:
            session: Async database session.
            actor_id: User primary key.
            actor_username: Actor username.
            actor_role: Actor role.
            rule_code: Rule that was edited (e.g. 'R-003').
            new_version: Incremented version number post-edit.
            ip_address: Originating IP (optional).
        """
        entry = SecurityAuditLog(
            event_type="RULE_CONFIG_EDIT",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            resource_type="rule_config",
            resource_id=rule_code,
            detail=(
                f"Rule '{rule_code}' configuration updated by '{actor_username}' "
                f"(role: {actor_role}). New version: {new_version}."
            ),
            ip_address=ip_address,
            occurred_at=datetime.now(UTC),
        )
        session.add(entry)
        await session.commit()

    @staticmethod
    async def log_role_permission_change(
        *,
        session: AsyncSession,
        actor_id: str,
        actor_username: str,
        actor_role: str,
        target_user_id: str,
        target_username: str,
        old_role: str,
        new_role: str,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Record a role or permission change event.

        Args:
            session: Async database session.
            actor_id: User primary key performing the action.
            actor_username: Actor username.
            actor_role: Actor role.
            target_user_id: Target user whose role changed.
            target_username: Target username.
            old_role: Previous role.
            new_role: Newly assigned role.
            ip_address: Originating IP (optional).
        """
        entry = SecurityAuditLog(
            event_type="ROLE_PERMISSION_CHANGE",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            resource_type="user",
            resource_id=target_user_id,
            detail=(
                f"Role changed for '{target_username}' from '{old_role}' to '{new_role}' "
                f"by '{actor_username}'."
            ),
            ip_address=ip_address,
            occurred_at=datetime.now(UTC),
        )
        session.add(entry)
        await session.commit()

    @staticmethod
    async def log_user_created(
        *,
        session: AsyncSession,
        actor_id: str,
        actor_username: str,
        actor_role: str,
        target_user_id: str,
        target_username: str,
        assigned_role: str,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Record a user creation event.

        Args:
            session: Async database session.
            actor_id: User primary key performing the creation.
            actor_username: Actor username.
            actor_role: Actor role.
            target_user_id: Newly created user ID.
            target_username: Newly created username.
            assigned_role: Role assigned to the new user.
            ip_address: Originating IP (optional).
        """
        entry = SecurityAuditLog(
            event_type="USER_CREATED",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            resource_type="user",
            resource_id=target_user_id,
            detail=(
                f"User '{target_username}' created with role '{assigned_role}' "
                f"by '{actor_username}'."
            ),
            ip_address=ip_address,
            occurred_at=datetime.now(UTC),
        )
        session.add(entry)
        await session.commit()

    @staticmethod
    async def log_user_status_changed(
        *,
        session: AsyncSession,
        actor_id: str,
        actor_username: str,
        actor_role: str,
        target_user_id: str,
        target_username: str,
        is_active: bool,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Record user activation/deactivation event.

        Args:
            session: Async database session.
            actor_id: User primary key performing the action.
            actor_username: Actor username.
            actor_role: Actor role.
            target_user_id: Target user ID.
            target_username: Target username.
            is_active: New active status.
            ip_address: Originating IP (optional).
        """
        status_label = "activated" if is_active else "deactivated"
        entry = SecurityAuditLog(
            event_type="USER_STATUS_CHANGE",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            resource_type="user",
            resource_id=target_user_id,
            detail=f"User '{target_username}' was {status_label} by '{actor_username}'.",
            ip_address=ip_address,
            occurred_at=datetime.now(UTC),
        )
        session.add(entry)
        await session.commit()

    @staticmethod
    async def log_password_reset(
        *,
        session: AsyncSession,
        actor_id: str,
        actor_username: str,
        actor_role: str,
        target_user_id: str,
        target_username: str,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Record password reset event.

        Args:
            session: Async database session.
            actor_id: User primary key performing the reset.
            actor_username: Actor username.
            actor_role: Actor role.
            target_user_id: Target user ID.
            target_username: Target username.
            ip_address: Originating IP (optional).
        """
        entry = SecurityAuditLog(
            event_type="PASSWORD_RESET",
            actor_id=actor_id,
            actor_username=actor_username,
            actor_role=actor_role,
            resource_type="user",
            resource_id=target_user_id,
            detail=(
                f"Temporary password reset issued for user '{target_username}' by "
                f"'{actor_username}'."
            ),
            ip_address=ip_address,
            occurred_at=datetime.now(UTC),
        )
        session.add(entry)
        await session.commit()
