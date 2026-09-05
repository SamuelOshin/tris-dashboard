"""
Authentication HTTP Gateway Routes.
HTTP transport only — max 50 lines per handler, no business logic, no try-except.
"""

from fastapi import APIRouter, Response, status

from app.api.core.config import settings
from app.api.core.dependencies import AuthenticatedUser, DbSession
from app.api.modules.v1.auth.schemas.auth_schemas import LoginRequest, UserResponse
from app.api.modules.v1.auth.service.auth_service import AuthService
from app.api.utils.response_payloads import auth_response, success_response

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=None)
async def login(
    payload: LoginRequest,
    response: Response,
    db: DbSession = None,
):
    """
    Authenticate user and issue session.
    - Web UI authenticates via the server-set HttpOnly cookie (no JS access).
    - Non-browser API clients (ERP pipelines, CLI scripts) receive the Bearer token in the body.
    """
    user, token = await AuthService.authenticate_user(
        username=payload.username,
        password=payload.password,
        session=db,
    )
    user_data = UserResponse.model_validate(user).model_dump()
    res = auth_response(
        status_code=status.HTTP_200_OK,
        message="Login successful",
        access_token=token,
        data=user_data,
    )
    res.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
    )
    return res


@router.get("/me", response_model=None)
async def get_me(current_user: AuthenticatedUser):
    """Retrieve profile of currently authenticated user."""
    user_data = UserResponse.model_validate(current_user).model_dump()
    return success_response(
        status_code=status.HTTP_200_OK,
        message="User profile retrieved successfully",
        data=user_data,
    )


@router.post("/logout", response_model=None)
async def logout(response: Response):
    """Clear authentication session cookie."""
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
