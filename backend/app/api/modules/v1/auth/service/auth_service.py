"""
Authentication and Identity Business Logic Service.
Pure business logic — uses Argon2id cryptography and raises domain exceptions.
"""

from typing import Tuple

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import or_, select

from app.api.core.custom_exceptions.exceptions import AuthenticationError
from app.api.core.security import create_access_token, verify_password
from app.api.modules.v1.auth.models.user import User


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
