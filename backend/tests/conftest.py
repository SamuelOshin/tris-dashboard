"""
Pytest Test Configuration and Fixtures for TRIS.
Configures in-memory SQLite database and async HTTP test client.
"""

import os
from typing import Annotated, AsyncGenerator, Optional
from urllib.parse import urlparse, urlunparse

import psycopg
import pytest
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlmodel import SQLModel

from app.api.core.config import settings
from app.api.core.dependencies import bearer_scheme, get_current_user
from app.api.db import database as db_module
from app.api.db.database import get_db
from app.api.db.model_registry import ensure_models_registered
from app.api.modules.v1.auth.models.user import User
from app.main import app

# Ensure all domain models are loaded into SQLModel.metadata
ensure_models_registered()


# ── 1. Derive Hermetic PostgreSQL Test Database URL ───────────────────────────
def derive_test_database_url(base_url: str) -> tuple[str, str, str]:
    """
    Parses configured database URL and generates an isolated test database URL
    with '_test' appended to the database name.
    """
    parsed = urlparse(base_url)
    raw_path = parsed.path.lstrip("/")
    db_name = raw_path.split("?")[0] if raw_path else "tris_db"

    if not db_name.endswith("_test"):
        test_db_name = f"{db_name}_test"
    else:
        test_db_name = db_name

    new_path = f"/{test_db_name}"
    if "?" in raw_path:
        new_path += f"?{raw_path.split('?', 1)[1]}"

    test_url = urlunparse(parsed._replace(path=new_path))
    return db_name, test_db_name, test_url


DEV_DB_NAME, TEST_DB_NAME, TEST_DATABASE_URL = derive_test_database_url(settings.DATABASE_URL)

# Update application settings and runtime environment
settings.DATABASE_URL = TEST_DATABASE_URL
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DEBUG", "true")

# ── 2. Create PostgreSQL Test Engine and Session Factory ──────────────────────
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    poolclass=NullPool,
)

test_session_factory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

# Rebind async_session_factory and engine on db_module for dependency injection & background workers
db_module.engine = test_engine
db_module.async_session_factory = test_session_factory


@pytest.fixture(scope="session", autouse=True)
def setup_test_database() -> None:
    """
    1. Asserts we are connecting to a test database (failsafe guard).
    2. Connects to PostgreSQL admin db ('postgres') to CREATE DATABASE <db>_test if missing.
    3. Recreates the public schema and tables once for the test session.
    """
    # HARD SAFETY GUARD: Never drop schemas on non-test databases
    assert "test" in str(test_engine.url.database), (
        "CRITICAL SAFETY GUARD: Refusing to reset database! "
        f"Engine is pointed to: {test_engine.url.database}"
    )

    # Convert database URL for administrative operations
    admin_url = TEST_DATABASE_URL.replace("postgresql+psycopg://", "postgresql://").replace(
        "postgresql+asyncpg://", "postgresql://"
    )
    conn_params = psycopg.conninfo.conninfo_to_dict(admin_url)
    conn_params["dbname"] = "postgres"
    admin_conn_str = psycopg.conninfo.make_conninfo(**conn_params)

    # Ensure test database exists
    with psycopg.connect(admin_conn_str, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB_NAME,))
        if not cur.fetchone():
            cur.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')

    # Initialize tables fresh on the test database
    import asyncio

    async def init_tables() -> None:
        async with test_engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            await conn.run_sync(SQLModel.metadata.create_all)

    asyncio.run(init_tables())


@pytest.fixture(scope="session", autouse=True)
def anyio_backend():
    return "asyncio"


DEFAULT_TEST_USERS = [
    {
        "user_id": "USR-TEST-001",
        "username": "auditor",
        "name": "A. Reviewer",
        "email": "auditor@tris.internal",
        "role": "admin",
        "department": "Finance",
    },
    {
        "user_id": "USR-ADMIN-001",
        "username": "admin_user",
        "name": "Admin Tester",
        "email": "admin.tester@tris.internal",
        "role": "admin",
        "department": "Security",
    },
    {
        "user_id": "USR-CREATOR-1",
        "username": "creator",
        "name": "Job Creator",
        "email": "creator@tris.internal",
        "role": "admin",
        "department": "Operations",
    },
    {
        "user_id": "USR-SOMEONE-ELSE",
        "username": "other_user",
        "name": "Other User",
        "email": "other@tris.internal",
        "role": "admin",
        "department": "IT",
    },
]


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides an isolated database session with fast table truncation and seeded base users."""
    async with test_engine.begin() as conn:
        # Fast truncate all tables to reset state without expensive DDL drops
        await conn.execute(
            text(
                """
                DO $$ DECLARE
                    r RECORD;
                BEGIN
                    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
                    END LOOP;
                END $$;
                """
            )
        )
        # Pre-seed baseline test users to satisfy FK relationships
        for u in DEFAULT_TEST_USERS:
            await conn.execute(
                text(
                    """
                    INSERT INTO users (
                        user_id, username, name, email, role, department,
                        is_active, hashed_password, created_at
                    )
                    VALUES (
                        :user_id, :username, :name, :email, :role, :department,
                        true, 'test_hash', NOW()
                    )
                    ON CONFLICT (user_id) DO NOTHING;
                    """
                ),
                u,
            )

    async with test_session_factory() as session:
        yield session


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
