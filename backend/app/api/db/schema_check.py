"""
Schema version check.

The database schema is created and changed only by Alembic migrations. Nothing in the application
creates tables. At start-up (and before seeding) this check compares the version recorded in the
database with the newest migration, so an out-of-date or empty database stops the application with a
clear instruction instead of failing later with a missing-table error.
"""

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncEngine

BACKEND_DIR = Path(__file__).resolve().parents[3]
UPGRADE_HINT = (
    "Run `uv run alembic upgrade head` in the backend folder, then start the application."
)
UNDEFINED_TABLE = "42P01"  # PostgreSQL: relation does not exist


class SchemaNotCurrentError(RuntimeError):
    """The database is not at the newest migration."""


def _scripts() -> ScriptDirectory:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return ScriptDirectory.from_config(config)


def head_revision() -> str:
    """The newest migration in the repository."""
    head = _scripts().get_current_head()
    if head is None:
        raise SchemaNotCurrentError("No migrations were found next to the application.")
    return head


async def assert_schema_is_current(engine: AsyncEngine) -> str:
    """
    Check that the database is at the newest migration.

    Returns:
        The revision the database is at.

    Raises:
        SchemaNotCurrentError: If the database has no migration record, is behind the newest
            migration, or is at a migration this version of the application does not know.
    """
    scripts = _scripts()
    head = head_revision()
    async with engine.connect() as conn:
        try:
            rows = (await conn.execute(text("SELECT version_num FROM alembic_version"))).all()
        except ProgrammingError as exc:
            if getattr(exc.orig, "sqlstate", None) != UNDEFINED_TABLE:
                raise  # for example no permission to read it: report that, not "not migrated"
            raise SchemaNotCurrentError(
                f"The database has not been migrated (no migration record). {UPGRADE_HINT}"
            ) from exc
    current = {row[0] for row in rows}
    if current == {head}:
        return head
    if not current:
        raise SchemaNotCurrentError(
            f"The database has not been migrated (the migration record is empty). {UPGRADE_HINT}"
        )
    known = {revision.revision for revision in scripts.walk_revisions()}
    unknown = sorted(current - known)
    if unknown:
        raise SchemaNotCurrentError(
            f"The database is at migration {unknown}, which this version of the application does "
            f"not contain; it needs '{head}'. Deploy the matching version of the application."
        )
    raise SchemaNotCurrentError(
        f"The database is at migration {sorted(current)} but the application needs '{head}'. "
        f"{UPGRADE_HINT}"
    )
