"""
User Management Pydantic Schemas.
Pure request/response serialization — no business logic.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreateRequest(BaseModel):
    """Payload for administrator creating a new user account."""

    name: str = Field(..., min_length=2, max_length=200, description="Full display name")
    email: EmailStr = Field(..., description="Corporate email address")
    username: Optional[str] = Field(
        None, min_length=3, max_length=100, description="Unique username. Auto-derived if omitted."
    )
    role: str = Field(
        ..., description="Assigned system role (admin, reviewer, verifier, process_owner)"
    )
    department: Optional[str] = Field("Operations", max_length=100, description="Department name")
    temporary_password: Optional[str] = Field(
        None,
        min_length=8,
        max_length=100,
        description="Optional custom initial password. Auto-generated if omitted.",
    )


class UserUpdateRequest(BaseModel):
    """Payload for administrator updating user attributes or account status."""

    name: Optional[str] = Field(None, min_length=2, max_length=200)
    role: Optional[str] = Field(None, description="Updated system role")
    department: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = Field(None, description="Account active status")


class UserAdminResponse(BaseModel):
    """Administrative user record response DTO."""

    model_config = ConfigDict(from_attributes=True)

    user_id: str
    username: str
    name: str
    email: str
    role: str
    department: str
    is_active: bool
    created_at: datetime


class UserCreatedResponse(UserAdminResponse):
    """Response returned upon user creation, containing the temporary password."""

    temporary_password: str


class PasswordResetResponse(BaseModel):
    """Response returned upon administrator issuing a temporary password reset."""

    user_id: str
    username: str
    temporary_password: str
    message: str


class ChangePasswordRequest(BaseModel):
    """Payload for an authenticated user to change their own password."""

    current_password: str = Field(..., min_length=1, description="Current account password")
    new_password: str = Field(..., min_length=8, max_length=100, description="New account password")
