"""
User Management HTTP Gateway Routes.
HTTP transport only — max 50 lines per handler, no business logic, no try-except.
Gated to System Administrator role.
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Request, status

from app.api.core.dependencies import DbSession, require_roles
from app.api.core.permissions import Role
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.users.schemas.user_schemas import (
    PasswordResetResponse,
    UserAdminResponse,
    UserCreatedResponse,
    UserCreateRequest,
    UserUpdateRequest,
)
from app.api.modules.v1.users.service.user_service import UserService
from app.api.utils.response_payloads import success_response

router = APIRouter(prefix="/users", tags=["User Administration"])

AdminUser = Annotated[User, Depends(require_roles([Role.ADMIN]))]


@router.get("", response_model=None)
async def list_users(
    admin: AdminUser,
    db: DbSession,
    role: Optional[str] = Query(None, description="Filter by role"),
    department: Optional[str] = Query(None, description="Filter by department"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search name, username, or email"),
):
    """List all users in the system with optional filtering."""
    users = await UserService.list_users(
        session=db,
        role_filter=role,
        department_filter=department,
        is_active_filter=is_active,
        search=search,
    )
    data = [UserAdminResponse.model_validate(u).model_dump() for u in users]
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Users retrieved successfully",
        data=data,
    )


@router.post("", response_model=None)
async def create_user(
    payload: UserCreateRequest,
    admin: AdminUser,
    db: DbSession,
    request: Request,
):
    """Create a new user account with role assignment and temporary credentials."""
    ip = request.client.host if request.client else None
    user, temp_password = await UserService.create_user(
        payload=payload,
        actor=admin,
        session=db,
        ip_address=ip,
    )
    user_dict = UserAdminResponse.model_validate(user).model_dump()
    resp_data = UserCreatedResponse(**user_dict, temporary_password=temp_password).model_dump()
    return success_response(
        status_code=status.HTTP_201_CREATED,
        message=f"User '{user.username}' created successfully",
        data=resp_data,
    )


@router.get("/{user_id}", response_model=None)
async def get_user(
    user_id: str,
    admin: AdminUser,
    db: DbSession,
):
    """Fetch details for a specific user."""
    user = await UserService.get_user_by_id(user_id=user_id, session=db)
    data = UserAdminResponse.model_validate(user).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="User details retrieved successfully",
        data=data,
    )


@router.patch("/{user_id}", response_model=None)
async def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    admin: AdminUser,
    db: DbSession,
    request: Request,
):
    """Update user profile, role, or active status."""
    ip = request.client.host if request.client else None
    updated = await UserService.update_user(
        user_id=user_id,
        payload=payload,
        actor=admin,
        session=db,
        ip_address=ip,
    )
    data = UserAdminResponse.model_validate(updated).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="User updated successfully",
        data=data,
    )


@router.post("/{user_id}/reset-password", response_model=None)
async def reset_user_password(
    user_id: str,
    admin: AdminUser,
    db: DbSession,
    request: Request,
):
    """Generate a high-entropy temporary password for a user account."""
    ip = request.client.host if request.client else None
    user, temp_password = await UserService.reset_password(
        user_id=user_id,
        actor=admin,
        session=db,
        ip_address=ip,
    )
    resp = PasswordResetResponse(
        user_id=user.user_id,
        username=user.username,
        temporary_password=temp_password,
        message=f"Temporary password reset issued for '{user.username}'.",
    ).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Temporary password generated successfully",
        data=resp,
    )
