"""
Global exception handlers for TRIS FastAPI application.
Converts domain exceptions and uncaught errors into standardized JSON responses.
"""

import logging

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.core.custom_exceptions.error_status_code_mapper import ERROR_STATUS_MAP, HTTP_422
from app.api.core.custom_exceptions.exceptions import CustomDomainException
from app.api.utils.response_payloads import error_response

logger = logging.getLogger("tris.exceptions")


async def domain_exception_handler(request: Request, exc: CustomDomainException):
    """
    Global handler for all CustomDomainException instances.
    Maps exception code to HTTP status and formats standardized error envelope.
    """
    status_code = ERROR_STATUS_MAP.get(exc.code, status.HTTP_400_BAD_REQUEST)
    field_errors = getattr(exc, "field_errors", None)

    logger.warning(
        f"Domain exception on {request.method} {request.url.path}: {exc.code} - {exc.message}"
    )

    return error_response(
        status_code=status_code,
        message=exc.message,
        error_code=exc.code,
        errors=field_errors,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handler for FastAPI request validation errors (Pydantic payload parsing).
    """
    errors_dict = {}
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err["loc"] if loc not in ("body", "query", "path"))
        if not field:
            field = "general"
        errors_dict.setdefault(field, []).append(err["msg"])

    logger.info(f"Validation error on {request.method} {request.url.path}: {errors_dict}")

    return error_response(
        status_code=HTTP_422,
        message="Request payload validation failed",
        error_code="VALIDATION_ERROR",
        errors=errors_dict,
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Handler for Starlette/FastAPI HTTPExceptions (e.g. 404 Not Found, 405 Method Not Allowed).
    """
    error_code = "HTTP_ERROR"
    if exc.status_code == status.HTTP_404_NOT_FOUND:
        error_code = "ENDPOINT_NOT_FOUND"
    elif exc.status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
        error_code = "METHOD_NOT_ALLOWED"

    return error_response(
        status_code=exc.status_code,
        message=str(exc.detail),
        error_code=error_code,
    )


async def internal_server_error_handler(request: Request, exc: Exception):
    """
    Handler for unexpected 500 internal server errors.
    Logs the full exception trace and returns safe generic message.
    """
    logger.exception(f"Unhandled server error on {request.method} {request.url.path}: {exc}")

    return error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        message=(
            "An unexpected internal server error occurred. Please contact system administrator."
        ),
        error_code="INTERNAL_SERVER_ERROR",
    )
