"""
Standardized API Response Envelopes.
Every TRIS API endpoint returns responses wrapped by these utilities.
"""

from typing import Any

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse


def success_response(
    status_code: int,
    message: str,
    data: Any | None = None,
) -> JSONResponse:
    """
    Create a standardized JSON response for successful requests.

    Args:
        status_code (int): HTTP status code (e.g., 200, 201).
        message (str): Human-readable success description.
        data (Optional[Any]): Payload data dictionary or list. Defaults to empty dict.

    Returns:
        JSONResponse: Standardized SUCCESS payload envelope.
    """
    response_data = {
        "status": "SUCCESS",
        "status_code": status_code,
        "message": message,
        "data": data if data is not None else {},
    }
    return JSONResponse(status_code=status_code, content=jsonable_encoder(response_data))


def auth_response(
    status_code: int,
    message: str,
    access_token: str,
    token_type: str = "bearer",
    data: dict[str, Any] | None = None,
) -> JSONResponse:
    """
    Create a standardized JSON response for authentication events.

    Args:
        status_code (int): HTTP status code.
        message (str): Human-readable result message.
        access_token (str): JWT token string.
        token_type (str): Token type scheme (default: bearer).
        data (Optional[Dict]): Additional user profile or claims dictionary.

    Returns:
        JSONResponse: SUCCESS payload envelope containing access_token.
    """
    token_data = {
        "access_token": access_token,
        "token_type": token_type,
    }
    response_data = {
        "status": "SUCCESS",
        "status_code": status_code,
        "message": message,
        "data": {**token_data, **(data or {})},
    }
    return JSONResponse(status_code=status_code, content=jsonable_encoder(response_data))


def error_response(
    status_code: int,
    message: str,
    error_code: str = "ERROR",
    errors: dict[str, Any] | None = None,
) -> JSONResponse:
    """
    Create a standardized JSON response for failed requests.

    Args:
        status_code (int): HTTP error status code (e.g. 400, 401, 404, 422).
        message (str): Human-readable error description.
        error_code (str): Machine-readable domain error code.
        errors (Optional[Dict]): Optional field-level validation errors.

    Returns:
        JSONResponse: Standardized ERROR payload envelope.
    """
    response_data = {
        "status": "ERROR",
        "status_code": status_code,
        "message": message,
        "error_code": error_code,
        "errors": errors or {},
    }
    return JSONResponse(status_code=status_code, content=jsonable_encoder(response_data))
