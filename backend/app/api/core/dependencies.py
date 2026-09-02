"""
Shared FastAPI Dependencies.
Includes authentication extraction and current user resolution.
"""

from typing import Annotated, Optional

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import (
    AuthenticationError,
    PermissionDeniedError,
)
from app.api.core.security import decode_access_token
from app.api.db.database import get_db
from app.api.modules.v1.auth.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> User:
    """
    Extracts and validates the authenticated user from the Authorization header
    or HttpOnly 'access_token' cookie.

    Raises:
        AuthenticationError: If token is missing, expired, or user does not exist.
    """
    token: Optional[str] = None

    # 1. Check Bearer Authorization Header
    if credentials:
        token = credentials.credentials

    # 2. Check Cookie fallback
    if not token and "access_token" in request.cookies:
        token = request.cookies["access_token"]

    if not token:
        raise AuthenticationError("Missing authentication token. Please log in.")

    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Malformed authentication token.")

    statement = select(User).where(User.user_id == user_id)
    result = await db.execute(statement)
    user = result.scalar_one_or_none()

    if not user:
        raise AuthenticationError("User associated with token no longer exists.")

    if not user.is_active:
        raise AuthenticationError("User account is inactive or disabled.")

    return user


async def get_current_user_optional(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
) -> Optional[User]:
    """
    Extracts authenticated user if token is present and valid,
    otherwise returns None without raising an exception.
    """
    try:
        return await get_current_user(request, credentials, db)
    except Exception:
        return None


def require_roles(allowed_roles: list[str]):
    """
    Dependency factory enforcing role-based access control (RBAC).

    Args:
        allowed_roles: List of permitted role names (case-insensitive).
    """

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role.lower() not in [r.lower() for r in allowed_roles]:
            raise PermissionDeniedError(
                f"Role '{current_user.role}' is not authorized for this operation. "
                f"Required role: {allowed_roles}"
            )
        return current_user

    return role_checker
