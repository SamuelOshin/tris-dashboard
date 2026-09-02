"""
Pytest Test Configuration and Fixtures for TRIS.
Configures in-memory SQLite database and async HTTP test client.
"""

from typing import Annotated, AsyncGenerator, Optional

import pytest
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from app.api.core.dependencies import bearer_scheme, get_current_user
from app.api.db.database import get_db
from app.api.db.model_registry import ensure_models_registered
from app.api.modules.v1.auth.models.user import User
from app.main import app

# Ensure all domain models are loaded into SQLModel.metadata
ensure_models_registered()

# Test in-memory SQLite database
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

test_session_factory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


@pytest.fixture(scope="session", autouse=True)
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides a clean database session for each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    async with test_session_factory() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provides an authenticated HTTPX AsyncClient with overridden database dependency."""

    async def override_get_db():
        yield db_session

    async def override_get_current_user(
        request: Request,
        credentials: Annotated[
            Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)
        ] = None,
        db: Annotated[AsyncSession, Depends(get_db)] = None,
    ):
        if credentials or "access_token" in request.cookies:
            return await get_current_user(request, credentials, db)
        return User(
            user_id="USR-TEST-001",
            username="auditor",
            name="A. Reviewer",
            email="auditor@tris.internal",
            role="admin",
            department="Finance",
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
