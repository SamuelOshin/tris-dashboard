"""
Optional migration at start-up (AUTO_MIGRATE).

Builds scratch databases and checks: an empty database is migrated to the newest revision; running
it again changes nothing; two instances starting together both succeed (one migrates, the other
waits); a failing migration stops with the error and leaves the database untouched; the switch is
off by default and, when on, lets the application start on an empty database.
"""

import asyncio

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

import app.main as main_module
from app.api.core.config import Settings
from app.api.db import schema_check
from app.api.db.auto_migrate import MigrationFailedError, run_auto_migration
from app.api.db.schema_check import SchemaNotCurrentError, assert_schema_is_current
from tests.modules.v1.test_migrations_build_empty_database import _drop, _scratch

pytestmark = pytest.mark.db


def test_auto_migrate_is_off_by_default():
    assert Settings.model_fields["AUTO_MIGRATE"].default is False


@pytest.mark.asyncio
async def test_an_empty_database_is_migrated_and_a_second_run_changes_nothing():
    name = "tris_automigrate_one_test"
    engine = create_async_engine(_scratch(name))
    try:
        with pytest.raises(SchemaNotCurrentError):
            await assert_schema_is_current(engine)
        await run_auto_migration(engine)
        assert await assert_schema_is_current(engine) == schema_check.head_revision()
        await run_auto_migration(engine)  # already current: succeeds, nothing to do
        assert await assert_schema_is_current(engine) == schema_check.head_revision()
    finally:
        await engine.dispose()
        _drop(name)


@pytest.mark.asyncio
async def test_two_instances_starting_together_both_succeed():
    name = "tris_automigrate_two_test"
    url = _scratch(name)
    first, second = create_async_engine(url), create_async_engine(url)
    try:
        await asyncio.gather(run_auto_migration(first), run_auto_migration(second))
        assert await assert_schema_is_current(first) == schema_check.head_revision()
        async with first.connect() as conn:
            rows = (await conn.execute(text("SELECT count(*) FROM alembic_version"))).scalar_one()
        assert rows == 1
    finally:
        await first.dispose()
        await second.dispose()
        _drop(name)


@pytest.mark.asyncio
async def test_a_failing_migration_stops_with_the_error_and_leaves_the_database_alone():
    name = "tris_automigrate_fail_test"
    engine = create_async_engine(_scratch(name))
    try:
        await run_auto_migration(engine)
        async with engine.begin() as conn:  # a migration record this version cannot find
            await conn.execute(text("UPDATE alembic_version SET version_num = 'deadbeef0000'"))
        with pytest.raises(MigrationFailedError, match="deadbeef0000"):
            await run_auto_migration(engine)
        async with engine.connect() as conn:
            kept = (
                await conn.execute(text("SELECT version_num FROM alembic_version"))
            ).scalar_one()
            tables = (
                await conn.execute(text("SELECT count(*) FROM information_schema.tables"))
            ).scalar_one()
        assert kept == "deadbeef0000" and tables > 30  # untouched
    finally:
        await engine.dispose()
        _drop(name)


@pytest.mark.asyncio
async def test_the_application_starts_on_an_empty_database_only_when_the_switch_is_on(monkeypatch):
    name = "tris_automigrate_start_test"
    engine = create_async_engine(_scratch(name))
    monkeypatch.setattr(main_module, "engine", engine)
    try:
        monkeypatch.setattr(main_module.settings, "AUTO_MIGRATE", False)
        with pytest.raises(SchemaNotCurrentError):
            async with main_module.lifespan(main_module.app):
                pass  # off: an empty database is refused, as before
        monkeypatch.setattr(main_module.settings, "AUTO_MIGRATE", True)
        async with main_module.lifespan(main_module.app):
            pass  # on: it migrates, then starts
        assert await assert_schema_is_current(engine) == schema_check.head_revision()
    finally:
        await engine.dispose()
        _drop(name)
