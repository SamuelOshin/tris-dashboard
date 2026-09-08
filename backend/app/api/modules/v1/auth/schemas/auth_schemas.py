"""
Authentication Pydantic DTO Schemas.
Pure request/response serialization — no business logic.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    """User login request payload."""

    username: str
    password: str


class UserProfileUpdate(BaseModel):
    """User profile update request payload."""

    name: Optional[str] = Field(None, max_length=200)
    department: Optional[str] = Field(None, max_length=100)


class UserResponse(BaseModel):
    """User profile response DTO."""

    model_config = ConfigDict(from_attributes=True)

    user_id: str
    username: str
    name: str
    email: str
    role: str
    department: str
    is_active: bool
