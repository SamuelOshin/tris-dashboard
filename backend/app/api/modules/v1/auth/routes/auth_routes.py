"""
Authentication HTTP Gateway Routes.
HTTP transport only — max 50 lines per handler, no business logic, no try-except.
"""

from fastapi import APIRouter, Request, Response, status

from app.api.core.config import settings
from app.api.core.dependencies import AuthenticatedUser, DbSession, OptionalUser
from app.api.modules.v1.auth.models.user import User
from app.api.modules.v1.auth.schemas.auth_schemas import (
    DemoLoginRequest,
    LoginRequest,
    UserProfileUpdate,
    UserResponse,
)
from app.api.modules.v1.auth.service.auth_service import AuthService
from app.api.modules.v1.auth.service.security_audit_service import SecurityAuditService
from app.api.modules.v1.users.schemas.user_schemas import ChangePasswordRequest
from app.api.modules.v1.users.service.user_service import UserService
from app.api.utils.response_payloads import auth_response, success_response

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _session_response(user: User, token: str, message: str) -> Response:
    """The sign-in reply: the user in the body, the session in the HttpOnly cookie."""
    res = auth_response(
        status_code=status.HTTP_200_OK,
        message=message,
        access_token=token,
        data=UserResponse.model_validate(user).model_dump(),
    )
    res.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
    )
    return res


@router.post("/login", response_model=None)
async def login(
    payload: LoginRequest,
    request: Request,
    db: DbSession = None,
):
    """
    Authenticate user and issue session.
    - Web UI authenticates via the server-set HttpOnly cookie (no JS access).
    - Non-browser API clients (ERP pipelines, CLI scripts) receive the Bearer token in the body.
    """
    ip = request.client.host if request.client else None
    user, token = await AuthService.authenticate_user(
        username=payload.username,
        password=payload.password,
        session=db,
        ip_address=ip,
    )
    return _session_response(user, token, "Login successful")


@router.get("/demo-accounts", response_model=None)
async def demo_accounts():
    """Whether one-click demo sign-in is on, and the roles it offers (no passwords)."""
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Demo accounts",
        data=AuthService.demo_accounts(),
    )


@router.post("/demo-login", response_model=None)
async def demo_login(payload: DemoLoginRequest, request: Request, db: DbSession = None):
    """Sign in as a demo role without a password. Not found unless demo sign-in is switched on."""
    ip = request.client.host if request.client else None
    user, token = await AuthService.demo_login(payload.role, db, ip)
    return _session_response(user, token, "Demo sign-in successful")


@router.get("/me", response_model=None)
async def get_me(current_user: AuthenticatedUser):
    """Retrieve profile of currently authenticated user."""
    user_data = UserResponse.model_validate(current_user).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="User profile retrieved successfully",
        data=user_data,
    )


@router.patch("/me", response_model=None)
async def update_me(
    payload: UserProfileUpdate,
    current_user: AuthenticatedUser,
    db: DbSession = None,
):
    """Update profile details for currently authenticated user."""
    updated_user = await AuthService.update_profile(
        user_id=current_user.user_id,
        update_data=payload,
        session=db,
    )
    user_data = UserResponse.model_validate(updated_user).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Profile updated successfully",
        data=user_data,
    )


@router.post("/logout", response_model=None)
async def logout(request: Request, db: DbSession = None, user: OptionalUser = None):
    """Clear authentication session cookie; record the sign-out when the session is still valid."""
    if user is not None:
        await SecurityAuditService.log_logout(
            session=db,
            actor_id=user.user_id,
            actor_username=user.username,
            actor_role=str(getattr(user.role, "value", user.role)),
            ip_address=request.client.host if request.client else None,
        )
    res = success_response(
        status_code=status.HTTP_200_OK,
        message="Logout successful",
        data=None,
    )
    res.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
    )
    return res


@router.post("/change-password", response_model=None)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: AuthenticatedUser,
    db: DbSession = None,
):
    """Allow currently authenticated user to change their account password."""
    await UserService.change_password(
        user_id=current_user.user_id,
        current_password=payload.current_password,
        new_password=payload.new_password,
        session=db,
    )
    return success_response(
        status_code=status.HTTP_200_OK,
        message="Password changed successfully",
        data=None,
    )
