"""
Shared FastAPI Dependencies.
Includes authentication extraction and current user resolution.
"""

from collections.abc import Sequence
from typing import Annotated, Optional

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.core.custom_exceptions.exceptions import (
    AuthenticationError,
    PermissionDeniedError,
)
from app.api.core.permissions import (
    PRIVILEGED_ROLES,
    ROLE_LABELS,
    WRITE_ROLES,
    Role,
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
        raise AuthenticationError("Authentication required. Please sign in.")

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


def require_roles(allowed_roles: Sequence[Role | str]):
    """
    Dependency factory enforcing role-based access control (RBAC).

    Args:
        allowed_roles: List or tuple of permitted roles (Role enum or string).
    """
    normalized_allowed = [str(r).lower() for r in allowed_roles]

    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        user_role_str = current_user.role.lower()
        if user_role_str not in normalized_allowed:
            readable_roles = [
                ROLE_LABELS.get(r, str(r).capitalize())  # type: ignore[arg-type]
                for r in normalized_allowed
            ]
            if len(readable_roles) == 1:
                roles_str = readable_roles[0]
            elif len(readable_roles) == 2:
                roles_str = f"{readable_roles[0]} or {readable_roles[1]}"
            else:
                roles_str = f"{', '.join(readable_roles[:-1])}, or {readable_roles[-1]}"

            user_role_label = ROLE_LABELS.get(
                user_role_str,
                current_user.role.capitalize(),  # type: ignore[arg-type]
            )
            raise PermissionDeniedError(
                f"Access restricted: Your account ({user_role_label}) "
                f"does not have permission for this operation. "
                f"This action requires {roles_str} privileges."
            )
        return current_user

    return role_checker


# ── Reusable Annotated Dependency Type Aliases ─────────────────────
AuthenticatedUser = Annotated[User, Depends(get_current_user)]
PrivilegedUser = Annotated[User, Depends(require_roles(PRIVILEGED_ROLES))]
WriteUser = Annotated[User, Depends(require_roles(WRITE_ROLES))]
DbSession = Annotated[AsyncSession, Depends(get_db)]
