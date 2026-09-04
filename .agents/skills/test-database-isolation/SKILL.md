---
name: test-database-isolation
description: >-
  Project-agnostic guide and best practices for configuring hermetic test database isolation alongside development and production databases in Python (FastAPI, SQLAlchemy, SQLModel, PostgreSQL/MySQL/SQLite, Alembic). Use when setting up pytest fixtures, preventing test suites from wiping or tampering with development databases, fixing Alembic DuplicateTable / schema desynchronization errors, or configuring transactional test rollbacks.
---

# Hermetic Test Database Isolation & Migration Protection

A project-agnostic architectural guide and runbook for completely isolating test databases from development and production databases in Python web applications (FastAPI, Flask, Django, SQLAlchemy, SQLModel, Alembic).

---

## 1. The Pytest Import-Order Trap

In Python backends, database engines and session factories are frequently instantiated as module-level singletons:

```python
# your_project/core/database.py (or database.py / db.py)
_engine = create_async_engine(settings.DATABASE_URL)
_async_session_maker = async_sessionmaker(bind=_engine)
```

### How the Collision Happens:
1. **Pytest Test Collection**: Pytest discovers and imports test files before running any fixtures.
2. **Top-Level Route/App Imports**: Test files import application instances or routers (e.g., `from your_project.main import app`).
3. **Early Engine Binding**: The import chain loads the database module, initializing `_engine` with `settings.DATABASE_URL` (which points to the **development database**).
4. **Destructive Teardown**: `conftest.py` runs a database setup fixture (e.g., `DROP SCHEMA public CASCADE`, `Base.metadata.drop_all()`, or `create_all()`). If `conftest.py` only modified `settings.DATABASE_URL` as a string after `_engine` was already created, the destructive DDL executes against the **development database**, deleting dev data and the `alembic_version` table.
5. **Alembic Error**: When developers subsequently run `alembic upgrade head`, Alembic detects an empty `alembic_version` table and attempts to run initial migration scripts from scratch, failing with:
   `psycopg.errors.DuplicateTable: relation "<table_name>" already exists` (or `Table '<table_name>' already exists`).

---

## 2. Dynamic, Project-Agnostic Isolation Pattern

This pattern dynamically extracts the database name from any configured `DATABASE_URL`, appends `_test`, creates the test database automatically, and force-rebinds any initialized engines.

### Complete `conftest.py` Template

