"""
Authentication and Identity Business Logic Service.
Pure business logic — uses Argon2id cryptography and raises domain exceptions.
"""

from typing import Tuple

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import or_, select

from app.api.core.custom_exceptions.exceptions import AuthenticationError, NotFoundError
from app.api.core.security import create_access_token, verify_password
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.auth.schemas.auth_schemas import UserProfileUpdate


class AuthService:
    """Enterprise authentication service."""

    @staticmethod
    async def authenticate_user(
        username: str,
        password: str,
        session: AsyncSession,
    ) -> Tuple[User, str]:
        """
        Authenticates credentials against Argon2id hash and issues JWT bearer token.

        Raises:
            AuthenticationError: If credentials fail or user is disabled.
        """
        cleaned_identifier = username.strip().lower()
        statement = select(User).where(
            or_(
                func.lower(User.username) == cleaned_identifier,
                func.lower(User.email) == cleaned_identifier,
            )
        )
        result = await session.execute(statement)
        user = result.scalar_one_or_none()

        if not user:
            raise AuthenticationError("Invalid username or password")

        if not verify_password(password, user.hashed_password):
            raise AuthenticationError("Invalid username or password")

        if not user.is_active:
            raise AuthenticationError("User account is inactive or disabled")

        # Generate JWT Bearer Token
        token = create_access_token(
            data={
                "sub": user.user_id,
                "username": user.username,
                "role": user.role,
                "email": user.email,
            }
        )
        return user, token

    @staticmethod
    async def update_profile(
        user_id: str,
        update_data: UserProfileUpdate,
        session: AsyncSession,
    ) -> User:
        """
        Updates profile fields for the authenticated user.

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
