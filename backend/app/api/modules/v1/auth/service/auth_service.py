"""
Authentication and Identity Business Logic Service.
Pure business logic — uses Argon2id cryptography and raises domain exceptions.
"""

from datetime import UTC, datetime, timedelta
from typing import Tuple

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import or_, select

from app.api.core.config import settings
from app.api.core.custom_exceptions.exceptions import (
    AuthenticationError,
    NotFoundError,
    TooManyAttemptsError,
)
from app.api.core.security import create_access_token, verify_password
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.auth.schemas.auth_schemas import UserProfileUpdate
from app.api.modules.v1.auth.service.demo_accounts import BY_KEY, DEMO_ACCOUNTS
from app.api.modules.v1.auth.service.security_audit_service import SecurityAuditService


class AuthService:
    """Enterprise authentication service."""

    @staticmethod
    async def authenticate_user(
        username: str,
        password: str,
        session: AsyncSession,
        ip_address: str | None = None,
    ) -> Tuple[User, str]:
        """
        Authenticates credentials against Argon2id hash and issues JWT bearer token.
        Writes a SecurityAuditLog entry for both success and failure.

        Args:
            username: Username or email identifier.
            password: Plaintext password for verification.
            session: Async database session.
            ip_address: Originating client IP (optional, for audit log).

        Raises:
            AuthenticationError: If credentials fail or user is disabled.
            TooManyAttemptsError: If the account has too many recent failed attempts.
        """
        cleaned_identifier = username.strip().lower()
        # Stored times are naive UTC, so compare with a naive UTC time.
        window_start = datetime.now(UTC).replace(tzinfo=None) - timedelta(
            minutes=settings.LOGIN_LOCKOUT_MINUTES
        )
        recent_failures = await SecurityAuditService.count_recent_login_failures(
            session=session, identifier=cleaned_identifier, since=window_start
        )
        if recent_failures >= settings.LOGIN_MAX_FAILURES:
            # Same answer whether or not the account exists; nothing is recorded, so the pause
            # ends LOGIN_LOCKOUT_MINUTES after the last counted failure.
            raise TooManyAttemptsError()
        statement = select(User).where(
            or_(
                func.lower(User.username) == cleaned_identifier,
                func.lower(User.email) == cleaned_identifier,
            )
        )
        result = await session.execute(statement)
        user = result.scalar_one_or_none()

        if not user:
            await SecurityAuditService.log_login_failure(
                session=session,
                actor_username=cleaned_identifier,
                ip_address=ip_address,
            )
            raise AuthenticationError("Invalid username or password")

        if not verify_password(password, user.hashed_password):
            await SecurityAuditService.log_login_failure(
                session=session,
                actor_username=cleaned_identifier,
                ip_address=ip_address,
            )
            raise AuthenticationError("Invalid username or password")

        if not user.is_active:
            raise AuthenticationError("User account is inactive or disabled")

        token = AuthService._issue_token(user)

        await SecurityAuditService.log_login_success(
            session=session,
            actor_id=user.user_id,
            actor_username=user.username,
            actor_role=user.role,
            ip_address=ip_address,
        )

        return user, token

    @staticmethod
    def _issue_token(user: User) -> str:
        """Sign the access token for a user (the same token for password and demo sign-in)."""
        return create_access_token(
            data={
                "sub": user.user_id,
                "username": user.username,
                "role": user.role,
                "email": user.email,
            }
        )

    @staticmethod
    def demo_accounts() -> dict:
        """
        The one-click demo roles, or an empty list when demo sign-in is switched off.

        Returns:
            A dict with `enabled` and `accounts` (key, username, label, description; no passwords).
        """
        if not settings.DEMO_LOGIN_ENABLED:
            return {"enabled": False, "accounts": []}
        return {
            "enabled": True,
            "accounts": [
                {
                    "key": a.key,
                    "username": a.username,
                    "label": a.label,
                    "description": a.description,
                }
                for a in DEMO_ACCOUNTS
            ],
        }

    @staticmethod
    async def demo_login(
        role_key: str, session: AsyncSession, ip_address: str | None = None
    ) -> Tuple[User, str]:
        """
        Sign in as one of the listed demo users without a password.

        Args:
            role_key: One of the keys in `DEMO_ACCOUNTS`.
            session: Async database session.
            ip_address: Originating client IP (optional, for the audit log).

        Raises:
            NotFoundError: If demo sign-in is switched off, the role is not a demo role, or the
                demo user does not exist or is disabled. Nothing says which, so a deployment
                without the switch looks the same as one that never had it.
        """
        account = BY_KEY.get(role_key)
        if not settings.DEMO_LOGIN_ENABLED or account is None:
            raise NotFoundError("Not found")
        result = await session.execute(select(User).where(User.username == account.username))
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise NotFoundError("Not found")
        await SecurityAuditService.log_demo_login(
            session=session,
            actor_id=user.user_id,
            actor_username=user.username,
            actor_role=user.role,
            ip_address=ip_address,
        )
        return user, AuthService._issue_token(user)

    @staticmethod
    async def update_profile(
        user_id: str,
        update_data: UserProfileUpdate,
        session: AsyncSession,
    ) -> User:
        """
        Updates profile fields for the authenticated user.

        Args:
            user_id: Primary key of the user to update.
            update_data: Fields to update.
            session: Async database session.

        Raises:
            NotFoundError: If user does not exist.
        """
        user = await session.get(User, user_id)
        if not user:
            raise NotFoundError(f"User with ID '{user_id}' not found")

        if update_data.name is not None:
            user.name = update_data.name.strip()
        if update_data.department is not None:
            user.department = update_data.department.strip()

        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user