```python
# tests/conftest.py
from __future__ import annotations

import asyncio
import os
import sys
from collections.abc import AsyncGenerator
from unittest.mock import patch
from urllib.parse import urlparse, urlunparse

import psycopg  # or asyncpg / psycopg2 / sqlalchemy create_engine
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel  # or from your_project.models import Base

# ── 1. Set Hermetic Test Environment Variables ────────────────────────────────
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("DEBUG", "true")

# ── 2. Dynamically Compute Test Database URL ──────────────────────────────────
# Import your project settings
from your_project.core.config import settings

def derive_test_database_url(base_url: str) -> tuple[str, str, str]:
    """
    Parses any SQL database URL and generates a test database URL
    with '_test' appended to the database name.
    
    Returns:
        (dev_db_name, test_db_name, test_database_url)
    """
    parsed = urlparse(base_url)
    raw_path = parsed.path.lstrip("/")
    
    # Handle optional query params
    db_name = raw_path.split("?")[0] if raw_path else "app_db"
    
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

# Update settings singleton and process environment
settings.DATABASE_URL = TEST_DATABASE_URL
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

# ── 3. Force Engine Re-Binding ────────────────────────────────────────────────
# Import your database module where _engine and _session_maker are defined
import your_project.core.database as db_module

db_module._engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)
db_module._async_session_maker = async_sessionmaker(
    bind=db_module._engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
_engine = db_module._engine


# ── 4. Session Setup: Auto-provision and Reset Test Database ──────────────────
@pytest.fixture(scope="session", autouse=True)
def setup_test_database() -> None:
    """
    1. Asserts we are connecting to a test database (failsafe).
    2. Connects to server admin database to CREATE DATABASE <db>_test if missing.
    3. Recreates the public schema and tables fresh for the test run.
    """
    # HARD SAFETY GUARD: Never drop schemas on non-test databases
    assert "test" in str(_engine.url.database), (
        f"CRITICAL SAFETY GUARD: Refusing to reset database! Engine is pointed to: {_engine.url.database}"
    )

    # Convert database URL for administrative operations (Postgres admin db is 'postgres')
    conn_params = psycopg.conninfo.conninfo_to_dict(
        TEST_DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")
    )
    conn_params["dbname"] = "postgres"
    admin_conn_str = psycopg.conninfo.make_conninfo(**conn_params)

    # Ensure test database exists
    with psycopg.connect(admin_conn_str, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB_NAME,))
        if not cur.fetchone():
            cur.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')

    # Recreate tables fresh on the test database
    async def init_tables() -> None:
        async with _engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            # For SQLModel:
            await conn.run_sync(SQLModel.metadata.create_all)
            # Or for standard SQLAlchemy:
            # await conn.run_sync(Base.metadata.create_all)

    asyncio.run(init_tables())


# ── 5. Function-Scoped Transaction Rollback Fixture ───────────────────────────
@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """
    Wraps each individual test in an isolated transaction that rolls back on exit.
    Tests stay fast without having to drop/recreate tables between test runs.
    """
    connection = await _engine.connect()
    transaction = await connection.begin()

    session = AsyncSession(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    test_session_maker = async_sessionmaker(
        bind=connection,
        class_=AsyncSession,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    # Patch global sessionmaker so background tasks and dependencies use the test transaction
    with patch.object(db_module, "_async_session_maker", test_session_maker):
        yield session

    await session.close()
    await transaction.rollback()
    await connection.close()
```

---

## 3. Synchronous SQLAlchemy / SQLite Adaptation

If using synchronous SQLAlchemy or SQLite:

```python
# For SQLite (in-memory or file-based test isolation)
TEST_DATABASE_URL = "sqlite:///:memory:"  # or "sqlite:///./test.db"

# Re-bind sync engine
import your_project.core.database as db_module
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

db_module.engine = create_engine(TEST_DATABASE_URL)
db_module.SessionLocal = sessionmaker(bind=db_module.engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=db_module.engine)
    yield
    Base.metadata.drop_all(bind=db_module.engine)
```

---

## 4. Recovering from Alembic Desynchronization (`DuplicateTable`)

If test runs or accidental scripts created tables directly on the development database, Alembic's `alembic_version` table may be empty or missing while the tables exist.

### Step-by-Step Fix:

1. **Check current tracked state**:
   ```bash
   uv run alembic current
   # If blank, Alembic does not know the database has tables.
   ```

2. **Check the latest revision ID**:
   ```bash
   uv run alembic heads
   # Outputs: <revision_id> (head)
   ```

3. **Stamp the database without running DDL**:
   ```bash
   uv run alembic stamp head
   # Marks the current database schema as matching head without executing duplicate CREATE TABLE statements.
   ```

4. **Verify**:
   ```bash
   uv run alembic current
   # Outputs: <revision_id> (head)
   
   uv run alembic upgrade head
   # Runs cleanly with no operations needed.
   ```

---

## 5. Universal Verification Checklist

Whenever setting up a new repository or troubleshooting database issues:
- [ ] **Dynamic Naming**: Test URL dynamically derives from `DATABASE_URL` by appending `_test` (no hardcoded project names).
- [ ] **Environment Overridden**: `os.environ["DATABASE_URL"]` is explicitly assigned `TEST_DATABASE_URL`.
- [ ] **Engine Re-bound**: `db_module._engine` is re-instantiated with `TEST_DATABASE_URL` in `conftest.py`.
- [ ] **Failsafe Assertion**: `assert "test" in str(engine.url.database)` guards all schema drops.
- [ ] **Session Rollback**: `db` fixture uses nested transactions/savepoints to keep tests isolated.
- [ ] **Alembic Unaffected**: Running `alembic current` before and after `pytest` returns the identical revision on the development database.
