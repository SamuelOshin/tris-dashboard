"""
Authentication Pydantic DTO Schemas.
Pure request/response serialization — no business logic.
"""

from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    """User login request payload."""

    username: str
    password: str


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
