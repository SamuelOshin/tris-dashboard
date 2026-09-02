"""
User and Persona SQLModel Table.
Pure ORM model — no business logic.
"""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    """Users table for internal risk portal authentication."""

    __tablename__ = "users"

    user_id: str = Field(primary_key=True, index=True)
    username: str = Field(unique=True, index=True, max_length=100)
    name: str = Field(max_length=200)
    email: str = Field(unique=True, index=True, max_length=255)
    hashed_password: str = Field(max_length=255)
    role: str = Field(default="Reviewer", max_length=50)
    department: str = Field(default="Finance", max_length=100)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
