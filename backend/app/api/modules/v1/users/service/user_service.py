"""
User Management Business Service.
Contains all user administration, role assignment, lockout guards,
Argon2id password hashing, and security audit trail emission.
Pure business logic — raises custom domain exceptions directly. No try-except masking.
"""

import re
import secrets
import string
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col, or_, select

from app.api.core.custom_exceptions.exceptions import (
    AlreadyExistsError,
    AuthenticationError,
    NotFoundError,
    ValidationError,
)
from app.api.core.permissions import ALL_ROLES, Role
from app.api.core.security import get_password_hash, verify_password
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.auth.service.security_audit_service import SecurityAuditService
from app.api.modules.v1.users.schemas.user_schemas import (
    UserCreateRequest,
    UserUpdateRequest,
)


def _generate_temporary_password(length: int = 12) -> str:
    """Generate a high-entropy temporary password containing uppercase, lowercase, and digits."""
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(chars) for _ in range(length))


class UserService:
    """Service layer for administrative user operations."""

    @staticmethod
    async def list_users(
        *,
        session: AsyncSession,
        role_filter: Optional[str] = None,
        department_filter: Optional[str] = None,
        is_active_filter: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> list[User]:
        """
        List all user records matching the specified filters.

        Args:
            session: Async database session.
            role_filter: Optional role filter.
            department_filter: Optional department filter.
            is_active_filter: Optional active flag filter.
            search: Optional text query across username, name, or email.

        Returns:
            list[User]: Matching user records ordered by creation date descending.
        """
        stmt = select(User)

        if role_filter:
            stmt = stmt.where(col(User.role).ilike(role_filter))
        if department_filter:
            stmt = stmt.where(col(User.department).ilike(department_filter))
        if is_active_filter is not None:
            stmt = stmt.where(User.is_active == is_active_filter)
        if search:
            search_pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    col(User.username).ilike(search_pattern),
                    col(User.name).ilike(search_pattern),
                    col(User.email).ilike(search_pattern),
                )
            )

        stmt = stmt.order_by(User.created_at.desc())
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_user_by_id(user_id: str, *, session: AsyncSession) -> User:
        """
        Fetch a single user by primary key.

        Args:
            user_id: Target user ID.
            session: Async database session.

        Returns:
            User: User record.

        Raises:
            NotFoundError: If user does not exist.
        """
        stmt = select(User).where(User.user_id == user_id)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            raise NotFoundError(f"User with ID '{user_id}' was not found.")
        return user

    @staticmethod
    async def create_user(
        *,
        payload: UserCreateRequest,
        actor: User,
        session: AsyncSession,
        ip_address: Optional[str] = None,
    ) -> tuple[User, str]:
        """
        Create a new user account with assigned role and temporary password.

        Args:
            payload: User creation data.
            actor: Administrator performing the creation.
            session: Async database session.
            ip_address: Client IP address (optional).

        Returns:
            tuple[User, str]: Newly created user entity and unhashed temporary password.

        Raises:
            ValidationError: If role is unrecognized or inputs are invalid.
            AlreadyExistsError: If email or username is already taken.
        """
        # 1. Validate role
        normalized_role = payload.role.strip().lower()
        valid_roles = [str(r).lower() for r in ALL_ROLES]
        if normalized_role not in valid_roles:
            raise ValidationError(
                f"Role '{payload.role}' is invalid. Allowed roles: {', '.join(valid_roles)}."
            )

        # 2. Derive username if not provided
        email_clean = payload.email.strip().lower()
        if payload.username:
            username = payload.username.strip().lower()
        else:
            username = email_clean.split("@")[0]
        # Clean username to alphanumeric and underscores/hyphens
        username = re.sub(r"[^a-z0-9_-]", "_", username)

        # 3. Check uniqueness
        check_stmt = select(User).where(or_(User.email == email_clean, User.username == username))
        res = await session.execute(check_stmt)
        existing = res.scalar_one_or_none()
        if existing:
            if existing.email.lower() == email_clean:
                raise AlreadyExistsError(f"A user with email '{email_clean}' already exists.")
            raise AlreadyExistsError(f"Username '{username}' is already taken.")

        # 4. Generate or use temporary password
        temporary_password = payload.temporary_password or _generate_temporary_password(12)
        hashed_pw = get_password_hash(temporary_password)

        # 5. Construct and persist user
        user_id = f"usr-{secrets.token_hex(4)}"
        new_user = User(
            user_id=user_id,
            username=username,
            name=payload.name.strip(),
            email=email_clean,
            hashed_password=hashed_pw,
            role=normalized_role,
            department=payload.department.strip() if payload.department else "Operations",
            is_active=True,
        )
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)

        # 6. Emit security audit event
        await SecurityAuditService.log_user_created(
            session=session,
            actor_id=actor.user_id,
            actor_username=actor.username,
            actor_role=actor.role,
            target_user_id=new_user.user_id,
            target_username=new_user.username,
            assigned_role=new_user.role,
            ip_address=ip_address,
        )

        return new_user, temporary_password

    @staticmethod
    async def update_user(
        *,
        user_id: str,
        payload: UserUpdateRequest,
        actor: User,
        session: AsyncSession,
        ip_address: Optional[str] = None,
    ) -> User:
        """
        Update user profile attributes, role, or active status.
        Enforces self-lockout guards for administrators.

        Args:
            user_id: Target user ID.
            payload: Update fields.
            actor: Authenticated administrator.
            session: Async database session.
            ip_address: Client IP address (optional).

        Returns:
            User: Updated user entity.

        Raises:
            NotFoundError: If target user does not exist.
            ValidationError: If lockout guard or role validation fails.
        """
        user = await UserService.get_user_by_id(user_id, session=session)

        # Self-lockout prevention guards
        is_self = user.user_id == actor.user_id

        if is_self and payload.is_active is False:
            raise ValidationError(
                "Administrators cannot deactivate their own active account."
            )

        if payload.role is not None:
            normalized_role = payload.role.strip().lower()
            valid_roles = [str(r).lower() for r in ALL_ROLES]
            if normalized_role not in valid_roles:
                raise ValidationError(
                    f"Role '{payload.role}' is invalid. Allowed roles: {', '.join(valid_roles)}."
                )
            if is_self and normalized_role != Role.ADMIN:
                raise ValidationError(
                    "Administrators cannot revoke their own administrator role."
                )

            if normalized_role != user.role.lower():
                old_role = user.role
                user.role = normalized_role
                await SecurityAuditService.log_role_permission_change(
                    session=session,
                    actor_id=actor.user_id,
                    actor_username=actor.username,
                    actor_role=actor.role,
                    target_user_id=user.user_id,
                    target_username=user.username,
                    old_role=old_role,
                    new_role=normalized_role,
                    ip_address=ip_address,
                )

        if payload.is_active is not None and payload.is_active != user.is_active:
            user.is_active = payload.is_active
            await SecurityAuditService.log_user_status_changed(
                session=session,
                actor_id=actor.user_id,
                actor_username=actor.username,
                actor_role=actor.role,
                target_user_id=user.user_id,
                target_username=user.username,
                is_active=user.is_active,
                ip_address=ip_address,
            )

        if payload.name is not None:
            user.name = payload.name.strip()

        if payload.department is not None:
            user.department = payload.department.strip()

        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

    @staticmethod
    async def reset_password(
        *,
        user_id: str,
        actor: User,
        session: AsyncSession,
        ip_address: Optional[str] = None,
    ) -> tuple[User, str]:
        """
        Issue a high-entropy temporary password for a user account.

        Args:
            user_id: Target user ID.
            actor: Authenticated administrator.
            session: Async database session.
            ip_address: Client IP address (optional).

        Returns:
            tuple[User, str]: Target user entity and new temporary password.

        Raises:
            NotFoundError: If target user does not exist.
        """
        user = await UserService.get_user_by_id(user_id, session=session)
        temporary_password = _generate_temporary_password(12)
        user.hashed_password = get_password_hash(temporary_password)

        session.add(user)
        await session.commit()
        await session.refresh(user)

        await SecurityAuditService.log_password_reset(
            session=session,
            actor_id=actor.user_id,
            actor_username=actor.username,
            actor_role=actor.role,
            target_user_id=user.user_id,
            target_username=user.username,
            ip_address=ip_address,
        )

        return user, temporary_password

    @staticmethod
    async def change_password(
        *,
        user_id: str,
        current_password: str,
        new_password: str,
        session: AsyncSession,
    ) -> None:
        """
        Allow an authenticated user to change their own password.

        Args:
            user_id: Authenticated user ID.
            current_password: Plain text current password.
            new_password: Plain text new password.
            session: Async database session.

        Raises:
            NotFoundError: If user not found.
            AuthenticationError: If current password does not verify.
            ValidationError: If new password fails strength rules.
        """
        user = await UserService.get_user_by_id(user_id, session=session)

        if not verify_password(current_password, user.hashed_password):
            raise AuthenticationError("Current password is incorrect.")

        if len(new_password) < 8:
            raise ValidationError("New password must be at least 8 characters long.")

        user.hashed_password = get_password_hash(new_password)
        session.add(user)
        await session.commit()
