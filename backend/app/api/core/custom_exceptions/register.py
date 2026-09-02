"""
Registers TRIS exception handlers on the FastAPI application instance.
"""

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.core.custom_exceptions.exceptions import CustomDomainException
from app.api.core.custom_exceptions.handlers import (
    domain_exception_handler,
    http_exception_handler,
    internal_server_error_handler,
    validation_exception_handler,
)


def register_exception_handlers(app: FastAPI) -> None:
    """Register all global exception handlers on the FastAPI application."""
    app.add_exception_handler(CustomDomainException, domain_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, internal_server_error_handler)
