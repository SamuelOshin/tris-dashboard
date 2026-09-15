"""
Security Audit Log SQLModel Table.
Pure ORM model — no business logic.

Captures: login success, login failure, and rule configuration edits.
Intentionally separate from CaseHistory (operational audit) per SEC-07.
"""

from datetime import UTC, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class SecurityAuditLog(SQLModel, table=True):
    """Immutable security event log for authentication and configuration changes."""

    __tablename__ = "security_audit_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_type: str = Field(index=True, max_length=50)
    """Event category: LOGIN_SUCCESS | LOGIN_FAILURE | RULE_CONFIG_EDIT"""

    actor_id: Optional[str] = Field(default=None, nullable=True, max_length=100)
    """user_id of the authenticated actor, or None for unauthenticated login failures."""

    actor_username: Optional[str] = Field(default=None, nullable=True, max_length=100)
    """Username or email attempted; None if not determinable."""

    actor_role: Optional[str] = Field(default=None, nullable=True, max_length=50)
    """Role of the actor at the time of the event."""

    resource_type: Optional[str] = Field(default=None, nullable=True, max_length=100)
    """Entity type affected, e.g. ''rule_config''."""

    resource_id: Optional[str] = Field(default=None, nullable=True, max_length=100)
    """Specific entity identifier, e.g. rule_code ''R-003''."""

    detail: Optional[str] = Field(default=None, nullable=True, max_length=500)
    """Human-readable summary of the event."""

    ip_address: Optional[str] = Field(default=None, nullable=True, max_length=45)
    """Originating IP address (IPv4 or IPv6). Optional."""

    occurred_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        index=True,
    )
    """UTC timestamp of the event. Always server-generated."""
