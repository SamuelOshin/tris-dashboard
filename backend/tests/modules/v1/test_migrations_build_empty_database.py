"""
Migrations can build the database from nothing.

Until the baseline revision existed, `alembic upgrade head` failed on an empty database (the
original tables were only ever created by the application's start-up schema build), so a new
environment could not be built from the migrations. These tests build scratch databases with
real Alembic runs and require that the result matches the models and keeps the original
case-history immutability trigger.
"""

import os
import subprocess
import sys
from pathlib import Path

import psycopg
import pytest
from sqlalchemy import create_engine, text
from sqlmodel import SQLModel

from app.api.db import schema_check
from app.api.db.model_registry import ensure_models_registered
from tests.conftest import TEST_DATABASE_URL, _admin_conninfo

pytestmark = pytest.mark.db  # builds its own scratch databases on the PostgreSQL server

BACKEND_DIR = Path(__file__).resolve().parents[3]
HEAD = schema_check.head_revision()  # the newest migration, whatever it is now
TABLES_SQL = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
TRIGGERS_SQL = "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal"


def _alembic(url: str, *args: str) -> str:
    result = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": url},
        capture_output=True,
        text=True,
        timeout=240,
    )
    assert result.returncode == 0, f"alembic {' '.join(args)} failed:\n{result.stderr[-2500:]}"
    return result.stdout + result.stderr


def _scratch(name: str) -> str:
    assert "test" in name
    with psycopg.connect(_admin_conninfo(), autocommit=True) as admin:
        admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        admin.execute(f'CREATE DATABASE "{name}"')
    return TEST_DATABASE_URL.rsplit("/", 1)[0] + f"/{name}"


def _drop(name: str) -> None:
    with psycopg.connect(_admin_conninfo(), autocommit=True) as admin:
        admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


def _model_tables() -> set[str]:
    ensure_models_registered()
    return set(SQLModel.metadata.tables)


def test_upgrade_head_builds_an_empty_database_that_matches_the_models():
    name = "tris_migrations_empty_test"
    url = _scratch(name)
    engine = create_engine(url)
    try:
        _alembic(url, "upgrade", "head")
        with engine.begin() as conn:
            tables = {r[0] for r in conn.execute(text(TABLES_SQL))}
            triggers = {r[0] for r in conn.execute(text(TRIGGERS_SQL))}
            version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        assert version == HEAD
        assert _model_tables() <= tables, sorted(_model_tables() - tables)
        # the original immutability trigger is part of the migrations, not only of the seed
        assert "trg_case_history_immutable" in triggers
        assert {"trg_forecast_runs_immutable", "trg_validation_runs_immutable"} <= triggers
        _alembic(url, "check")  # no difference between the migrations and the models
    finally:
        engine.dispose()
        _drop(name)


def test_case_history_cannot_be_changed_in_a_migration_built_database():
    name = "tris_migrations_trigger_test"
    url = _scratch(name)
    engine = create_engine(url)
    try:
        _alembic(url, "upgrade", "head")
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO risk_cases (case_id, case_number, priority, status, "
                    "trigger_signals, evaluation_snapshot, created_at, updated_at) VALUES "
                    "('C1', 'CN1', 'High', 'New', '[]', '{}', NOW(), NOW())"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO case_history (case_id, timestamp, actor, action, new_status) "
                    "VALUES ('C1', NOW(), 'someone', 'created', 'New')"
                )
            )
        for statement in ("UPDATE case_history SET actor = 'else'", "DELETE FROM case_history"):
            with pytest.raises(Exception, match="immutable"):
                with engine.begin() as conn:
                    conn.execute(text(statement))
    finally:
        engine.dispose()
        _drop(name)


def test_upgrade_head_also_works_on_a_database_the_application_already_built():
    """The start-up schema build creates every table first; the migrations must then succeed."""
    name = "tris_migrations_prebuilt_test"
    url = _scratch(name)
    engine = create_engine(url)
    try:
        ensure_models_registered()
        SQLModel.metadata.create_all(engine)
        _alembic(url, "upgrade", "head")
        with engine.begin() as conn:
            version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        assert version == HEAD
        _alembic(url, "check")
    finally:
        engine.dispose()
        _drop(name)
