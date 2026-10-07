"""
The schema comes only from migrations.

The application used to create any missing table when it started (`create_all`), which hid the fact
that the migrations could not build a database on their own. Now nothing in the application creates
tables; at start-up (and before seeding) the database version is checked against the newest
migration and the application stops with an instruction if it is not current.
"""

import ast
import logging
import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

import app.main as main_module
from app.api.db import schema_check
from app.api.db.schema_check import SchemaNotCurrentError, assert_schema_is_current
from app.scripts import seed as seed_module
from tests.modules.v1.test_migrations_build_empty_database import (
    BACKEND_DIR,
    _alembic,
    _drop,
    _scratch,
)

APP_DIR = Path(main_module.__file__).parent
PREVIOUS_REVISION = "cbbdff801f48"


def test_no_application_code_creates_tables():
    """`create_all` / `drop_all` are for tests only; the application must never call them."""
    offenders = []
    for path in APP_DIR.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Attribute) and node.attr in {"create_all", "drop_all"}:
                offenders.append(f"{path.relative_to(APP_DIR)}:{node.lineno}")
    assert not offenders, offenders


def test_the_head_revision_is_found_in_the_repository():
    assert len(schema_check.head_revision()) == 12  # a single newest migration is found


@pytest.mark.db
@pytest.mark.asyncio
async def test_an_empty_or_old_database_is_refused_and_a_current_one_passes():
    name = "tris_schema_check_test"
    url = _scratch(name)
    engine = create_async_engine(url)
    try:
        with pytest.raises(SchemaNotCurrentError, match="alembic upgrade head"):
            await assert_schema_is_current(engine)  # empty: no migration record at all

        _alembic(url, "upgrade", PREVIOUS_REVISION)
        with pytest.raises(SchemaNotCurrentError, match=PREVIOUS_REVISION):
            await assert_schema_is_current(engine)  # behind the newest migration

        _alembic(url, "upgrade", "head")
        assert await assert_schema_is_current(engine) == schema_check.head_revision()
    finally:
        await engine.dispose()
        _drop(name)


@pytest.mark.db
@pytest.mark.asyncio
async def test_the_application_will_not_start_on_an_unmigrated_database(monkeypatch, caplog):
    name = "tris_schema_start_test"
    url = _scratch(name)
    engine = create_async_engine(url)
    monkeypatch.setattr(main_module, "engine", engine)
    try:
        with caplog.at_level(logging.INFO, logger="tris.main"):
            with pytest.raises(SchemaNotCurrentError):
                async with main_module.lifespan(main_module.app):
                    pass  # never reached: start-up stops on the empty database
            assert "alembic upgrade head" in caplog.text
            caplog.clear()
            _alembic(url, "upgrade", "head")
            async with main_module.lifespan(main_module.app):
                pass  # starts once the database is migrated
            assert f"migration {schema_check.head_revision()}" in caplog.text
    finally:
        await engine.dispose()
        _drop(name)


@pytest.mark.asyncio
async def test_an_unreachable_database_only_warns_but_other_failures_stop_start_up(
    monkeypatch, caplog
):
    dead = create_async_engine(
        "postgresql+psycopg://nobody:none@127.0.0.1:1/none", connect_args={"connect_timeout": 2}
    )
    monkeypatch.setattr(main_module, "engine", dead)
    try:
        with caplog.at_level(logging.WARNING, logger="tris.main"):
            async with main_module.lifespan(main_module.app):
                pass  # cannot reach the database: warn and start, the first request reports it
        assert "Could not reach the database" in caplog.text
    finally:
        await dead.dispose()

    async def broken(_engine):
        raise ValueError("the migrations folder is missing")

    monkeypatch.setattr(main_module, "assert_schema_is_current", broken)
    with pytest.raises(ValueError, match="migrations folder"):
        async with main_module.lifespan(main_module.app):
            pass  # a failure that is not "unreachable" must not be hidden


@pytest.mark.db
@pytest.mark.asyncio
async def test_unknown_or_extra_revisions_are_reported_precisely():
    name = "tris_schema_rows_test"
    url = _scratch(name)
    engine = create_async_engine(url)
    try:
        _alembic(url, "upgrade", "head")
        async with engine.begin() as conn:
            await conn.execute(text("UPDATE alembic_version SET version_num = 'deadbeef0000'"))
        with pytest.raises(SchemaNotCurrentError, match="does not contain"):
            await assert_schema_is_current(engine)  # newer or foreign database
        async with engine.begin() as conn:
            await conn.execute(
                text(f"UPDATE alembic_version SET version_num = '{PREVIOUS_REVISION}'")
            )
            await conn.execute(
                text(f"INSERT INTO alembic_version VALUES ('{schema_check.head_revision()}')")
            )
        with pytest.raises(SchemaNotCurrentError, match="needs"):
            await assert_schema_is_current(engine)  # two rows: not a single clean head
    finally:
        await engine.dispose()
        _drop(name)


@pytest.mark.db
@pytest.mark.asyncio
async def test_seeding_is_refused_on_an_unmigrated_database(monkeypatch):
    name = "tris_schema_seed_test"
    url = _scratch(name)
    engine = create_async_engine(url)
    monkeypatch.setattr(seed_module, "engine", engine)
    try:
        with pytest.raises(SchemaNotCurrentError, match="alembic upgrade head"):
            await seed_module.seed_users_and_triggers()
    finally:
        await engine.dispose()
        _drop(name)


@pytest.mark.db
@pytest.mark.asyncio
async def test_seeding_works_end_to_end_on_a_database_built_only_by_migrations():
    """
    The documented setup: `alembic upgrade head`, then the seed command (no table creation).
    It runs the real command in a fresh process: inside the test process other imports have
    already registered every model, which hid a missing registration once.
    """
    name = "tris_schema_seedok_test"
    url = _scratch(name)
    engine = create_async_engine(url)
    try:
        _alembic(url, "upgrade", "head")
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "app.scripts.seed",
                "--data-file",
                str(BACKEND_DIR.parent / "test data.xlsx"),
                "--temporal-fixture",
            ],
            cwd=BACKEND_DIR,
            env={**os.environ, "DATABASE_URL": url, "PYTHONUTF8": "1"},
            capture_output=True,
            text=True,
            timeout=240,
        )
        assert result.returncode == 0, result.stderr[-2500:]
        async with engine.connect() as conn:
            counts = [
                (await conn.execute(text(f"SELECT count(*) FROM {table}"))).scalar_one()
                for table in ("users", "suppliers", "transactions", "risk_cases")
            ]
            trigger = (
                await conn.execute(
                    text("SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'trg_case_history%'")
                )
            ).scalar_one()
        assert counts[0] >= 8 and all(c > 0 for c in counts), counts
        assert trigger == 1
    finally:
        await engine.dispose()
        _drop(name)
