"""
Custom domain exceptions for TRIS.
All application-level exceptions inherit from CustomDomainException.
Services raise domain exceptions directly without try-except blocks.
"""

from typing import Any


class CustomDomainException(Exception):
    """
    Base exception for all TRIS domain errors.

    Attributes:
        message (str): Human-readable error description.
        code (str): Machine-readable error code for API serialization.
        field_errors (Optional[Dict[str, List[str]]]): Optional field-level error mapping.
    """

    def __init__(
        self,
        message: str,
        code: str,
        field_errors: dict[str, list[str]] | None = None,
        **kwargs: Any,
    ):
        self.message = message
        self.code = code
        self.field_errors = field_errors or {}
        for key, value in kwargs.items():
            setattr(self, key, value)
        super().__init__(message)


class NotFoundError(CustomDomainException):
    """Raised when a requested entity does not exist in the database."""

    def __init__(self, message: str = "Requested resource was not found"):
        super().__init__(message=message, code="NOT_FOUND")


class AlreadyExistsError(CustomDomainException):
    """Raised when an entity already exists (e.g. duplicate key or ID)."""

    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message=message, code="ALREADY_EXISTS")


class ValidationError(CustomDomainException):
    """Raised when input validation fails in the business layer."""

    def __init__(
        self,
        message: str = "Validation failed",
        field_errors: dict[str, list[str]] | None = None,
    ):
        super().__init__(message=message, code="VALIDATION_ERROR", field_errors=field_errors)


class VerifiedClosureValidationError(CustomDomainException):
    """Raised when an attempt to close a case fails the 8-field verification check."""

    def __init__(
        self,
        message: str = "Verified closure failed: mandatory fields missing or invalid",
        missing_fields: list[str] | None = None,
    ):
        field_errors = {"missing_fields": missing_fields} if missing_fields else {}
        super().__init__(
            message=message,
            code="VERIFIED_CLOSURE_VALIDATION_ERROR",
            field_errors=field_errors,
            missing_fields=missing_fields or [],
        )


class InvalidStateTransitionError(CustomDomainException):
    """Raised when an illegal case lifecycle state transition is attempted."""

    def __init__(
        self,
        current_status: str,
        attempted_status: str,
        allowed_transitions: list[str] | None = None,
    ):
        message = (
            f"Cannot transition case from '{current_status}' to '{attempted_status}'. "
            f"Allowed transitions: {allowed_transitions or []}"
        )
        super().__init__(
            message=message,
            code="INVALID_STATE_TRANSITION",
            current_status=current_status,
            attempted_status=attempted_status,
            allowed_transitions=allowed_transitions or [],
        )


class AuthenticationError(CustomDomainException):
    """Raised when authentication credentials or tokens are invalid or expired."""

    def __init__(self, message: str = "Invalid credentials or session expired"):
        super().__init__(message=message, code="AUTHENTICATION_FAILED")


class PermissionDeniedError(CustomDomainException):
    """Raised when the current user does not have permission to execute an action."""

    def __init__(self, message: str = "Permission denied for this operation"):
        super().__init__(message=message, code="PERMISSION_DENIED")


class RuleExecutionError(CustomDomainException):
    """Raised when a rule cannot be evaluated due to invalid configuration or parameters."""

    def __init__(self, rule_code: str, message: str):
        super().__init__(
            message=f"Rule {rule_code} execution failed: {message}",
            code="RULE_EXECUTION_ERROR",
            rule_code=rule_code,
        )


class IngestionError(CustomDomainException):
    """Raised when parsing or validating synthetic Excel workbook fails."""

    def __init__(self, message: str, sheet_name: str | None = None):
        super().__init__(
            message=f"Ingestion failed for sheet '{sheet_name}': {message}"
            if sheet_name
            else f"Ingestion failed: {message}",
            code="INGESTION_ERROR",
            sheet_name=sheet_name,
        )


class DatabaseIntegrityError(CustomDomainException):
    """Raised when a database constraint or immutability trigger is violated."""

    def __init__(self, message: str = "Database constraint violation"):
        super().__init__(message=message, code="DATABASE_INTEGRITY_ERROR")
