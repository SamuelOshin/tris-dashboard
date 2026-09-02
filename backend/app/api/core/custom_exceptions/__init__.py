"""Custom domain exceptions and global handlers."""

from app.api.core.custom_exceptions.exceptions import (
    AlreadyExistsError,
    AuthenticationError,
    CustomDomainException,
    DatabaseIntegrityError,
    IngestionError,
    InvalidStateTransitionError,
    NotFoundError,
    PermissionDeniedError,
    RuleExecutionError,
    ValidationError,
    VerifiedClosureValidationError,
)
from app.api.core.custom_exceptions.register import register_exception_handlers

__all__ = [
    "AlreadyExistsError",
    "AuthenticationError",
    "CustomDomainException",
    "DatabaseIntegrityError",
    "IngestionError",
    "InvalidStateTransitionError",
    "NotFoundError",
    "PermissionDeniedError",
    "RuleExecutionError",
    "ValidationError",
    "VerifiedClosureValidationError",
    "register_exception_handlers",
]
