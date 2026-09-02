"""
Security and Cryptography Module for TRIS.
Enforces Argon2id password hashing and signed JWT authentication tokens.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from app.api.core.config import settings
from app.api.core.custom_exceptions.exceptions import AuthenticationError

# Argon2id password hashing context with OWASP recommended parameters
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
    argon2__memory_cost=65536,  # 64 MB memory hardness
    argon2__time_cost=3,  # 3 iterations
    argon2__parallelism=4,  # 4 parallel execution threads
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against an Argon2id hashed string.

    Args:
        plain_password (str): The candidate cleartext password.
        hashed_password (str): The stored Argon2id hash.

    Returns:
        bool: True if password matches hash, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Computes the Argon2id hash of a cleartext password.

    Args:
        password (str): Cleartext password to hash.

    Returns:
        str: Argon2id hash string.
    """
    return pwd_context.hash(password)


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """
    Generates a cryptographically signed JWT access token.

    Args:
        data (Dict[str, Any]): Claims payload (typically sub, role, name, department).
        expires_delta (Optional[timedelta]): Custom expiration duration.

    Returns:
        str: Encoded JWT string.
    """
    to_encode = data.copy()
    now = datetime.now(UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decodes and validates a signed JWT access token.

    Args:
        token (str): JWT token string.

    Returns:
        Dict[str, Any]: Decoded claims dictionary.

    Raises:
        AuthenticationError: If token signature is invalid or token has expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Session has expired. Please log in again.") from None
    except jwt.PyJWTError:
        raise AuthenticationError("Invalid authentication token.") from None
